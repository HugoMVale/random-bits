/**
 * A 3-component vector, used for positions, directions, velocities, etc.
 * All operations that produce a new vector are non-mutating (they return
 * a new Vec3 instance rather than modifying `this`).
 */
export class Vec3 {
    /**
     * @param {number} [x=0] - X component.
     * @param {number} [y=0] - Y component.
     * @param {number} [z=0] - Z component.
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * Adds another vector to this one.
     * @param {Vec3} v - The vector to add.
     * @returns {Vec3} A new vector equal to `this + v`.
     */
    add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }

    /**
     * Subtracts another vector from this one.
     * @param {Vec3} v - The vector to subtract.
     * @returns {Vec3} A new vector equal to `this - v`.
     */
    sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }

    /**
     * Scales this vector by a scalar.
     * @param {number} s - The scale factor.
     * @returns {Vec3} A new vector equal to `this * s`.
     */
    mult(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }

    /**
     * Computes the squared magnitude (length) of this vector.
     * Cheaper than `mag()` since it avoids a square root — useful for
     * comparisons where the exact length isn't needed.
     * @returns {number} The squared length of the vector.
     */
    magSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }

    /**
     * Computes the magnitude (length) of this vector.
     * @returns {number} The length of the vector.
     */
    mag() { return Math.sqrt(this.magSq()); }

    /**
     * Returns a unit-length version of this vector (same direction, length 1).
     * If this vector has zero length, returns a zero vector instead of
     * dividing by zero.
     * @returns {Vec3} The normalized vector, or `(0, 0, 0)` if this vector is zero.
     */
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vec3() : this.mult(1 / m);
    }

    /**
     * Computes the dot product of this vector with another.
     * @param {Vec3} v - The other vector.
     * @returns {number} The scalar dot product `this · v`.
     */
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }

    /**
     * Computes the Euclidean distance between this vector and another.
     * @param {Vec3} v - The other vector.
     * @returns {number} The distance between `this` and `v`.
     */
    dist(v) { return this.sub(v).mag(); }

    /**
     * Returns a copy of this vector clamped to a maximum magnitude, preserving
     * direction. If the vector's magnitude is already at or below `max`,
     * returns an unchanged copy.
     * @param {number} max - The maximum allowed magnitude (must be >= 0).
     * @returns {Vec3} A new vector with magnitude at most `max`.
     */
    limit(max) {
        const m = this.mag();
        return m > max ? this.mult(max / m) : this.copy();
    }

    /**
     * Creates an independent copy of this vector.
     * @returns {Vec3} A new Vec3 with the same x, y, z values.
     */
    copy() { return new Vec3(this.x, this.y, this.z); }
}