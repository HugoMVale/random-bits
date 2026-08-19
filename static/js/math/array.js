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

    /**
     * Checks whether this vector is elementwise close to another, modeled on
     * `numpy.isclose`: a component `a` is close to `b` if
     * `|a - b| <= atol + rtol * |b|`.
     * @param {Vec3} v - The other vector.
     * @param {number} [rtol=1e-5] - Relative tolerance.
     * @param {number} [atol=1e-8] - Absolute tolerance.
     * @returns {boolean} `true` if all components of `this` are close to `v`'s.
     */
    isClose(v, rtol = 1e-5, atol = 1e-8) {
        return Math.abs(this.x - v.x) <= atol + rtol * Math.abs(v.x) &&
            Math.abs(this.y - v.y) <= atol + rtol * Math.abs(v.y) &&
            Math.abs(this.z - v.z) <= atol + rtol * Math.abs(v.z);
    }

    /**
     * Returns this vector's components as a plain array.
     * @returns {number[]} `[x, y, z]`.
     */
    toArray() { return [this.x, this.y, this.z]; }

    /**
     * Returns a human-readable string representation of this vector.
     * @returns {string} e.g. `"Vec3(1, 2, 3)"`.
     */
    toString() { return `Vec3(${this.x}, ${this.y}, ${this.z})`; }

    /**
     * Makes Vec3 iterable, e.g. `const [x, y, z] = someVec3;`.
     * @returns {Iterator<number>}
     */
    [Symbol.iterator]() { return [this.x, this.y, this.z][Symbol.iterator](); }

    // -----------------------------------------------------------------
    // In-place (mutating) operations.
    //
    // Only use these on local accumulators or scratch vectors that are
    // never aliased elsewhere (i.e. nothing else holds a reference to the
    // same object expecting it to stay constant). Mutating a shared or
    // unexpectedly-referenced vector is a classic, hard-to-spot source of
    // physics bugs — when in doubt, use the immutable methods instead.
    // -----------------------------------------------------------------

    /**
     * Sets this vector's components directly, mutating it in place.
     * @param {number} x
     * @param {number} y
     * @param {number} [z=0]
     * @returns {Vec3} `this`, for chaining.
     */
    set(x, y, z = 0) { this.x = x; this.y = y; this.z = z; return this; }

    /**
     * Resets this vector to `(0, 0, 0)` in place.
     * @returns {Vec3} `this`, for chaining.
     */
    reset() { return this.set(0, 0, 0); }

    /**
     * Adds another vector to this one in place: `this += v`.
     * @param {Vec3} v - The vector to add.
     * @returns {Vec3} `this`, for chaining.
     */
    addSelf(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }

    /**
     * Subtracts another vector from this one in place: `this -= v`.
     * @param {Vec3} v - The vector to subtract.
     * @returns {Vec3} `this`, for chaining.
     */
    subSelf(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }

    /**
     * Scales this vector in place: `this *= s`.
     * @param {number} s - The scale factor.
     * @returns {Vec3} `this`, for chaining.
     */
    multSelf(s) { this.x *= s; this.y *= s; this.z *= s; return this; }

    /**
     * Adds a scaled vector to this one in place, in a single pass and
     * without an intermediate vector: `this += v * s`.
     * @param {Vec3} v - The vector to scale and add.
     * @param {number} s - The scale factor applied to `v`.
     * @returns {Vec3} `this`, for chaining.
     */
    addScaled(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }

    /**
     * Sets this vector to `a - b` in place, without allocating. Useful as a
     * reusable scratch vector inside a loop, e.g.
     * `scratch.subVectors(other.pos, bird.pos)` instead of
     * `other.pos.sub(bird.pos)`.
     * @param {Vec3} a
     * @param {Vec3} b
     * @returns {Vec3} `this`, set to `a - b`.
     */
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; }

    /**
     * Creates a zero vector `(0, 0, 0)`.
     * @returns {Vec3} A new zero vector.
     */
    static zero() { return new Vec3(); }

    /**
     * Creates a Vec3 from an array or array-like of `[x, y, z]`.
     * @param {number[]|Float64Array} arr - Source values; missing entries default to 0.
     * @returns {Vec3} A new vector.
     */
    static from(arr) { return new Vec3(arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0); }
}

/**
 * An N-component vector utilizing Float64Array for performance.
 */
export class Array1D {
    /**
     * @param {number|number[]|Float64Array} input - The dimension length (initialized to 0s) or initial data.
     */
    constructor(input) {
        this.data = new Float64Array(input);
        this.dim = this.data.length;
    }

    /**
     * Throws if `v` is not a Array1D of the same dimension as this one. Used
     * internally to guard binary operations against silent shape mismatches.
     * @param {Array1D} v - The other vector.
     * @throws {RangeError} If `v.dim !== this.dim`.
     * @private
     */
    _checkDim(v) {
        if (v.dim !== this.dim) {
            throw new RangeError(`Array1D dimension mismatch: ${this.dim} vs ${v.dim}`);
        }
    }

    // -----------------------------------------------------------------
    // Immutable Operations (return new instances)
    // -----------------------------------------------------------------

    /**
     * Adds another vector to this one.
     * @param {Array1D} v - The vector to add. Must have the same `dim` as this one.
     * @returns {Array1D} A new vector equal to `this + v`.
     */
    add(v) {
        this._checkDim(v);
        const res = new Array1D(this.dim);
        for (let i = 0; i < this.dim; i++) res.data[i] = this.data[i] + v.data[i];
        return res;
    }

    /**
     * Subtracts another vector from this one.
     * @param {Array1D} v - The vector to subtract. Must have the same `dim` as this one.
     * @returns {Array1D} A new vector equal to `this - v`.
     */
    sub(v) {
        this._checkDim(v);
        const res = new Array1D(this.dim);
        for (let i = 0; i < this.dim; i++) res.data[i] = this.data[i] - v.data[i];
        return res;
    }

    /**
     * Scales this vector by a scalar.
     * @param {number} s - The scale factor.
     * @returns {Array1D} A new vector equal to `this * s`.
     */
    mult(s) {
        const res = new Array1D(this.dim);
        for (let i = 0; i < this.dim; i++) res.data[i] = this.data[i] * s;
        return res;
    }

    /**
     * Computes the squared magnitude (length) of this vector.
     * Cheaper than `mag()` since it avoids a square root.
     * @returns {number} The squared length of the vector.
     */
    magSq() {
        let sum = 0;
        for (let i = 0; i < this.dim; i++) sum += this.data[i] * this.data[i];
        return sum;
    }

    /**
     * Computes the magnitude (length) of this vector.
     * @returns {number} The length of the vector.
     */
    mag() { return Math.sqrt(this.magSq()); }

    /**
     * Returns a unit-length version of this vector (same direction, length 1).
     * If this vector has zero length, returns a zero vector instead of
     * dividing by zero.
     * @returns {Array1D} The normalized vector, or a zero vector if this vector is zero.
     */
    normalize() {
        const m = this.mag();
        return m === 0 ? new Array1D(this.dim) : this.mult(1 / m);
    }

    /**
     * Computes the dot product of this vector with another.
     * @param {Array1D} v - The other vector. Must have the same `dim` as this one.
     * @returns {number} The scalar dot product `this · v`.
     */
    dot(v) {
        this._checkDim(v);
        let sum = 0;
        for (let i = 0; i < this.dim; i++) sum += this.data[i] * v.data[i];
        return sum;
    }

    /**
     * Computes the Euclidean distance between this vector and another.
     * @param {Array1D} v - The other vector. Must have the same `dim` as this one.
     * @returns {number} The distance between `this` and `v`.
     */
    dist(v) { return this.sub(v).mag(); }

    /**
     * Returns a copy of this vector clamped to a maximum magnitude, preserving
     * direction. If the vector's magnitude is already at or below `max`,
     * returns an unchanged copy.
     * @param {number} max - The maximum allowed magnitude (must be >= 0).
     * @returns {Array1D} A new vector with magnitude at most `max`.
     */
    limit(max) {
        const m = this.mag();
        return m > max ? this.mult(max / m) : this.copy();
    }

    /**
     * Creates an independent copy of this vector.
     * @returns {Array1D} A new Array1D with the same values.
     */
    copy() { return new Array1D(this.data); }

    /**
     * Checks whether this vector is elementwise close to another, modeled on
     * `numpy.isclose`: a component `a` is close to `b` if
     * `|a - b| <= atol + rtol * |b|`.
     * @param {Array1D} v - The other vector.
     * @param {number} [rtol=1e-5] - Relative tolerance.
     * @param {number} [atol=1e-8] - Absolute tolerance.
     * @returns {boolean} `true` if `v` has the same `dim` and all components of `this` are close to `v`'s.
     */
    isClose(v, rtol = 1e-5, atol = 1e-8) {
        if (v.dim !== this.dim) return false;
        for (let i = 0; i < this.dim; i++) {
            if (Math.abs(this.data[i] - v.data[i]) > atol + rtol * Math.abs(v.data[i])) return false;
        }
        return true;
    }

    /**
     * Returns this vector's components as a plain array.
     * @returns {number[]} The components, in order.
     */
    toArray() { return Array.from(this.data); }

    /**
     * Returns a human-readable string representation of this vector.
     * @returns {string} e.g. `"Array1D(1, 2, 3)"`.
     */
    toString() { return `Array1D(${this.data.join(', ')})`; }

    /**
     * Makes Array1D iterable, e.g. `const [a, b, c] = someVector;` or `for (const x of v)`.
     * @returns {Iterator<number>}
     */
    [Symbol.iterator]() { return this.data[Symbol.iterator](); }

    // -----------------------------------------------------------------
    // In-place (mutating) operations.
    // -----------------------------------------------------------------

    /**
     * Sets this vector's components directly, mutating it in place.
     * @param {number[]|Float64Array} values - Values to copy in; must have length `dim`.
     * @returns {Array1D} `this`, for chaining.
     */
    set(values) {
        this.data.set(values);
        return this;
    }

    /**
     * Resets this vector to all zeros in place.
     * @returns {Array1D} `this`, for chaining.
     */
    reset() {
        this.data.fill(0);
        return this;
    }

    /**
     * Adds another vector to this one in place: `this += v`.
     * @param {Array1D} v - The vector to add. Must have the same `dim` as this one.
     * @returns {Array1D} `this`, for chaining.
     */
    addSelf(v) {
        this._checkDim(v);
        for (let i = 0; i < this.dim; i++) this.data[i] += v.data[i];
        return this;
    }

    /**
     * Subtracts another vector from this one in place: `this -= v`.
     * @param {Array1D} v - The vector to subtract. Must have the same `dim` as this one.
     * @returns {Array1D} `this`, for chaining.
     */
    subSelf(v) {
        this._checkDim(v);
        for (let i = 0; i < this.dim; i++) this.data[i] -= v.data[i];
        return this;
    }

    /**
     * Scales this vector in place: `this *= s`.
     * @param {number} s - The scale factor.
     * @returns {Array1D} `this`, for chaining.
     */
    multSelf(s) {
        for (let i = 0; i < this.dim; i++) this.data[i] *= s;
        return this;
    }

    /**
     * Adds a scaled vector to this one in place, in a single pass and
     * without an intermediate vector: `this += v * s`.
     * @param {Array1D} v - The vector to scale and add. Must have the same `dim` as this one.
     * @param {number} s - The scale factor applied to `v`.
     * @returns {Array1D} `this`, for chaining.
     */
    addScaled(v, s) {
        this._checkDim(v);
        for (let i = 0; i < this.dim; i++) this.data[i] += v.data[i] * s;
        return this;
    }

    /**
     * Sets this vector to `a - b` in place, without allocating. Useful as a
     * reusable scratch vector inside a loop.
     * @param {Array1D} a
     * @param {Array1D} b - Must have the same `dim` as `a` and as this vector.
     * @returns {Array1D} `this`, set to `a - b`.
     */
    subVectors(a, b) {
        this._checkDim(a);
        this._checkDim(b);
        for (let i = 0; i < this.dim; i++) this.data[i] = a.data[i] - b.data[i];
        return this;
    }

    /**
     * Creates a zero vector of the given dimension.
     * @param {number} dim - The number of components.
     * @returns {Array1D} A new zero vector.
     */
    static zero(dim) { return new Array1D(dim); }

    /**
     * Creates a Array1D from an array or typed array.
     * @param {number[]|Float64Array} arr - Source values.
     * @returns {Array1D} A new vector with dimension equal to `arr.length`.
     */
    static from(arr) { return new Array1D(arr); }
}