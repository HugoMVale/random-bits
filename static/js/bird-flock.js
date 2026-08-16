// js/bird-flock.js
import { Vec3 } from './vec3.js';

const canvas = document.getElementById('bird-flock');

if (canvas) {
    // --- 1. UI & STYLING SETUP ---
    function renderMath(el, tex) {
        if (window.katex) window.katex.render(tex, el, { throwOnError: false });
        else el.textContent = tex;
    }

    const style = document.createElement('style');
    style.textContent = `
    .bf-wrap { font-family: inherit; margin: 1.5rem 0; }
    .bf-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem; font-size: 0.85rem; padding: 1rem; background: var(--code-bg, #f5f5f5); border: 1px solid var(--border, #ccc); border-radius: 6px; align-items: start; }
    .bf-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .bf-group-title { font-weight: bold; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border, #ccc); padding-bottom: 0.25rem; }
    .bf-row { display: grid; grid-template-columns: 90px 1fr 50px; align-items: center; gap: 0.5rem; }
    .bf-row label { white-space: nowrap; display: flex; align-items: baseline; gap: 0.3rem; }
    .bf-row input[type="range"] { width: 100%; margin: 0; cursor: pointer; }
    .bf-val { text-align: right; font-variant-numeric: tabular-nums; }
    .bf-canvas-container { position: relative; width: 100%; border: 1px solid var(--border, #ccc); border-radius: 6px; overflow: hidden; touch-action: none; background: #eef2f5; }
    .bf-canvas { width: 100%; display: block; cursor: default; }
    .bf-action-bar { display: flex; justify-content: center; align-items: center; gap: 2rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .bf-btn { cursor: pointer; padding: 0.4rem 1.5rem; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--code-bg, #f5f5f5); font-weight: bold; }
    .bf-btn:hover { background: var(--tag-border, #e0e0e0); }
    .bf-hint { text-align: center; font-size: 0.85rem; margin-top: 0.5rem; color: #666; }
    .bf-tooltip { position: absolute; background: rgba(0,0,0,0.8); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; pointer-events: none; opacity: 0; transition: opacity 0.2s; white-space: nowrap; font-family: monospace; z-index: 10; }
  `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'bf-wrap';
    canvas.parentNode.insertBefore(wrap, canvas);

    const controls = document.createElement('div');
    controls.className = 'bf-controls';

    const behaviorGroup = document.createElement('div');
    behaviorGroup.className = 'bf-group';
    behaviorGroup.innerHTML = `<div class="bf-group-title">Steering Behavior</div>`;

    const simGroup = document.createElement('div');
    simGroup.className = 'bf-group';
    simGroup.innerHTML = `<div class="bf-group-title">Simulation & Environment</div>`;

    const config = [
        // Behavior
        { id: 'Kc', tex: 'K_{\\mathrm{c}}', unit: '(1/s²)', min: 0.0, max: 5.0, step: 0.1, val: 0.8, group: behaviorGroup },
        { id: 'Ka', tex: 'K_{\\mathrm{a}}', unit: '(1/s)', min: 0.0, max: 10.0, step: 0.1, val: 2.5, group: behaviorGroup },
        { id: 'Ks', tex: 'K_{\\mathrm{s}}', unit: '(1/s²)', min: 0.0, max: 50.0, step: 1.0, val: 15.0, group: behaviorGroup },
        { id: 'Ko', tex: 'K_{\\mathrm{o}}', unit: '(1/s²)', min: 0.0, max: 400.0, step: 5.0, val: 200.0, group: behaviorGroup },
        { id: 'tau', tex: '\\tau', unit: '(s)', min: 0.1, max: 5.0, step: 0.1, val: 3.0, group: behaviorGroup },
        { id: 'phi', tex: '\\phi', unit: '(°)', min: 10, max: 180, step: 5, val: 120, group: behaviorGroup },
        { id: 'Rp', tex: 'R_{\\mathrm{p}}', unit: '(m)', min: 1.0, max: 30.0, step: 0.5, val: 10.0, group: behaviorGroup },
        { id: 'Rs', tex: 'R_{\\mathrm{s}}', unit: '(m)', min: 0.1, max: 5.0, step: 0.1, val: 1.5, group: behaviorGroup },

        // Sim
        { id: 'v_target', tex: 'v_{\\mathrm{target}}', unit: '(m/s)', min: 1.0, max: 25.0, step: 0.5, val: 8.0, group: simGroup },
        { id: 'Kspeed', tex: 'K_{\\mathrm{speed}}', unit: '(1/s)', min: 0.0, max: 5.0, step: 0.1, val: 1.0, group: simGroup },
        { id: 'Amax', tex: 'a_{\\max}', unit: '(m/s²)', min: 1, max: 100, step: 1, val: 20, group: simGroup },
        { id: 'Vmax', tex: 'v_{\\max}', unit: '(m/s)', min: 5, max: 40, step: 1, val: 20, group: simGroup },
        { id: 'N_birds', tex: 'N', unit: '', min: 10, max: 500, step: 10, val: 150, group: simGroup },
        { id: 'D_bird', tex: 'D_{\\mathrm{bird}}', unit: '(m)', min: 0.1, max: 2.0, step: 0.1, val: 0.5, group: simGroup },
        { id: 'H_domain', tex: 'H', unit: '(m)', min: 50, max: 300, step: 10, val: 150, group: simGroup }

    ];

    const state = {};
    config.forEach(c => {
        state[c.id] = c.val;
        const row = document.createElement('div');
        row.className = 'bf-row';
        row.innerHTML = `<label for="bf-${c.id}"><span class="bf-math" id="bf-${c.id}-label"></span><span class="bf-unit">${c.unit}</span></label>
        <input id="bf-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}">
        <span id="bf-${c.id}-val" class="bf-val">${c.val}</span>`;
        c.group.appendChild(row);
        renderMath(row.querySelector(`#bf-${c.id}-label`), c.tex);
    });

    controls.appendChild(behaviorGroup);
    controls.appendChild(simGroup);
    wrap.appendChild(controls);

    const actionBar = document.createElement('div');
    actionBar.className = 'bf-action-bar';
    const playBtn = document.createElement('button');
    playBtn.className = 'bf-btn';
    playBtn.textContent = 'Pause';
    const restartBtn = document.createElement('button');
    restartBtn.className = 'bf-btn';
    restartBtn.textContent = 'Restart';
    actionBar.appendChild(playBtn);
    actionBar.appendChild(restartBtn);
    wrap.appendChild(actionBar);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'bf-canvas-container';

    const tooltip = document.createElement('div');
    tooltip.className = 'bf-tooltip';
    canvasContainer.appendChild(tooltip);
    canvasContainer.appendChild(canvas);
    wrap.appendChild(canvasContainer);

    const hint = document.createElement('div');
    hint.className = 'bf-hint';
    hint.textContent = '💡 Tip: Drag trees to move/resize; right-click one for details or empty space to add; double-click to remove.';
    wrap.appendChild(hint);

    canvas.className = 'bf-canvas';

    const CANVAS_H = 500;

    function getWDomain() {
        return canvas.clientWidth > 0 ? state.H_domain * (canvas.clientWidth / CANVAS_H) : state.H_domain;
    }

    // --- 2. MATH & TRAJECTORY COMPUTATION ---
    class Bird {
        constructor(pos, vel) {
            this.pos = pos;
            this.vel = vel;
            this.acc = new Vec3();
            // Sign (+1/-1/0) of the sideways nudge used when this bird is
            // heading nearly straight into a wall (see computeRules). Persisted
            // across frames so the tie-break doesn't flip every tick, and reset
            // to 0 once the bird clears the wall.
            this.dodgeSign = 0;
        }
    }

    class Obstacle {
        constructor(pos, radius) {
            this.pos = pos;
            this.radius = radius;

            // Precomputed once (not regenerated every draw call) so the
            // canopy's cluster of lobes has a stable, organic shape across
            // frames instead of jittering. Stored as fractions of the
            // obstacle's radius so the shape scales correctly when resized.
            this.lobes = [];
            const lobeCount = 6 + Math.floor(Math.random() * 3); // 6-8 lobes
            for (let i = 0; i < lobeCount; i++) {
                this.lobes.push({
                    angle: (i / lobeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6,
                    ringFrac: 0.5 + Math.random() * 0.15,
                    sizeFrac: 0.32 + Math.random() * 0.15
                });
            }
        }
    }

    class FlockSimulation {
        constructor() {
            this.birds = [];
            this.obstacles = [];
        }

        init(N, W, H, D_bird, targetSpeed) {
            this.obstacles = [
                new Obstacle(new Vec3(W * 0.3, H * 0.5, 0), H * 0.1),
                new Obstacle(new Vec3(W * 0.7, H * 0.5, 0), H * 0.15)
            ];

            this.birds = [];
            const center = new Vec3(W / 2, H / 2, 0);

            for (let i = 0; i < N; i++) {
                let pos;
                let overlap = true;
                let attempts = 0;
                while (overlap && attempts < 50) {
                    pos = new Vec3(Math.random() * W, Math.random() * H, 0);

                    const birdOverlap = this.birds.some(b => b.pos.dist(pos) < D_bird);
                    const obstacleOverlap = this.obstacles.some(obs => pos.dist(obs.pos) < obs.radius + D_bird / 2);

                    overlap = birdOverlap || obstacleOverlap;
                    attempts++;
                }
                let dir = center.sub(pos);
                if (dir.magSq() === 0) dir = new Vec3(1, 0, 0);
                let vel = dir.normalize().mult(targetSpeed);
                this.birds.push(new Bird(pos, vel));
            }
        }

        computeRules() {
            const cosPhi = Math.cos(state.phi * Math.PI / 180);
            const cellSize = state.Rp;
            const grid = new Map();
            const getGridKey = (v) => `${Math.floor(v.x / cellSize)},${Math.floor(v.y / cellSize)}`;

            this.birds.forEach(b => {
                const k = getGridKey(b.pos);
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(b);
            });

            const offsets = [-1, 0, 1];

            // Below this speed a bird's heading is considered undefined (avoids
            // 0/0 = NaN in the vision-cone test and lets the speed controller
            // recover from a near-standstill instead of stalling forever).
            const MIN_SPEED = 1e-6;

            // Domain walls, treated exactly like circular obstacles: each has
            // an inward normal, and "penetration" is how far past the wall the
            // bird's lookahead point s_i has gone (see below). Hoisted once per
            // call rather than once per bird since W/H don't change per-bird.
            const W_domain = getWDomain();
            const H_domain = state.H_domain;
            const wallNormals = [
                { normal: new Vec3(1, 0, 0), coord: 'x', bound: 0, dir: 1 },   // x = 0 wall
                { normal: new Vec3(-1, 0, 0), coord: 'x', bound: W_domain, dir: -1 }, // x = W wall
                { normal: new Vec3(0, 1, 0), coord: 'y', bound: 0, dir: 1 },   // y = 0 wall
                { normal: new Vec3(0, -1, 0), coord: 'y', bound: H_domain, dir: -1 }  // y = H wall
            ];
            // Threshold below which the tangential (along-wall) speed is
            // considered "flying straight at the wall" and needs a sideways
            // nudge to turn away, rather than just a normal deceleration.
            const TANGENT_EPS = 0.05 * state.v_target;

            // Reused across every candidate of every bird below instead of
            // allocating a fresh Vec3 per candidate. Safe because it's fully
            // overwritten (via subVectors) and read immediately before the
            // next candidate touches it — nothing else ever holds a
            // reference to it. This one change removes the large majority
            // of this function's per-frame allocations, since the neighbor
            // search below runs far more often than anything else in the
            // simulation.
            const scratch = new Vec3();

            for (let i = 0; i < this.birds.length; i++) {
                const bird = this.birds[i];
                // (bird.acc is fully overwritten at the end of this loop
                // body, so there's no need to zero it here first.)

                // Hoisted once per bird instead of once per candidate neighbor.
                const speed = bird.vel.mag();
                const canSense = speed > MIN_SPEED;

                // Single pass over nearby birds: gather the ones inside the
                // perception zone and accumulate cohesion/alignment/separation
                // sums together, instead of building a `neighbors` array and
                // re-iterating it three times. sumPos/sumVel/accS are mutated
                // in place (addSelf/addScaled) rather than reassigned, since
                // each is a fresh, unaliased accumulator for this bird only.
                let neighborCount = 0;
                const sumPos = new Vec3();
                const sumVel = new Vec3();
                const accS = new Vec3();

                if (canSense) {
                    const bx = Math.floor(bird.pos.x / cellSize);
                    const by = Math.floor(bird.pos.y / cellSize);

                    for (let ox of offsets) {
                        for (let oy of offsets) {
                            const cell = grid.get(`${bx + ox},${by + oy}`);
                            if (!cell) continue;
                            for (let other of cell) {
                                if (other === bird) continue;

                                // scratch = other.pos - bird.pos, no allocation.
                                scratch.subVectors(other.pos, bird.pos);
                                const dist = scratch.mag();
                                if (dist === 0 || dist > state.Rp) continue;
                                if (scratch.dot(bird.vel) / (dist * speed) < cosPhi) continue;

                                neighborCount++;
                                sumPos.addSelf(other.pos);
                                sumVel.addSelf(other.vel);

                                const overlap = 2 * state.Rs - dist;
                                if (overlap > 0) {
                                    // (r_i - r_j)/dist == -scratch/dist, so add
                                    // scratch scaled by the negated factor
                                    // instead of allocating a second temporary
                                    // vector for bird.pos.sub(other.pos).
                                    accS.addScaled(scratch, -(state.Ks * overlap / dist));
                                }
                            }
                        }
                    }
                }

                let accC = new Vec3(), accA = new Vec3();
                if (neighborCount > 0) {
                    const avgPos = sumPos.mult(1 / neighborCount);
                    const avgVel = sumVel.mult(1 / neighborCount);

                    accC = avgPos.sub(bird.pos).mult(state.Kc);
                    accA = avgVel.sub(bird.vel).mult(state.Ka);
                }

                let accTarget = new Vec3();
                if (canSense) {
                    accTarget = bird.vel.normalize().mult(state.Kspeed * (state.v_target - speed));
                } else if (state.v_target > 0) {
                    // Bird has (near) zero speed, so its own heading can't be used
                    // to accelerate. Fall back to the cohesion pull if there's a
                    // flock to move toward, otherwise pick an arbitrary heading —
                    // either way this guarantees the bird leaves the stall.
                    const fallbackDir = accC.magSq() > 0 ? accC.normalize() : new Vec3(1, 0, 0);
                    accTarget = fallbackDir.mult(state.Kspeed * state.v_target);
                }

                let accO = new Vec3();
                const s_i = bird.pos.add(bird.vel.mult(state.tau));
                this.obstacles.forEach(obs => {
                    const dVec = s_i.sub(obs.pos);
                    const d_ik = dVec.mag();
                    if (d_ik < obs.radius) {
                        const forceMag = state.Ko * (obs.radius - d_ik);
                        if (d_ik > 0) {
                            accO = accO.add(dVec.mult(forceMag / d_ik));
                        }
                    }
                });

                // Domain boundaries, treated as flat obstacles reusing the same
                // lookahead point s_i and the same Ko stiffness: if s_i has
                // crossed (or is about to cross, within tau) a wall, steer away
                // from it with an acceleration proportional to the crossing
                // depth. This replaces hard velocity reflection as the primary
                // mechanism — reflection now only fires as a rare fallback in
                // applyDomainConstraints() for cases this steering didn't fully
                // resolve in time.
                let wallEngaged = false;
                wallNormals.forEach(wall => {
                    const penetration = wall.dir * (wall.bound - s_i[wall.coord]);
                    if (penetration <= 0) return;
                    wallEngaged = true;

                    accO = accO.add(wall.normal.mult(state.Ko * penetration));

                    // Heading nearly straight at the wall: a normal-only force
                    // decelerates the bird without turning it, so it could hang
                    // at the wall. Nudge it sideways using a sign chosen once
                    // per encounter and held fixed (re-rolling every frame would
                    // just trade wall-jitter for side-to-side jitter).
                    const vTangent = bird.vel.sub(wall.normal.mult(bird.vel.dot(wall.normal)));
                    if (vTangent.mag() < TANGENT_EPS) {
                        if (bird.dodgeSign === 0) bird.dodgeSign = Math.random() < 0.5 ? 1 : -1;
                        const tangentDir = new Vec3(-wall.normal.y, wall.normal.x, 0);
                        accO = accO.add(tangentDir.mult(bird.dodgeSign * state.Ko * penetration));
                    }
                });
                if (!wallEngaged) bird.dodgeSign = 0;

                const totalAcc = accC.add(accA).add(accS).add(accTarget).add(accO);
                bird.acc = totalAcc.limit(state.Amax);
            }
        }

        // Hard safety net only: with the predictive wall steering in
        // computeRules() a bird should essentially never actually reach a
        // wall, but this still clamps position and reflects velocity as a
        // fallback in case it does (e.g. a bird spawned right at the edge, or
        // tau/Ko settings too weak to react in time).
        applyDomainConstraints() {
            const W = getWDomain();
            const H = state.H_domain;
            this.birds.forEach(b => {
                if (b.pos.x < 0) { b.pos.x = 0; b.vel.x *= -1; }
                else if (b.pos.x > W) { b.pos.x = W; b.vel.x *= -1; }

                if (b.pos.y < 0) { b.pos.y = 0; b.vel.y *= -1; }
                else if (b.pos.y > H) { b.pos.y = H; b.vel.y *= -1; }
            });
        }

        update(dt) {
            this.computeRules();

            this.birds.forEach(b => {
                b.vel = b.vel.add(b.acc.mult(dt)).limit(state.Vmax);
                b.pos = b.pos.add(b.vel.mult(dt));
            });

            this.applyDomainConstraints();
        }
    }

    // --- 3. GRAPHICAL RENDERING & INTERACTION (2D) ---
    const ctx = canvas.getContext('2d');
    let playing = true;
    let rafId = null;
    let sim = new FlockSimulation();

    let activeObstacle = null;
    let interactionMode = null;
    let lastMousePos = new Vec3();

    function resize() {
        const rect = canvasContainer.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = rect.width * dpr;
        canvas.height = CANVAS_H * dpr;
        canvas.style.height = CANVAS_H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!playing) draw();
    }

    function worldToCanvas(pos) {
        const scale = CANVAS_H / state.H_domain;
        return {
            x: pos.x * scale,
            y: CANVAS_H - pos.y * scale,
            scale
        };
    }

    function canvasToWorld(cx, cy) {
        const scale = CANVAS_H / state.H_domain;
        return new Vec3(
            cx / scale,
            state.H_domain - cy / scale,
            0
        );
    }

    function draw() {
        const w = canvas.clientWidth;
        const h = CANVAS_H;

        // Clearing a safely larger area fixes the fractional pixel edge artifact bug
        ctx.clearRect(-10, -10, w + 20, h + 20);

        const W = getWDomain();
        const H = state.H_domain;
        const bl = worldToCanvas(new Vec3(0, 0, 0));
        const tr = worldToCanvas(new Vec3(W, H, 0));

        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1; // Explicitly defining to prevent inheritance from the 2px obstacle stroke
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(bl.x, tr.y, tr.x - bl.x, bl.y - tr.y);
        ctx.setLineDash([]);

        sim.obstacles.forEach(obs => {
            const center = worldToCanvas(obs.pos);
            const radius = obs.radius * center.scale;

            ctx.beginPath();
            ctx.arc(center.x, center.y, radius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = '#3e7d4f';
            ctx.fill();

            ctx.beginPath();
            obs.lobes.forEach(lobe => {
                const lx = center.x + Math.cos(lobe.angle) * radius * lobe.ringFrac;
                const ly = center.y + Math.sin(lobe.angle) * radius * lobe.ringFrac;
                ctx.moveTo(lx + radius * lobe.sizeFrac, ly);
                ctx.arc(lx, ly, radius * lobe.sizeFrac, 0, Math.PI * 2);
            });
            ctx.fillStyle = '#4f9d63';
            ctx.fill();

            // Soft highlight toward the upper-left, suggesting a light
            // source (matches most of the reference icons).
            ctx.beginPath();
            ctx.arc(center.x - radius * 0.22, center.y - radius * 0.22, radius * 0.32, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fill();

            // Trunk, dead center — also a visual cue for "grab here to move".
            ctx.beginPath();
            ctx.arc(center.x, center.y, Math.max(2, radius * 0.12), 0, Math.PI * 2);
            ctx.fillStyle = '#5b4530';
            ctx.fill();

            // Resize handle, at the canopy's nominal (non-decorative) edge.
            ctx.beginPath();
            ctx.arc(center.x + radius, center.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#2e6b45';
            ctx.fill();
        });

        ctx.fillStyle = '#2c3e50';
        sim.birds.forEach(b => {
            const renderPos = worldToCanvas(b.pos);
            const size = state.D_bird * renderPos.scale * 2.0;
            const angle = Math.atan2(-b.vel.y, b.vel.x);

            ctx.save();
            ctx.translate(renderPos.x, renderPos.y);
            ctx.rotate(angle);

            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(-size / 2, size / 3);
            ctx.lineTo(-size / 2, -size / 3);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        });
    }

    const MAX_DT = 1 / 20;
    let lastFrameTime = null;

    function tick(now) {
        const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, MAX_DT);
        lastFrameTime = now;

        sim.update(dt);
        draw();
        if (playing) rafId = requestAnimationFrame(tick);
    }

    function setPlaying(val) {
        playing = val;
        playBtn.textContent = playing ? 'Pause' : 'Play';
        if (playing) {
            // Reset so the paused interval isn't counted as elapsed sim time.
            lastFrameTime = null;
            rafId = requestAnimationFrame(tick);
        } else if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function resetSim() {
        sim.init(state.N_birds, getWDomain(), state.H_domain, state.D_bird, state.v_target);
        if (!playing) draw();
    }

    // --- Interaction Listeners ---
    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const worldPos = canvasToWorld(cx, cy);

        activeObstacle = null;
        for (let obs of sim.obstacles) {
            const dist = worldPos.dist(obs.pos);
            const edgeTolerance = state.H_domain * 0.02;
            if (Math.abs(dist - obs.radius) < edgeTolerance) {
                activeObstacle = obs;
                interactionMode = 'resize';
                break;
            } else if (dist < obs.radius) {
                activeObstacle = obs;
                interactionMode = 'move';
                break;
            }
        }

        if (activeObstacle) {
            lastMousePos = worldPos;
            canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!activeObstacle) return;

        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const worldPos = canvasToWorld(cx, cy);

        if (interactionMode === 'move') {
            const delta = worldPos.sub(lastMousePos);
            activeObstacle.pos = activeObstacle.pos.add(delta);
        } else if (interactionMode === 'resize') {
            activeObstacle.radius = worldPos.dist(activeObstacle.pos);
            activeObstacle.radius = Math.max(1.0, activeObstacle.radius);
        }
        lastMousePos = worldPos;

        if (!playing) draw();
    });

    canvas.addEventListener('pointerup', (e) => {
        if (activeObstacle) {
            canvas.releasePointerCapture(e.pointerId);
            activeObstacle = null;
            interactionMode = null;
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const worldPos = canvasToWorld(cx, cy);

        let hit = sim.obstacles.find(obs => worldPos.dist(obs.pos) <= obs.radius);
        if (hit) {
            tooltip.style.left = (cx + 15) + 'px';
            tooltip.style.top = (cy + 15) + 'px';
            tooltip.innerHTML = `Center: (${hit.pos.x.toFixed(1)}, ${hit.pos.y.toFixed(1)})<br>Radius: ${hit.radius.toFixed(1)} m`;
            tooltip.style.opacity = 1;

            setTimeout(() => { tooltip.style.opacity = 0; }, 3000);
        } else {
            // Right-clicking empty space plants a new tree there, at a
            // default size matching the initial obstacles. Safe even right
            // on top of the flock thanks to the Amax/Vmax caps — no special
            // placement/overlap logic needed here, unlike sim.init().
            const defaultRadius = Math.max(2, state.H_domain * 0.07);
            sim.obstacles.push(new Obstacle(worldPos, defaultRadius));
            if (!playing) draw();
        }
    });

    canvas.addEventListener('dblclick', (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const worldPos = canvasToWorld(cx, cy);

        const hit = sim.obstacles.find(obs => worldPos.dist(obs.pos) <= obs.radius);
        if (hit) {
            sim.obstacles = sim.obstacles.filter(obs => obs !== hit);
            activeObstacle = null;
            interactionMode = null;
            tooltip.style.opacity = 0;
            if (!playing) draw();
        }
    });

    playBtn.addEventListener('click', () => setPlaying(!playing));
    restartBtn.addEventListener('click', resetSim);

    config.forEach(c => {
        const input = document.getElementById(`bf-${c.id}`);
        const valSpan = document.getElementById(`bf-${c.id}-val`);
        input.addEventListener('input', () => {
            state[c.id] = parseFloat(input.value);
            valSpan.textContent = state[c.id];

            if (c.id === 'N_birds' || c.id === 'H_domain') {
                resetSim();
            }
        });
    });

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvasContainer);

    resize();
    resetSim();
    setPlaying(true);
}