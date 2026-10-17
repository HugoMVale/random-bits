import { Vector } from './numeric-js/linalg.js';
import { renderMath } from './katex-render.js';

const canvas = document.getElementById('traffic-flow-discrete');

if (canvas) {
    // --- 1. UI & STYLING SETUP ---
    const style = document.createElement('style');
    style.textContent = `
    .tf-wrap { font-family: inherit; margin: 1.5rem 0; }
    .tf-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem; font-size: 0.85rem; padding: 1rem; background: var(--code-bg, #f5f5f5); border: 1px solid var(--border, #ccc); border-radius: 6px; align-items: start; }
    .tf-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .tf-group-title { font-weight: bold; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border, #ccc); padding-bottom: 0.25rem; }
    .tf-row { display: grid; grid-template-columns: 90px 1fr 50px; align-items: center; gap: 0.5rem; }
    .tf-row label { white-space: nowrap; display: flex; align-items: baseline; gap: 0.3rem; }
    .tf-row input[type="range"] { width: 100%; margin: 0; cursor: pointer; }
    .tf-val { text-align: right; font-variant-numeric: tabular-nums; }
    .tf-canvas-container { position: relative; width: 100%; border: 1px solid var(--border, #ccc); border-radius: 6px; overflow: hidden; touch-action: none; background: #eef2f5; }
    .tf-canvas { width: 100%; display: block; cursor: default; }
    .tf-action-bar { display: flex; justify-content: center; align-items: center; gap: 2rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .tf-btn { cursor: pointer; padding: 0.4rem 1.5rem; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--code-bg, #f5f5f5); font-weight: bold; }
    .tf-btn:hover { background: var(--tag-border, #e0e0e0); }
    .tf-hint { text-align: center; font-size: 0.85rem; margin-top: 0.5rem; color: #666; }
    .tf-tooltip { position: absolute; background: rgba(0,0,0,0.8); color: #fff; padding: 8px 12px; border-radius: 4px; font-size: 0.85rem; pointer-events: none; opacity: 0; transition: opacity 0.1s; white-space: nowrap; font-family: monospace; z-index: 10; text-align: center; }
  `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'tf-wrap';
    canvas.parentNode.insertBefore(wrap, canvas);

    const controls = document.createElement('div');
    controls.className = 'tf-controls';

    const behaviorGroup = document.createElement('div');
    behaviorGroup.className = 'tf-group';
    behaviorGroup.innerHTML = `<div class="tf-group-title">Driver Behavior (IDM)</div>`;

    const simGroup = document.createElement('div');
    simGroup.className = 'tf-group';
    simGroup.innerHTML = `<div class="tf-group-title">Road & Vehicles</div>`;

    const config = [
        // Behavior (IDM Parameters)
        {
            id: 'A',
            tex: 'A',
            unit: '(m/s²)',
            min: 0.1,
            max: 5.0,
            step: 0.1,
            val: 1.5,
            group: behaviorGroup,
        },
        {
            id: 'B',
            tex: 'B',
            unit: '(m/s²)',
            min: 0.1,
            max: 5.0,
            step: 0.1,
            val: 2.0,
            group: behaviorGroup,
        },
        // Changed V to display km/h (108 km/h = 30 m/s)
        {
            id: 'V',
            tex: 'V',
            unit: '(km/h)',
            min: 10.0,
            max: 150.0,
            step: 1.0,
            val: 108.0,
            group: behaviorGroup,
        },
        {
            id: 'S0',
            tex: 'S_0',
            unit: '(m)',
            min: 1.0,
            max: 10.0,
            step: 0.5,
            val: 2.0,
            group: behaviorGroup,
        },
        {
            id: 'S1',
            tex: 'S_1',
            unit: '(m)',
            min: 0.0,
            max: 10.0,
            step: 0.5,
            val: 0.0,
            group: behaviorGroup,
        },
        {
            id: 'tau',
            tex: '\\tau',
            unit: '(s)',
            min: 0.1,
            max: 3.0,
            step: 0.1,
            val: 1.0,
            group: behaviorGroup,
        },
        {
            id: 'delta',
            tex: '\\delta',
            unit: '',
            min: 1.0,
            max: 8.0,
            step: 1.0,
            val: 4.0,
            group: behaviorGroup,
        },

        // Sim & Environment
        {
            id: 'density',
            tex: 'N/L',
            unit: '(#/km)',
            min: 5,
            max: 100,
            step: 1,
            val: 25,
            group: simGroup,
        },
        {
            id: 'ell',
            tex: '\\ell',
            unit: '(m)',
            min: 1.0,
            max: 20.0,
            step: 1.0,
            val: 2.0,
            group: simGroup,
        },
    ];

    // The road is a fixed-length ring; only the vehicle density is adjustable.
    const ROAD_LENGTH_M = 1000;

    const state = {};
    config.forEach((c) => {
        // Convert initial V value from km/h to m/s for internal physics
        if (c.id === 'V') {
            state[c.id] = c.val / 3.6;
        } else {
            state[c.id] = c.val;
        }

        const row = document.createElement('div');
        row.className = 'tf-row';
        row.innerHTML = `<label for="tf-${c.id}"><span class="tf-math" id="tf-${c.id}-label"></span><span class="tf-unit">${c.unit}</span></label>
        <input id="tf-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}">
        <span id="tf-${c.id}-val" class="tf-val">${c.val}</span>`;
        c.group.appendChild(row);
        renderMath(row.querySelector(`#tf-${c.id}-label`), c.tex);
    });

    state.L = ROAD_LENGTH_M;

    /**
     * Derives the actual vehicle count from the chosen density (state.density,
     * in #/km) and clamps it so that N * ell <= L, i.e. bumper-to-bumper
     * packing never exceeds the road's physical capacity.
     * @returns {number} The effective (possibly clamped) vehicle count.
     */
    function updateVehicleCount() {
        const desired = Math.round(state.density * (state.L / 1000));
        const maxN = Math.max(1, Math.floor(state.L / state.ell));
        state.N = Math.min(desired, maxN);
        return state.N;
    }
    updateVehicleCount();

    controls.appendChild(behaviorGroup);
    controls.appendChild(simGroup);
    wrap.appendChild(controls);

    const actionBar = document.createElement('div');
    actionBar.className = 'tf-action-bar';
    const playBtn = document.createElement('button');
    playBtn.className = 'tf-btn';
    playBtn.textContent = 'Pause';
    const restartBtn = document.createElement('button');
    restartBtn.className = 'tf-btn';
    restartBtn.textContent = 'Restart';
    actionBar.appendChild(playBtn);
    actionBar.appendChild(restartBtn);
    wrap.appendChild(actionBar);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'tf-canvas-container';

    const tooltip = document.createElement('div');
    tooltip.className = 'tf-tooltip';
    canvasContainer.appendChild(tooltip);
    canvasContainer.appendChild(canvas);
    wrap.appendChild(canvasContainer);

    const hint = document.createElement('div');
    hint.className = 'tf-hint';
    hint.textContent =
        '💡 Tip: Hover over a vehicle to see its state. Left-click and drag a vehicle to manually adjust its position along the road.';
    wrap.appendChild(hint);

    canvas.className = 'tf-canvas';
    const CANVAS_H = 500;

    // --- 2. MATH & TRAJECTORY COMPUTATION ---
    class TrafficSimulation {
        constructor() {
            this.pos = new Vector(0);
            this.vel = new Vector(0);
            this.acc = new Vector(0);
            this.gap = new Vector(0);
            this.N = 0;
            this.L = 0;
        }

        init(N, L, V0) {
            this.N = N;
            this.L = L;
            this.pos = new Vector(N);
            this.vel = new Vector(N);
            this.acc = new Vector(N);
            this.gap = new Vector(N);

            const spacing = L / N;
            for (let i = 0; i < N; i++) {
                this.pos.data[i] = L - (i + 1) * spacing;
                this.vel.data[i] = V0 * (0.8 + 0.2 * Math.random());
            }
        }

        computeAccelerations() {
            for (let i = 0; i < this.N; i++) {
                const lead = i === 0 ? this.N - 1 : i - 1;

                const xi = this.pos.data[i];
                const vi = this.vel.data[i];
                const x_lead = this.pos.data[lead];
                const v_lead = this.vel.data[lead];

                let s = x_lead - xi;
                while (s <= 0) s += this.L;
                s -= state.ell;
                this.gap.data[i] = s; // actual gap s_i, before the numerical floor below
                s = Math.max(s, 0.1);

                const delta_v = vi - v_lead;

                const s_star =
                    state.S0 +
                    state.S1 * Math.sqrt(vi / state.V) +
                    state.tau * vi +
                    (vi * delta_v) / (2 * Math.sqrt(state.A * state.B));

                const safe_s_star = Math.max(s_star, state.S0);

                const a_free = 1 - Math.pow(vi / state.V, state.delta);
                const a_int = -Math.pow(safe_s_star / s, 2);

                this.acc.data[i] = state.A * (a_free + a_int);
            }
        }

        update(dt, activeId = null) {
            // Trick the IDM: make the dragged car's velocity match the follower's
            if (activeId !== null) {
                const follow = activeId === this.N - 1 ? 0 : activeId + 1;
                this.vel.data[activeId] = this.vel.data[follow];
            }

            this.computeAccelerations();

            for (let i = 0; i < this.N; i++) {
                if (i === activeId) continue; // Skip physics for dragged car

                this.vel.data[i] += this.acc.data[i] * dt;

                if (this.vel.data[i] < 0) {
                    this.vel.data[i] = 0;
                }

                this.pos.data[i] += this.vel.data[i] * dt;

                if (this.pos.data[i] >= this.L) {
                    this.pos.data[i] -= this.L;
                } else if (this.pos.data[i] < 0) {
                    this.pos.data[i] += this.L;
                }
            }
        }
    }

    // --- 3. GRAPHICAL RENDERING & INTERACTION ---
    const ctx = canvas.getContext('2d');
    let playing = true;
    let rafId = null;
    let sim = new TrafficSimulation();

    let activeVehicle = null;
    let hoveredVehicle = null;

    function resize() {
        const rect = canvasContainer.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = rect.width * dpr;
        canvas.height = CANVAS_H * dpr;
        canvas.style.height = CANVAS_H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!playing) draw();
    }

    function getRoadParams() {
        const cx = canvas.clientWidth / 2;
        const cy = CANVAS_H / 2;
        const R = Math.min(cx, cy) * 0.8;
        return { cx, cy, R };
    }

    function getPosFromAngle(angle) {
        let normalizedAngle = angle;
        if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
        return (normalizedAngle / (2 * Math.PI)) * state.L;
    }

    function draw() {
        const w = canvas.clientWidth;
        const h = CANVAS_H;
        ctx.clearRect(-10, -10, w + 20, h + 20);

        const { cx, cy, R } = getRoadParams();

        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 2 * Math.PI);
        ctx.lineWidth = 24;
        ctx.strokeStyle = '#95a5a6';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, R + 12, 0, 2 * Math.PI);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#bdc3c7';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, R - 12, 0, 2 * Math.PI);
        ctx.stroke();

        // Scale the sprite to the *actual* vehicle length (state.ell, in
        // meters) using the same meters-to-pixels ratio as the road itself,
        // so sprites only visually touch when the real gap approaches zero
        // — not sooner, regardless of density (N/L) or road radius (R).
        const pxPerMeter = (2 * Math.PI * R) / state.L;
        const carVisLength = Math.max(6, state.ell * pxPerMeter);
        const carVisWidth = Math.max(3, Math.min(14, carVisLength * 0.5));

        for (let i = 0; i < sim.N; i++) {
            const x = sim.pos.data[i];
            const angle = (x / state.L) * 2 * Math.PI - Math.PI / 2;

            const px = cx + R * Math.cos(angle);
            const py = cy + R * Math.sin(angle);

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(angle);

            const isHovered = hoveredVehicle === i;
            const isActive = activeVehicle === i;

            ctx.fillStyle = isActive ? '#e74c3c' : isHovered ? '#f1c40f' : '#2c3e50';
            ctx.beginPath();
            ctx.roundRect(-carVisWidth / 2, -carVisLength / 2, carVisWidth, carVisLength, 2);
            ctx.fill();

            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(
                -carVisWidth / 2 + 1,
                0,
                carVisWidth - 2,
                Math.max(0, carVisLength / 2 - 2),
            );

            if (sim.acc.data[i] < -0.5) {
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(-carVisWidth / 2 + 1, -carVisLength / 2, carVisWidth - 2, 2);
            }

            ctx.restore();
        }
    }

    const MAX_DT = 1 / 20;
    let lastFrameTime = null;

    function tick(now) {
        const dt = lastFrameTime === null ? 1 / 60 : Math.min((now - lastFrameTime) / 1000, MAX_DT);
        lastFrameTime = now;

        sim.update(dt, activeVehicle); // Passing activeVehicle here
        draw();

        if (hoveredVehicle !== null && !activeVehicle) {
            updateTooltip(hoveredVehicle);
        }

        if (playing) rafId = requestAnimationFrame(tick);
    }

    function updateTooltip(index) {
        const { cx, cy } = getRoadParams();
        const x = sim.pos.data[index];
        const v = sim.vel.data[index];
        const a = sim.acc.data[index];
        const gap = sim.gap.data[index];

        // Centering the tooltip neatly in the middle of the track
        tooltip.style.left = cx + 'px';
        tooltip.style.top = cy + 'px';
        tooltip.style.transform = 'translate(-50%, -50%)';

        tooltip.innerHTML = `<span style="color: #f1c40f;">Vehicle ${index}</span><br>Pos: ${x.toFixed(1)} m<br>Vel: ${(v * 3.6).toFixed(1)} km/h<br>Acc: ${a.toFixed(2)} m/s²<br>Gap: ${gap.toFixed(1)} m`;
        tooltip.style.opacity = 1;
    }

    function setPlaying(val) {
        playing = val;
        playBtn.textContent = playing ? 'Pause' : 'Play';
        if (playing) {
            lastFrameTime = null;
            rafId = requestAnimationFrame(tick);
        } else if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function resetSim() {
        sim.init(state.N, state.L, state.V * 0.5);
        if (!playing) draw();
    }

    // --- Interaction Listeners ---
    function getMouseAngleAndDist(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const { cx, cy } = getRoadParams();

        const dx = mx - cx;
        const dy = my - cy;

        let angle = Math.atan2(dx, -dy);
        if (angle < 0) angle += 2 * Math.PI;

        const dist = Math.sqrt(dx * dx + dy * dy);
        return { angle, dist };
    }

    function getClosestVehicle(angle, dist) {
        const { R } = getRoadParams();
        if (Math.abs(dist - R) > 30) return null;

        const targetPos = getPosFromAngle(angle);
        let closest = null;
        let minDist = Infinity;

        for (let i = 0; i < sim.N; i++) {
            let d = Math.abs(sim.pos.data[i] - targetPos);
            d = Math.min(d, state.L - d);
            if (d < minDist && d < state.L * 0.05) {
                minDist = d;
                closest = i;
            }
        }
        return closest;
    }

    canvas.addEventListener('pointermove', (e) => {
        const { angle, dist } = getMouseAngleAndDist(e);

        if (activeVehicle !== null) {
            let newPos = getPosFromAngle(angle);
            let oldPos = sim.pos.data[activeVehicle];

            // Calculate shortest path delta on the circular track
            let delta = newPos - oldPos;
            if (delta > state.L / 2) delta -= state.L;
            if (delta < -state.L / 2) delta += state.L;

            // Prevent passing the leader or follower to maintain array sequence
            const lead = activeVehicle === 0 ? sim.N - 1 : activeVehicle - 1;
            const follow = activeVehicle === sim.N - 1 ? 0 : activeVehicle + 1;

            let distLead = sim.pos.data[lead] - oldPos;
            if (distLead < 0) distLead += state.L;

            let distFollow = oldPos - sim.pos.data[follow];
            if (distFollow < 0) distFollow += state.L;

            // Calculate min/max drag boundaries with a 1.0m safety margin
            let maxDelta = Math.max(0, distLead - state.ell - 1.0);
            let minDelta = -Math.max(0, distFollow - state.ell - 1.0);

            delta = Math.max(minDelta, Math.min(maxDelta, delta));

            // Apply constrained movement
            sim.pos.data[activeVehicle] = (oldPos + delta + state.L) % state.L;

            if (!playing) draw();
        } else {
            const hit = getClosestVehicle(angle, dist);
            if (hit !== hoveredVehicle) {
                hoveredVehicle = hit;
                if (hit === null) {
                    tooltip.style.opacity = 0;
                }
                if (!playing) draw();
            }
        }
    });

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const { angle, dist } = getMouseAngleAndDist(e);
        const hit = getClosestVehicle(angle, dist);

        if (hit !== null) {
            activeVehicle = hit;
            canvas.setPointerCapture(e.pointerId);
            e.preventDefault();
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        if (activeVehicle !== null) {
            canvas.releasePointerCapture(e.pointerId);
            activeVehicle = null;
        }
    });

    canvas.addEventListener('pointerleave', () => {
        hoveredVehicle = null;
        tooltip.style.opacity = 0;
        if (!playing) draw();
    });

    playBtn.addEventListener('click', () => setPlaying(!playing));
    restartBtn.addEventListener('click', resetSim);

    config.forEach((c) => {
        const input = document.getElementById(`tf-${c.id}`);
        const valSpan = document.getElementById(`tf-${c.id}-val`);
        input.addEventListener('input', () => {
            let rawVal = parseFloat(input.value);
            if (c.id === 'V') {
                state[c.id] = rawVal / 3.6;
            } else {
                state[c.id] = rawVal;
            }

            if (c.id === 'density' || c.id === 'ell') {
                // Both the density slider and the vehicle-length slider affect
                // how many vehicles actually fit: N * ell <= L is enforced here.
                const prevN = state.N;
                updateVehicleCount();

                if (c.id === 'density') {
                    // Show the effective (possibly capacity-clamped) count
                    // rather than the raw, potentially infeasible, slider value.
                    valSpan.textContent = state.N;
                } else {
                    valSpan.textContent = rawVal;
                    // A change in vehicle length can clamp N too, so refresh
                    // the density readout to stay consistent.
                    document.getElementById('tf-density-val').textContent = state.N;
                }

                if (state.N !== prevN) {
                    resetSim();
                } else if (!playing) {
                    draw();
                }
            } else {
                valSpan.textContent = rawVal;
            }
        });
    });

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvasContainer);

    resize();
    resetSim();
    setPlaying(true);
}
