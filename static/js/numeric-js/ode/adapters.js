/**
 * Adapts a convenience-style derivative function that allocates and returns
 * a new `Array1D` - `(t, y) => Array1D` - into the writes-into-`dydt` style that
 * ODE steppers/integrators in this package use.
 */
export function wrapAllocatingDerivative(f) {
    return (t, y, dydt) => dydt.set(f(t, y).data);
}
