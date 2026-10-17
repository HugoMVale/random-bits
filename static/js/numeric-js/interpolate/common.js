import { Vector } from '../linalg/Vector.js';
/** Rejects non-finite knots; sortedness is controlled separately by `checkSorted`. */
function checkFiniteKnots(xpv, caller) {
    for (let i = 0; i < xpv.size; i++) {
        if (!Number.isFinite(xpv.data[i])) {
            throw new RangeError(`${caller}: xp must contain only finite values`);
        }
    }
}
/**
 * Checks that `xpv` is monotonically increasing (duplicates allowed).
 * Knots must already have passed `checkFiniteKnots`.
 * @throws {RangeError} If `xpv` is not monotonically increasing.
 */
function checkMonotonic(xpv, caller) {
    for (let i = 1; i < xpv.size; i++) {
        if (xpv.data[i] < xpv.data[i - 1]) {
            throw new RangeError(`${caller}: xp must be monotonically increasing`);
        }
    }
}
/** Integrates one constant-valued interval without producing `0 * Infinity`. */
export function integrateConstant(width, value) {
    return width === Infinity && value === 0 ? 0 : width * value;
}
/** Adds a constant-valued interval component-wise without producing `0 * Infinity`. */
export function addConstantIntegral(total, values, width) {
    for (let i = 0; i < total.size; i++) {
        total.data[i] += integrateConstant(width, values.data[i]);
    }
}
/**
 * Checks that `xpv` is *strictly* increasing (no duplicate knots), the
 * stricter requirement PCHIP places on top of `checkMonotonic`'s
 * non-decreasing check. Shared by `PchipInterpolator1D` and
 * `PchipInterpolatorND`, which both call `prepareInterp`/`prepareInterpND`
 * (non-strict) first and then this, as a separate step, since PCHIP's
 * stricter requirement is specific to it and not to interpolation in general.
 * @throws {RangeError} If any two consecutive `xp` entries are equal.
 */
export function checkStrictlyIncreasing(xpv, caller) {
    for (let i = 1; i < xpv.size; i++) {
        if (xpv.data[i] === xpv.data[i - 1]) {
            throw new RangeError(`${caller}: xp must be strictly increasing`);
        }
    }
}
/**
 * Locates the bracketing interval in `xpData` for `xi` via binary search:
 * returns `[lo, hi]` such that `xpData[lo] <= xi <= xpData[hi]`, with
 * `hi === lo + 1` except in the single-point (`xpData.length === 1`) case,
 * where `hi === lo === 0`.
 *
 * Shared by every scalar and vector interpolation kernel (linear and
 * PCHIP alike, both 1D and ND) — the bracket-finding step is identical
 * regardless of what's done with `lo`/`hi` afterwards.
 *
 * Callers must ensure `xi` is not `NaN` and lies within
 * `[xpData[0], xpData[xpData.length - 1]]`; those cases are handled by
 * each caller before reaching the search (their clamp/`NaN` values
 * differ, e.g. `0` for a derivative vs `leftVal`/`rightVal` for a value).
 * @param xi The x-coordinate to bracket.
 * @param xpData The (increasing) x-coordinates of the data points.
 * @returns The `[lo, hi]` bracketing indices.
 */
export function findBracket(xi, xpData) {
    let lo = 0;
    let hi = xpData.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >>> 1;
        if (xpData[mid] <= xi)
            lo = mid;
        else
            hi = mid;
    }
    return [lo, hi];
}
/**
 * Normalizes and validates `xp`/`fp`/`left`/`right` for scalar (1D)
 * interpolation. Shared by `interp1D` and `LinearInterpolator1D`/
 * `PchipInterpolator1D` so validation and defaulting logic exists in
 * exactly one place, without either public API depending on the other.
 * @param xp The x-coordinates of the data points.
 * @param fp The y-coordinates of the data points.
 * @param left Value to return for `x < xp[0]`, or `undefined` to default to `fp[0]`.
 * @param right Value to return for `x > xp[last]`, or `undefined` to default to `fp[last]`.
 * @param checkSorted Whether to verify that `xp` is monotonically increasing.
 * @param caller Name of the public entry point invoking this check, used
 * to produce a precise error message (e.g. `"interp1D"` or `"LinearInterpolator1D"`).
 * @returns The validated `xp`/`fp` as `Vector`, plus resolved clamp values.
 * @throws {RangeError} If `xp` is empty, if `xp` and `fp` have different
 * lengths, if `xp` contains a non-finite value, or (when `checkSorted` is
 * `true`) if `xp` is not monotonically increasing.
 */
export function prepareInterp1D(xp, fp, left, right, checkSorted, caller) {
    const xpv = xp instanceof Vector ? xp : Vector.from(xp);
    const fpv = fp instanceof Vector ? fp : Vector.from(fp);
    if (xpv.size === 0) {
        throw new RangeError(`${caller}: xp must have at least one element`);
    }
    if (xpv.size !== fpv.size) {
        throw new RangeError(`${caller}: xp and fp must have the same length: ${xpv.size} vs ${fpv.size}`);
    }
    checkFiniteKnots(xpv, caller);
    if (checkSorted) {
        checkMonotonic(xpv, caller);
    }
    return {
        xp: xpv,
        fp: fpv,
        leftVal: left ?? fpv.get(0),
        rightVal: right ?? fpv.get(fpv.size - 1)
    };
}
/**
 * Resolves an `InterpNDOptions.left`/`right` value against `fp`'s column
 * count: `undefined` falls back to `fallback` (a row of `fp`), a bare
 * `number` broadcasts to every component, and a `number[]`/`Vector` is
 * validated to have exactly `dim` entries.
 * @throws {RangeError} If an explicit `number[]`/`Vector` doesn't have length `dim`.
 */
function resolveClampVector(val, fallback, dim, paramName, caller) {
    if (val === undefined)
        return fallback;
    if (typeof val === 'number')
        return Vector.full(dim, val);
    const v = val instanceof Vector ? val : Vector.from(val);
    if (v.size !== dim) {
        throw new RangeError(`${caller}: ${paramName} must have length ${dim} (fp.cols), got ${v.size}`);
    }
    return v;
}
/**
 * Normalizes and validates `xp`/`fp`/`left`/`right` for vector-valued
 * (ND) interpolation. The ND counterpart of `prepareInterp`: `fp` is a
 * `Matrix` (row `i` is the vector value at `xp[i]`) rather than a
 * `Vector`, and `left`/`right` resolve to `Vector`s of length `fp.cols`
 * rather than plain numbers. Shared by `interpND` and
 * `LinearInterpolatorND`/`PchipInterpolatorND`.
 * @param xp The x-coordinates of the data points (the shared knots for
 * every output component).
 * @param fp The vector-valued data points, one row per knot in `xp`.
 * @param left Value(s) to return for `x < xp[0]`, or `undefined` to default to `fp.row(0)`.
 * @param right Value(s) to return for `x > xp[last]`, or `undefined` to default to `fp.row(fp.rows - 1)`.
 * @param checkSorted Whether to verify that `xp` is monotonically increasing.
 * @param caller Name of the public entry point invoking this check.
 * @returns The validated `xp` (`Vector`) and `fp` (`Matrix`), plus resolved clamp vectors.
 * @throws {RangeError} If `xp` is empty, if `xp.size !== fp.rows`, if an
 * explicit `left`/`right` doesn't have length `fp.cols`, if `xp` contains
 * a non-finite value, or (when `checkSorted` is `true`) if `xp` is not
 * monotonically increasing.
 */
export function prepareInterpND(xp, fp, left, right, checkSorted, caller) {
    const xpv = xp instanceof Vector ? xp : Vector.from(xp);
    if (xpv.size === 0) {
        throw new RangeError(`${caller}: xp must have at least one element`);
    }
    if (xpv.size !== fp.rows) {
        throw new RangeError(`${caller}: xp and fp must have the same length: ${xpv.size} vs ${fp.rows} (fp.rows)`);
    }
    checkFiniteKnots(xpv, caller);
    if (checkSorted) {
        checkMonotonic(xpv, caller);
    }
    return {
        xp: xpv,
        fp,
        leftVal: resolveClampVector(left, fp.row(0), fp.cols, 'left', caller),
        rightVal: resolveClampVector(right, fp.row(fp.rows - 1), fp.cols, 'right', caller)
    };
}
//# sourceMappingURL=common.js.map