import { Vector } from '../linalg/Vector.js';
import { Matrix } from '../linalg/Matrix.js';
/**
 * Evaluates the vector polynomial `c_0 + c_1 x + ... + c_p x^p` component-wise with Horner's
 * rule.
 *
 * `coefficients` holds the `p + 1` blocks `c_0, ..., c_p` one after the other, each of length
 * `dim`. At `x = 0` the result is exactly `c_0`.
 */
function evaluatePolynomial(coefficients, dim, x, out) {
    const top = coefficients.length - dim;
    for (let i = 0; i < dim; i++) {
        let v = coefficients[top + i];
        for (let j = top - dim; j >= 0; j -= dim)
            v = v * x + coefficients[j + i];
        out[i] = v;
    }
}
/**
 * Continuous extension of the accepted step that an adaptive solver is currently processing,
 * as a polynomial in the relative position `x = (t - t_n) / h` with vector coefficients.
 *
 * Both consumers of a step's dense output share one instance per solver run: the event detector
 * (through {@link StepPolynomial.evaluate}) and the {@link OdeDenseOutput} recorder. The
 * coefficients are built lazily, by the solver-specific `build` callback, the first time either
 * of them needs them, so a run that never evaluates the interpolant pays nothing. Because the
 * callback reads the solver's working state, the coefficients must be requested before the
 * solver advances its state.
 *
 * @internal
 */
export class StepPolynomial {
    /**
     * Coefficient blocks `c_0 = y_n, c_1, ..., c_p`, one after the other, each of length `dim`.
     * Valid only after {@link StepPolynomial.ensure}.
     */
    coefficients;
    dim;
    build;
    t = NaN;
    h = NaN;
    ready = false;
    /**
     * @param dim Dimension of the state.
     * @param degree Degree `p` of the polynomial.
     * @param build Writes the `(p + 1) * dim` coefficients of the current step into the given array.
     */
    constructor(dim, degree, build) {
        this.dim = dim;
        this.build = build;
        this.coefficients = new Float64Array((degree + 1) * dim);
    }
    /** Signed size `h` of the current step. */
    get stepSize() {
        return this.h;
    }
    /**
     * Starts a new accepted step `[t, t + h]`, invalidating the coefficients of the previous one.
     *
     * @param t Time at the start of the step.
     * @param h Signed step size.
     */
    reset(t, h) {
        this.t = t;
        this.h = h;
        this.ready = false;
    }
    /** Builds the coefficients of the current step if that has not happened yet, and returns them. */
    ensure() {
        if (!this.ready) {
            this.build(this.coefficients);
            this.ready = true;
        }
        return this.coefficients;
    }
    /** Dense output of the current step, usable as the interpolant of an {@link EventDetector}. */
    evaluate = (t, out) => {
        evaluatePolynomial(this.ensure(), this.dim, (t - this.t) / this.h, out.data);
        return out;
    };
}
/**
 * Dense output of an ODE integration: a continuous, piecewise-polynomial approximation of the
 * solution over the whole integration interval, built from the solver's own step interpolants.
 *
 * It holds one polynomial per accepted step, so the solution can be evaluated at any time
 * within the solved interval without further evaluations of the derivative function. It is
 * returned in {@link OdeResult.denseOutput} when the solver's `denseOutput` option is enabled.
 *
 * The approximation is continuous. At every accepted time point it reproduces the stored state
 * (a row of {@link OdeResult.y}), up to rounding at the end of a step. Between points, its
 * accuracy is that of the solver's interpolant, which is documented with each solver. It is
 * not controlled by the solver's error tolerances, but is generally close to the accuracy of
 * the step points.

 * The solved interval is `[tStart, tEnd]`, with `tEnd < tStart` when integrating backward. If
 * the integration stopped early, because a terminal event occurred or because the solver
 * failed, the dense output covers the part that was actually solved.
 */
export class OdeDenseOutput {
    y0;
    // Step points: segment `i` spans `breaks[i]` to `breaks[i + 1]`, in integration order.
    breaks;
    // Signed step size `h_i` the polynomial of segment `i` is scaled with. It differs from the length
    // of the segment only for a step that was cut short by a terminal event.
    steps = [];
    // Coefficients of segment `i`: blocks `y_n, c_1, ..., c_p` of length `dim`, in `x = (t - t_n) / h_i`.
    pieces = [];
    forward = true;
    /**
     * @internal
     * @param t0 Initial time.
     * @param y0 Initial state. It is copied.
     */
    constructor(t0, y0) {
        this.y0 = y0.data.slice();
        this.breaks = [t0];
    }
    /** Number of components of the state. */
    get dim() {
        return this.y0.length;
    }
    /** Start of the solved interval, the initial time `t0` of the integration. */
    get tStart() {
        return this.breaks[0];
    }
    /**
     * End of the solved interval: the final time reached by the integration, which is `tEnd` of the
     * solver on success, or the time of the terminal event or of the failure otherwise.
     */
    get tEnd() {
        return this.breaks[this.breaks.length - 1];
    }
    /**
     * Appends the segment of an accepted step, which starts where the previous one ended.
     *
     * @internal
     * @param tEnd End of the segment. It is the end of the step, or the event time if a terminal event
     * cut the step short.
     * @param step Polynomial of the step; its coefficients are copied.
     */
    append(tEnd, step) {
        if (this.pieces.length === 0)
            this.forward = step.stepSize > 0;
        this.pieces.push(step.ensure().slice());
        this.steps.push(step.stepSize);
        this.breaks.push(tEnd);
    }
    eval(t) {
        const dim = this.dim;
        if (typeof t === 'number') {
            const out = new Vector(dim);
            this.evalInto(t, out.data);
            return out;
        }
        const tv = t instanceof Vector ? t : Vector.from(t);
        if (tv.size === 0) {
            throw new RangeError('OdeDenseOutput.eval: cannot evaluate at zero points; Matrix cannot represent a result with 0 rows');
        }
        const result = new Matrix(tv.size, dim);
        for (let i = 0; i < tv.size; i++) {
            this.evalInto(tv.data[i], result.data.subarray(i * dim, (i + 1) * dim));
        }
        return result;
    }
    /** Evaluates the solution at `t` into `out`, which has length `dim`. */
    evalInto(t, out) {
        const { breaks } = this;
        const n = this.pieces.length;
        // Mirroring the times by the integration direction makes the search below independent of it.
        const sign = this.forward ? 1 : -1;
        const u = sign * t;
        if (!(sign * breaks[0] <= u && u <= sign * breaks[n])) {
            throw new RangeError(`OdeDenseOutput.eval: t=${t} is outside the solved interval [${breaks[0]}, ${breaks[n]}].`);
        }
        if (n === 0) {
            out.set(this.y0);
            return;
        }
        // Last segment that starts at or before t. A step point belongs to the segment that starts at
        // it, which returns the stored state exactly; the final point belongs to the last segment.
        let lo = 0;
        let hi = n - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (sign * breaks[mid] <= u)
                lo = mid;
            else
                hi = mid - 1;
        }
        evaluatePolynomial(this.pieces[lo], this.dim, (t - breaks[lo]) / this.steps[lo], out);
    }
}
//# sourceMappingURL=denseOutput.js.map