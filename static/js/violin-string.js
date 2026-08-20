/**
 * violin-string.js
 *
 * Interactive simulation of a damped, driven vibrating string for the
 * "Waves Under Tension" blog post.
 *
 * Discretizes the string into N points and integrates the damped wave
 * equation with velocity Verlet, including a velocity-proportional damping
 * term and, in Bow Mode, a Stribeck-type friction force applied at an
 * adjustable bow position (computed from the relative velocity between the
 * bow and the string). String parameters (length, tension, linear density,
 * damping) and bow parameters (bow velocity, normal force, static/dynamic
 * friction coefficients, velocity scale) are all adjustable via sliders,
 * along with a visual gain control to exaggerate small displacements.
 *
 * In Pluck Mode, clicking and dragging on the string sets a triangular
 * initial displacement and releases it to vibrate and decay. In Bow Mode,
 * dragging horizontally moves the bow position, continuously driving the
 * string. The wave speed c and fundamental frequency f are recomputed and
 * displayed whenever the string parameters change.
 */

import { createVelocityVerlet } from './math/verlet.js';
import { renderMath } from './math/katex-render.js';

const canvas = document.getElementById('violin-string');

if (canvas) {
    const style = document.createElement('style');
    style.textContent = `
    .vs-wrap { font-family: inherit; margin: 1.5rem 0; }
    .vs-mode-selector { display: flex; justify-content: center; gap: 2rem; margin-bottom: 1rem; font-size: 1rem; font-weight: bold; }
    .vs-mode-selector label { cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
    .vs-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 1rem; font-size: 0.85rem; padding: 1rem; background: var(--code-bg, #f5f5f5); border: 1px solid var(--border, #ccc); border-radius: 6px; align-items: start; }
    .vs-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .vs-group-title { font-weight: bold; margin-bottom: 0.25rem; border-bottom: 1px solid var(--border, #ccc); padding-bottom: 0.25rem; }
    .vs-row { display: grid; grid-template-columns: 80px 1fr 40px; align-items: center; gap: 0.5rem; }
    .vs-row label { white-space: nowrap; display: flex; align-items: baseline; gap: 0.3rem; }
    .vs-row input[type="range"] { width: 100%; margin: 0; cursor: pointer; }
    .vs-val { text-align: right; font-variant-numeric: tabular-nums; }
    .vs-displays { display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 0.95rem; justify-content: center; }
    .vs-unit { font-style: normal; }
    .vs-row .katex, .vs-displays .katex { font-size: 1.05em; }
    .vs-canvas-container { position: relative; width: 100%; border: 1px solid var(--border, #ccc); border-radius: 6px; overflow: hidden; touch-action: none; background: #fff; }
    .vs-canvas { width: 100%; display: block; cursor: crosshair; }
    .vs-action-bar { display: none; justify-content: center; align-items: center; gap: 2rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .vs-play-btn { cursor: pointer; padding: 0.4rem 1.5rem; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--code-bg, #f5f5f5); font-weight: bold; }
    .vs-play-btn:hover { background: var(--tag-border, #e0e0e0); }
    .vs-mag-control { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .vs-time-display { position: absolute; top: 10px; right: 15px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.85rem; color: #555; background: rgba(255, 255, 255, 0.8); padding: 0.2rem 0.5rem; border-radius: 4px; pointer-events: none; border: 1px solid #ddd; }
    .vs-hint { text-align: center; font-size: 0.85rem; margin-top: 0.5rem; }
  `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'vs-wrap';
    canvas.parentNode.insertBefore(wrap, canvas);

    const modeWrap = document.createElement('div');
    modeWrap.className = 'vs-mode-selector';
    modeWrap.innerHTML = `
        <label><input type="radio" name="vs-mode" value="pluck" checked> Pluck Mode</label>
        <label><input type="radio" name="vs-mode" value="bow"> Bow Mode</label>
    `;
    wrap.appendChild(modeWrap);

    const controls = document.createElement('div');
    controls.className = 'vs-controls';

    const stringGroup = document.createElement('div');
    stringGroup.className = 'vs-group';
    stringGroup.innerHTML = `<div class="vs-group-title">String Parameters</div>`;

    const bowGroup = document.createElement('div');
    bowGroup.className = 'vs-group';
    bowGroup.style.display = 'none';
    bowGroup.innerHTML = `<div class="vs-group-title">Bow Parameters</div>`;

    const config = [
        { id: 'L', tex: 'L', unit: '(m)', min: 0.1, max: 1.0, step: 0.01, val: 0.33, group: stringGroup },
        { id: 'T', tex: 'T', unit: '(N)', min: 10, max: 100, step: 1, val: 50, group: stringGroup },
        { id: 'rho', tex: '\\rho', unit: '(kg/m)', min: 0.0001, max: 0.01, step: 0.0001, val: 0.0006, group: stringGroup },
        { id: 'gamma', tex: '\\gamma', unit: '(1/s)', min: 0, max: 10, step: 0.01, val: 2.0, group: stringGroup },
        { id: 'v_bow', tex: 'v_{\\mathrm{bow}}', unit: '(m/s)', min: -0.5, max: 0.5, step: 0.01, val: 0.15, group: bowGroup },
        { id: 'F_N', tex: 'F_N', unit: '(N)', min: 0, max: 2, step: 0.01, val: 0.5, group: bowGroup },
        { id: 'mu_d', tex: '\\mu_d', unit: '(-)', min: 0, max: 1.0, step: 0.01, val: 0.3, group: bowGroup },
        { id: 'mu_s', tex: '\\mu_s', unit: '(-)', min: 0, max: 2.0, step: 0.01, val: 1.0, group: bowGroup },
        { id: 'v_scale', tex: 'v_{\\mathrm{scale}}', unit: '(m/s)', min: 0.01, max: 0.2, step: 0.01, val: 0.03, group: bowGroup }
    ];

    const EPSILON = 0.01;

    const state = { mag_exp: 2.0 };
    const inputs = {};
    const vals = {};

    config.forEach(c => {
        state[c.id] = c.val;
        const row = document.createElement('div');
        row.className = 'vs-row';
        row.innerHTML = `<label for="vs-${c.id}"><span class="vs-math" id="vs-${c.id}-label"></span><span class="vs-unit">${c.unit}</span></label>
        <input id="vs-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}">
        <span id="vs-${c.id}-val" class="vs-val">${c.val}</span>`;
        c.group.appendChild(row);
        renderMath(row.querySelector(`#vs-${c.id}-label`), c.tex);
    });

    controls.appendChild(stringGroup);
    controls.appendChild(bowGroup);
    wrap.appendChild(controls);

    const displays = document.createElement('div');
    displays.className = 'vs-displays';
    displays.innerHTML = `
        <div><span class="vs-math" id="vs-c-label"></span> = <span id="vs-c-val"></span> <span class="vs-unit">m/s</span></div>
        <div><span class="vs-math" id="vs-f-label"></span> = <span id="vs-f-val"></span> <span class="vs-unit">Hz</span></div>
    `;
    wrap.appendChild(displays);
    renderMath(document.getElementById('vs-c-label'), 'c');
    renderMath(document.getElementById('vs-f-label'), 'f');

    const actionBar = document.createElement('div');
    actionBar.className = 'vs-action-bar';

    const playBtn = document.createElement('button');
    playBtn.className = 'vs-play-btn';
    playBtn.textContent = 'Pause';
    actionBar.appendChild(playBtn);

    const magControl = document.createElement('div');
    magControl.className = 'vs-mag-control';
    magControl.innerHTML = `
        <label for="vs-mag_exp">Visual Gain (<span class="vs-math" id="vs-mag-label"></span>):</label>
        <input id="vs-mag_exp" type="range" min="0" max="4" step="0.1" value="${state.mag_exp}">
        <span id="vs-mag_exp-val" class="vs-val" style="width: 25px;">${state.mag_exp}</span>
    `;
    actionBar.appendChild(magControl);
    wrap.appendChild(actionBar);

    renderMath(magControl.querySelector('#vs-mag-label'), '\\log_{10}');

    const magInput = document.getElementById('vs-mag_exp');
    const magValSpan = document.getElementById('vs-mag_exp-val');
    magInput.addEventListener('input', () => {
        state.mag_exp = parseFloat(magInput.value);
        magValSpan.textContent = state.mag_exp.toFixed(1);
        if (!playing) draw();
    });

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'vs-canvas-container';

    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'vs-time-display';
    timeDisplay.textContent = '0.00 s';
    canvasContainer.appendChild(timeDisplay);

    canvasContainer.appendChild(canvas);
    wrap.appendChild(canvasContainer);

    const hint = document.createElement('div');
    hint.className = 'vs-hint';
    wrap.appendChild(hint);

    function updateHint() {
        hint.textContent = mode === 'bow'
            ? '💡 Tip: Drag left or right on the string to move the bow.'
            : '💡 Tip: Click and drag on the string to pluck it.';
    }

    canvas.className = 'vs-canvas';

    const ctx = canvas.getContext('2d');
    const N = 80;
    const CANVAS_H = 250;
    const X_MARGIN = 20;

    let mode = 'pluck';
    let dx, dt, c, integrator;
    let u, v, a, aNext;
    let playing = false;
    let rafId = null;
    let timeAccumulator = 0;
    let simTimeElapsed = 0;
    let x_bow = state.L * 0.75;
    let isDragging = false;
    let isPlucking = false;

    modeWrap.addEventListener('change', (e) => {
        mode = e.target.value;
        bowGroup.style.display = mode === 'bow' ? 'flex' : 'none';

        actionBar.style.display = mode === 'bow' ? 'flex' : 'none';
        updateHint();

        simTimeElapsed = 0;
        timeDisplay.textContent = '0.00 s';

        if (mode === 'pluck') {
            u.fill(0);
            v.fill(0);
            a.fill(0);
            setPlaying(false);
        } else {
            setPlaying(true);
        }
        if (!playing) draw();
    });

    function updateDisplays() {
        c = Math.sqrt(state.T / state.rho);
        const f = c / (2 * state.L);
        document.getElementById('vs-c-val').textContent = c.toFixed(1);
        document.getElementById('vs-f-val').textContent = f.toFixed(1);
    }

    function computeAcceleration(uArr, vArr, aOut) {
        const c2 = state.T / state.rho;
        const dx2 = dx * dx;
        const coeff = c2 / dx2;
        const damp = state.gamma;

        for (let i = 0; i < N; i++) {
            const left = i === 0 ? 0 : uArr[i - 1];
            const right = i === N - 1 ? 0 : uArr[i + 1];
            aOut[i] = coeff * (left - 2 * uArr[i] + right) - damp * v[i];
        }

        if (mode === 'bow') {
            const bow_pos = x_bow / dx - 1;
            const idx = Math.floor(bow_pos);
            const t = bow_pos - idx;

            let v_string_at_bow = 0;
            if (idx >= 0 && idx < N) v_string_at_bow += (1 - t) * v[idx];
            if (idx + 1 >= 0 && idx + 1 < N) v_string_at_bow += t * v[idx + 1];

            const v_rel = state.v_bow - v_string_at_bow;
            const F_bow = state.F_N * (state.mu_d + (state.mu_s - state.mu_d) * Math.exp(-Math.abs(v_rel) / state.v_scale)) * Math.tanh(v_rel / EPSILON);
            const force_term = F_bow / (state.rho * dx);

            if (idx >= 0 && idx < N) aOut[idx] += force_term * (1 - t);
            if (idx + 1 >= 0 && idx + 1 < N) aOut[idx + 1] += force_term * t;
        }
    }

    function setupGrid() {
        dx = state.L / (N + 1);
        c = Math.sqrt(state.T / state.rho);
        const dtCFL = dx / c;
        dt = 0.5 * dtCFL;

        if (!u) {
            u = new Float64Array(N);
            v = new Float64Array(N);
            a = new Float64Array(N);
            aNext = new Float64Array(N);
        }

        x_bow = Math.min(x_bow, state.L * 0.99);
        integrator = createVelocityVerlet(computeAcceleration);
        computeAcceleration(u, v, a);
        updateDisplays();
    }

    function resize() {
        const rect = canvasContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = CANVAS_H * dpr;
        canvas.style.height = CANVAS_H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw();
    }

    function draw() {
        const w = canvas.clientWidth;
        const h = CANVAS_H;
        const midY = h / 2;
        const plotW = w - 2 * X_MARGIN;

        const trueScale = plotW / state.L;
        const magnification = mode === 'bow' ? Math.pow(10, state.mag_exp) : 1.0;
        const displayScale = trueScale * magnification;

        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = '#ccc';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(X_MARGIN, midY);
        ctx.lineTo(w - X_MARGIN, midY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(X_MARGIN, midY);
        for (let i = 0; i < N; i++) {
            const x = X_MARGIN + (plotW * (i + 1)) / (N + 1);
            const y = midY - u[i] * displayScale;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w - X_MARGIN, midY);
        ctx.stroke();

        if (mode === 'bow') {
            const bowX = X_MARGIN + (x_bow / state.L) * plotW;
            ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
            ctx.fillRect(bowX - 10, midY - 60, 20, 120);

            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(bowX, midY - 60);
            ctx.lineTo(bowX, midY + 60);
            ctx.stroke();

            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            if (state.v_bow > 0) {
                ctx.moveTo(bowX - 6, midY - 70);
                ctx.lineTo(bowX + 6, midY - 70);
                ctx.lineTo(bowX, midY - 80);
            } else if (state.v_bow < 0) {
                ctx.moveTo(bowX - 6, midY + 70);
                ctx.lineTo(bowX + 6, midY + 70);
                ctx.lineTo(bowX, midY + 80);
            }
            ctx.fill();
        }

        ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.arc(X_MARGIN, midY, 4, 0, Math.PI * 2);
        ctx.arc(w - X_MARGIN, midY, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function updateBowFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const w = rect.width;
        const plotW = w - 2 * X_MARGIN;
        const normX = Math.max(0, Math.min(1, (x - X_MARGIN) / plotW));
        x_bow = normX * state.L;
        x_bow = Math.max(0.01 * state.L, Math.min(0.99 * state.L, x_bow));
        if (!playing) draw();
    }

    function updatePluckFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const w = rect.width;
        const midY = CANVAS_H / 2;
        const plotW = w - 2 * X_MARGIN;

        const trueScale = plotW / state.L;

        const normX = Math.max(0.01, Math.min(0.99, (x - X_MARGIN) / plotW));
        const x_pluck = normX * state.L;
        let y_pluck = (midY - y) / trueScale;

        const max_visual_pluck = (midY - 10) / trueScale;
        const max_physical_pluck = state.L * 0.05;
        const max_pluck = Math.min(max_visual_pluck, max_physical_pluck);
        y_pluck = Math.max(-max_pluck, Math.min(y_pluck, max_pluck));

        for (let i = 0; i < N; i++) {
            const pos = (i + 1) * dx;
            if (pos <= x_pluck) {
                u[i] = y_pluck * (pos / x_pluck);
            } else {
                u[i] = y_pluck * ((state.L - pos) / (state.L - x_pluck));
            }
            v[i] = 0;
        }
        computeAcceleration(u, v, a);
        draw();
    }

    canvas.addEventListener('pointerdown', (e) => {
        simTimeElapsed = 0;
        timeDisplay.textContent = '0.00 s';
        if (mode === 'bow') {
            isDragging = true;
            updateBowFromEvent(e);
        } else {
            isPlucking = true;
            setPlaying(false);
            updatePluckFromEvent(e);
        }
        canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (mode === 'bow' && isDragging) {
            updateBowFromEvent(e);
        } else if (mode === 'pluck' && isPlucking) {
            updatePluckFromEvent(e);
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        if (mode === 'bow') {
            isDragging = false;
        } else if (mode === 'pluck' && isPlucking) {
            isPlucking = false;
            simTimeElapsed = 0;
            setPlaying(true);
        }
        canvas.releasePointerCapture(e.pointerId);
    });

    function tick() {
        const SIM_TIME_PER_FRAME = 1 / 60;
        timeAccumulator += SIM_TIME_PER_FRAME;
        let steps = 0;
        const maxSteps = 2500;

        while (timeAccumulator >= dt && steps < maxSteps) {
            integrator({ u, v, a, aNext }, dt);
            timeAccumulator -= dt;
            simTimeElapsed += dt;
            steps++;
        }

        if (steps >= maxSteps) timeAccumulator = 0;

        timeDisplay.textContent = simTimeElapsed.toFixed(2) + ' s';
        draw();

        if (mode === 'pluck' && simTimeElapsed >= 10) {
            setPlaying(false);
        }

        if (playing) rafId = requestAnimationFrame(tick);
    }

    function setPlaying(val) {
        playing = val;
        playBtn.textContent = playing ? 'Pause' : 'Play';
        if (playing) {
            timeAccumulator = 0;
            rafId = requestAnimationFrame(tick);
        } else if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    playBtn.addEventListener('click', () => setPlaying(!playing));

    config.forEach(c => {
        const input = document.getElementById(`vs-${c.id}`);
        const valSpan = document.getElementById(`vs-${c.id}-val`);
        inputs[c.id] = input;
        vals[c.id] = valSpan;

        input.addEventListener('input', () => {
            state[c.id] = parseFloat(input.value);
            valSpan.textContent = state[c.id];

            if (c.id === 'L' || c.id === 'T' || c.id === 'rho') {
                setupGrid();
            }
            if (!playing) draw();
        });
    });

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvasContainer);

    setupGrid();
    updateHint();
    resize();
    setPlaying(false);
}