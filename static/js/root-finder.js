/**
 * Finds a root of fn in the interval [a, b] using the bisection method.
 *
 * @param {(x: number) => number} fn - Continuous function to find a root of.
 * @param {number} a - Left endpoint of the bracketing interval.
 * @param {number} b - Right endpoint of the bracketing interval.
 * @param {number} [tolerance=1e-8] - Stop when the interval half-width is below this.
 * @param {number} [maxIterations=100] - Maximum number of iterations.
 * @returns {number} Approximate root.
 * @throws {Error} If fn(a) and fn(b) don't bracket a root, or if convergence fails.
 */
export function bisection(fn, a, b, tolerance = 1e-8, maxIterations = 100) {
    if (a === b) {
        throw new Error('bisection: a and b must be different');
    }
    if (a > b) {
        [a, b] = [b, a];
    }

    let fa = fn(a);
    let fb = fn(b);

    if (fa === 0) return a;
    if (fb === 0) return b;

    if (Math.sign(fa) === Math.sign(fb)) {
        throw new Error(
            `bisection: fn(a) and fn(b) must have opposite signs (got fn(a)=${fa}, fn(b)=${fb})`
        );
    }

    let mid = (a + b) / 2;

    for (let k = 0; k < maxIterations; k++) {
        mid = (a + b) / 2;
        const fmid = fn(mid);

        if (fmid === 0 || (b - a) / 2 < tolerance) {
            return mid;
        }

        if (Math.sign(fmid) === Math.sign(fa)) {
            a = mid;
            fa = fmid;
        } else {
            b = mid;
        }
    }

    console.warn(
        `bisection: reached maxIterations (${maxIterations}) without converging to tolerance ${tolerance}`
    );
    return mid;
}