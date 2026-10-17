import { Vector } from '../linalg/Vector.js';
import { Matrix } from '../linalg/Matrix.js';
import { prepareInterp1D, prepareInterpND, findBracket, integrateConstant, addConstantIntegral } from './common.js';
/**
 * Interpolates a single scalar value, locating the bracketing interval in
 * `xp` via `findBracket`.
 * @param xi The x-coordinate to evaluate.
 * @param xp The (increasing) x-coordinates of the data points.
 * @param fp The y-coordinates of the data points, same size as `xp`.
 * @param leftVal Value to return for `xi < xp[0]`.
 * @param rightVal Value to return for `xi > xp[xp.size - 1]`.
 * @returns The interpolated (or clamped) value at `xi`.
 */
function interpOne1D(xi, xp, fp, leftVal, rightVal) {
    const n = xp.size;
    const xpd = xp.data;
    const fpd = fp.data;
    // NaN propagates, matching Vector.min/max's NaN-wins convention.
    if (Number.isNaN(xi))
        return NaN;
    if (xi < xpd[0])
        return leftVal;
    if (xi > xpd[n - 1])
        return rightVal;
    const [lo, hi] = findBracket(xi, xpd);
    const x0 = xpd[lo];
    const x1 = xpd[hi];
    if (x1 === x0)
        return fpd[lo]; // duplicate x-coordinates: avoid 0/0
    const t = (xi - x0) / (x1 - x0);
    return fpd[lo] + t * (fpd[hi] - fpd[lo]);
}
/**
 * Interpolates each component of `x`, delegating to `interpOne1D` per element.
 * @param x The x-coordinates to evaluate.
 * @param xp The (increasing) x-coordinates of the data points.
 * @param fp The y-coordinates of the data points, same size as `xp`.
 * @param leftVal Value to return for components below `xp[0]`.
 * @param rightVal Value to return for components above `xp[xp.size - 1]`.
 * @returns The interpolated (or clamped) values, one per component of `x`.
 */
function interpMany1D(x, xp, fp, leftVal, rightVal) {
    const xv = x instanceof Vector ? x : Vector.from(x);
    const res = new Vector(xv.size);
    const xdata = xv.data;
    const rdata = res.data;
    for (let i = 0; i < xv.size; i++) {
        rdata[i] = interpOne1D(xdata[i], xp, fp, leftVal, rightVal);
    }
    return res;
}
/**
 * Evaluates the derivative of the piecewise-linear interpolant at one point.
 */
function linearDerivativeOne1D(xi, xp, fp) {
    const n = xp.size;
    const xpd = xp.data;
    const fpd = fp.data;
    if (Number.isNaN(xi))
        return NaN;
    if (xi < xpd[0] || xi > xpd[n - 1])
        return 0;
    const [lo, hi] = findBracket(xi, xpd);
    const h = xpd[hi] - xpd[lo];
    return h === 0 ? 0 : (fpd[hi] - fpd[lo]) / h;
}
function linearDerivativeMany1D(x, xp, fp) {
    const xv = x instanceof Vector ? x : Vector.from(x);
    const res = new Vector(xv.size);
    const xdata = xv.data;
    const rdata = res.data;
    for (let i = 0; i < xv.size; i++) {
        rdata[i] = linearDerivativeOne1D(xdata[i], xp, fp);
    }
    return res;
}
// -----------------------------------------------------------------
// Vector-valued (ND) kernels. `fp` is a Matrix (row i = the vector value
// at xp[i]); the bracket/t computation is identical to the scalar case
// (same xp for every output component), so each kernel below does that
// bracket search once and then loops over fp's columns directly against
// the underlying flat buffers -- mirroring Matrix.matmul/mulVec's style
// of avoiding a per-component Vector allocation in the hot loop.
// -----------------------------------------------------------------
function interpOneND(xi, xp, fp, leftVal, rightVal) {
    const n = xp.size;
    const xpd = xp.data;
    const m = fp.cols;
    if (Number.isNaN(xi))
        return Vector.full(m, NaN);
    if (xi < xpd[0])
        return leftVal.copy();
    if (xi > xpd[n - 1])
        return rightVal.copy();
    const [lo, hi] = findBracket(xi, xpd);
    const x0 = xpd[lo];
    const x1 = xpd[hi];
    const loOff = fp.flatIndex(lo, 0);
    const hiOff = fp.flatIndex(hi, 0);
    const res = new Vector(m);
    if (x1 === x0) {
        for (let j = 0; j < m; j++)
            res.data[j] = fp.data[loOff + j];
        return res;
    }
    const t = (xi - x0) / (x1 - x0);
    for (let j = 0; j < m; j++) {
        const y0 = fp.data[loOff + j];
        const y1 = fp.data[hiOff + j];
        res.data[j] = y0 + t * (y1 - y0);
    }
    return res;
}
function interpManyND(x, xp, fp, leftVal, rightVal, caller) {
    const xv = x instanceof Vector ? x : Vector.from(x);
    if (xv.size === 0) {
        throw new RangeError(`${caller}: cannot evaluate at zero points; Matrix cannot represent a result with 0 rows`);
    }
    const m = fp.cols;
    const res = new Matrix(xv.size, m);
    for (let i = 0; i < xv.size; i++) {
        const row = interpOneND(xv.data[i], xp, fp, leftVal, rightVal);
        res.setRow(i, row);
    }
    return res;
}
function linearDerivativeOneND(xi, xp, fp) {
    const n = xp.size;
    const xpd = xp.data;
    const m = fp.cols;
    if (Number.isNaN(xi))
        return Vector.full(m, NaN);
    if (xi < xpd[0] || xi > xpd[n - 1])
        return new Vector(m);
    const [lo, hi] = findBracket(xi, xpd);
    const h = xpd[hi] - xpd[lo];
    const res = new Vector(m);
    if (h === 0)
        return res;
    const loOff = fp.flatIndex(lo, 0);
    const hiOff = fp.flatIndex(hi, 0);
    for (let j = 0; j < m; j++) {
        res.data[j] = (fp.data[hiOff + j] - fp.data[loOff + j]) / h;
    }
    return res;
}
function linearDerivativeManyND(x, xp, fp, caller) {
    const xv = x instanceof Vector ? x : Vector.from(x);
    if (xv.size === 0) {
        throw new RangeError(`${caller}: cannot evaluate at zero points; Matrix cannot represent a result with 0 rows`);
    }
    const m = fp.cols;
    const res = new Matrix(xv.size, m);
    for (let i = 0; i < xv.size; i++) {
        const row = linearDerivativeOneND(xv.data[i], xp, fp);
        res.setRow(i, row);
    }
    return res;
}
/**
 * A linear interpolant for a scalar-valued function (`number -> number`).
 *
 * Given the discrete data points `(xp[i], fp[i])`, with `xp` increasing,
 * `eval(x)` returns the linearly interpolated value(s) at `x`. For `x`
 * outside the range of `xp`, the result is clamped to the boundary value of
 * `fp` unless `options.left`/`options.right` are given.
 *
 * Validation (matching lengths, non-empty, sorted) happens once, in the
 * constructor, rather than on every evaluation. This makes `LinearInterpolator1D`
 * the better choice over the standalone `interp1D` function whenever the same
 * `(xp, fp)` pair is evaluated repeatedly, e.g. inside an optimize loop or
 * when resampling many points against one curve.
 *
 * For interpolating a vector-valued function (`number -> Vector`) against
 * the same shared `xp` knots, see {@link LinearInterpolatorND}.
 *
 * @example
 * ```ts
 * import { LinearInterpolator1D } from 'numerics-js/interpolate';
 *
 * const f = new LinearInterpolator1D([1, 2, 3], [3, 2, 0]);
 * console.log(f.eval(2.5));
 * console.log(f.eval([0, 1.5, 3.14]).toString());
 * ```
 *
 * Output:
 * ```text
 * 1
 * Vector(3, 2.5, 0)
 * ```
 */
export class LinearInterpolator1D {
    xp;
    fp;
    leftVal;
    rightVal;
    /**
     * @param xp The `x`-coordinates of the data points. Must be
     * monotonically increasing (duplicates allowed), finite, and non-empty.
     * @param fp The `y`-coordinates of the data points. Must have the same
     * length as `xp`.
     * @param options Optional settings; see {@link Interp1DOptions}. Validation
     * (matching lengths, non-empty, and, unless `options.checkSorted` is
     * `false`, sorted) happens once, here in the constructor.
     * @throws {RangeError} If `xp` is empty, if `xp` and `fp` have different
     * lengths, if `xp` contains non-finite values, or (when
     * `options.checkSorted` is `true`) if `xp` is not monotonically increasing.
     */
    constructor(xp, fp, options = {}) {
        const { left, right, checkSorted = true } = options;
        const p = prepareInterp1D(xp, fp, left, right, checkSorted, 'LinearInterpolator1D');
        this.xp = p.xp;
        this.fp = p.fp;
        this.leftVal = p.leftVal;
        this.rightVal = p.rightVal;
    }
    /**
     * The number of data points backing this interpolant.
     */
    get size() {
        return this.xp.size;
    }
    derivative(x) {
        if (typeof x === 'number') {
            return linearDerivativeOne1D(x, this.xp, this.fp);
        }
        return linearDerivativeMany1D(x, this.xp, this.fp);
    }
    /**
     * Integrates the interpolant from `a` to `b` using the trapezoid rule.
     *
     * The integration includes every interpolation knot between the bounds,
     * with `left`/`right` clamp values used outside the `xp` range. Since the
     * interpolant is piecewise linear, applying the trapezoid rule at the
     * interpolation knots is exact (up to floating-point rounding). Reversed
     * bounds return the negative of the integral with the bounds swapped.
     *
     * @param a Lower integration bound `a`.
     * @param b Upper integration bound `b`.
     * @returns The integral of the interpolant over `[a, b]`.
     * @throws {RangeError} If either bound is `NaN`.
     */
    integrate(a, b) {
        if (Number.isNaN(a) || Number.isNaN(b)) {
            throw new RangeError('LinearInterpolator1D.integrate: bounds must not be NaN');
        }
        if (a === b)
            return 0;
        if (b < a)
            return -this.integrate(b, a);
        const n = this.xp.size;
        const xpd = this.xp.data;
        const fpd = this.fp.data;
        let total = 0;
        if (a < xpd[0]) {
            const end = Math.min(b, xpd[0]);
            total += integrateConstant(end - a, this.leftVal);
        }
        const startX = Math.max(a, xpd[0]);
        const endX = Math.min(b, xpd[n - 1]);
        if (startX < endX) {
            for (let i = 0; i < n - 1; i++) {
                const x0 = xpd[i];
                const xNext = xpd[i + 1];
                if (xNext <= startX)
                    continue;
                if (x0 >= endX)
                    break;
                const current = Math.max(startX, x0);
                const next = Math.min(endX, xNext);
                const h = xNext - x0;
                if (h <= 0 || current >= next)
                    continue;
                const t0 = (current - x0) / h;
                const t1 = (next - x0) / h;
                const y0 = fpd[i] + t0 * (fpd[i + 1] - fpd[i]);
                const y1 = fpd[i] + t1 * (fpd[i + 1] - fpd[i]);
                total += (next - current) * (y0 + y1) * 0.5;
            }
        }
        if (b > xpd[n - 1]) {
            const start = Math.max(a, xpd[n - 1]);
            total += integrateConstant(b - start, this.rightVal);
        }
        return total;
    }
    eval(x) {
        if (typeof x === 'number') {
            return interpOne1D(x, this.xp, this.fp, this.leftVal, this.rightVal);
        }
        return interpMany1D(x, this.xp, this.fp, this.leftVal, this.rightVal);
    }
}
/**
 * A linear interpolant for a vector-valued function (`number -> Vector`).
 *
 * Given the discrete data points `(xp[i], fp.row(i))`, with `xp`
 * increasing, `eval(x)` returns the linearly interpolated vector at `x` --
 * every output component is interpolated against the same shared `xp`
 * knots. For `x` outside the range of `xp`, the result is clamped to the
 * boundary row of `fp` unless `options.left`/`options.right` are given.
 *
 * For interpolating a scalar-valued function (`number -> number`),
 * see {@link LinearInterpolator1D}.
 *
 * @example
 * ```ts
 * import { Matrix } from 'numerics-js/linalg';
 * import { LinearInterpolatorND } from 'numerics-js/interpolate';
 *
 * const f = new LinearInterpolatorND([0, 1, 2], Matrix.from([[0, 0], [1, 2], [4, 2]]));
 * console.log(f.eval(0.5).toString());
 * console.log(f.eval([0, 1.5]).toString());
 * ```
 *
 * Output:
 * ```text
 * Vector(0.5, 1)
 * Matrix[[0, 0], [2.5, 2]]
 * ```
 */
export class LinearInterpolatorND {
    xp;
    fp;
    leftVal;
    rightVal;
    /**
     * @param xp The `x`-coordinates of the data points, shared by every
     * output component. Must be monotonically increasing (duplicates
     * allowed), finite, and non-empty.
     * @param fp The vector-valued data points: row `i` is the value at
     * `xp[i]`. Must have `fp.rows === xp.length`.
     * @param options Optional settings; see {@link InterpNDOptions}.
     * @throws {RangeError} If `xp` is empty, if `xp.length !== fp.rows`,
     * if an explicit `options.left` or `options.right` array/`Vector` does
     * not have length `fp.cols`, if `xp` contains non-finite values, or
     * (when `options.checkSorted` is `true`) if `xp` is not monotonically
     * increasing.
     */
    constructor(xp, fp, options = {}) {
        const { left, right, checkSorted = true } = options;
        const p = prepareInterpND(xp, fp, left, right, checkSorted, 'LinearInterpolatorND');
        this.xp = p.xp;
        this.fp = p.fp;
        this.leftVal = p.leftVal;
        this.rightVal = p.rightVal;
    }
    /**
     * The number of data points (knots) backing this interpolant.
     */
    get size() {
        return this.xp.size;
    }
    /**
     * The dimension of the interpolated output vector (`fp.cols`).
     */
    get dim() {
        return this.fp.cols;
    }
    derivative(x) {
        if (typeof x === 'number') {
            return linearDerivativeOneND(x, this.xp, this.fp);
        }
        return linearDerivativeManyND(x, this.xp, this.fp, 'LinearInterpolatorND.derivative');
    }
    /**
     * Integrates the interpolant from `a` to `b`, component-wise, using
     * the trapezoid rule. See `LinearInterpolator1D.integrate` for the
     * algorithm; this applies it independently to each output component.
     * @param a Lower integration bound `a`.
     * @param b Upper integration bound `b`.
     * @returns A `Vector` of length `dim`, the integral of each component over `[a, b]`.
     * @throws {RangeError} If either bound is `NaN`.
     */
    integrate(a, b) {
        if (Number.isNaN(a) || Number.isNaN(b)) {
            throw new RangeError('LinearInterpolatorND.integrate: bounds must not be NaN');
        }
        const m = this.dim;
        if (a === b)
            return new Vector(m);
        if (b < a)
            return this.integrate(b, a).mult(-1);
        const n = this.xp.size;
        const xpd = this.xp.data;
        const fp = this.fp;
        const total = new Vector(m);
        if (a < xpd[0]) {
            const end = Math.min(b, xpd[0]);
            addConstantIntegral(total, this.leftVal, end - a);
        }
        const startX = Math.max(a, xpd[0]);
        const endX = Math.min(b, xpd[n - 1]);
        if (startX < endX) {
            for (let i = 0; i < n - 1; i++) {
                const x0 = xpd[i];
                const x1 = xpd[i + 1];
                if (x1 <= startX)
                    continue;
                if (x0 >= endX)
                    break;
                const current = Math.max(startX, x0);
                const next = Math.min(endX, x1);
                const h = x1 - x0;
                if (h <= 0 || current >= next)
                    continue;
                const t0 = (current - x0) / h;
                const t1 = (next - x0) / h;
                const row0 = fp.flatIndex(i, 0);
                const row1 = fp.flatIndex(i + 1, 0);
                const width = next - current;
                for (let j = 0; j < m; j++) {
                    const y0 = fp.data[row0 + j];
                    const y1 = fp.data[row1 + j];
                    const value0 = y0 + t0 * (y1 - y0);
                    const value1 = y0 + t1 * (y1 - y0);
                    total.data[j] += width * (value0 + value1) * 0.5;
                }
            }
        }
        if (b > xpd[n - 1]) {
            const start = Math.max(a, xpd[n - 1]);
            addConstantIntegral(total, this.rightVal, b - start);
        }
        return total;
    }
    eval(x) {
        if (typeof x === 'number') {
            return interpOneND(x, this.xp, this.fp, this.leftVal, this.rightVal);
        }
        return interpManyND(x, this.xp, this.fp, this.leftVal, this.rightVal, 'LinearInterpolatorND.eval');
    }
}
export function interp1D(x, xp, fp, options = {}) {
    const { left, right, checkSorted = true } = options;
    const { xp: xpv, fp: fpv, leftVal, rightVal } = prepareInterp1D(xp, fp, left, right, checkSorted, 'interp1D');
    if (typeof x === 'number') {
        return interpOne1D(x, xpv, fpv, leftVal, rightVal);
    }
    return interpMany1D(x, xpv, fpv, leftVal, rightVal);
}
export function interpND(x, xp, fp, options = {}) {
    const { left, right, checkSorted = true } = options;
    const { xp: xpv, fp: fpv, leftVal, rightVal } = prepareInterpND(xp, fp, left, right, checkSorted, 'interpND');
    if (typeof x === 'number') {
        return interpOneND(x, xpv, fpv, leftVal, rightVal);
    }
    return interpManyND(x, xpv, fpv, leftVal, rightVal, 'interpND');
}
//# sourceMappingURL=interp1.js.map