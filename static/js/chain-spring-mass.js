import { createVelocityVerlet } from './verlet.js';

const canvas = document.getElementById('chain-spring-mass');

if (canvas) {
    const style = document.createElement('style');
    style.textContent = `
    .csm-wrap { font-family: inherit; margin: 1.5rem 0; }
    .csm-controls { display: flex; flex-wrap: wrap; gap: 0.75rem 1.5rem; align-items: center; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .csm-row { display: flex; align-items: center; gap: 0.5rem; }
    .csm-row label { white-space: nowrap; }
    .csm-row input[type="range"] { width: 140px; }
    .csm-buttons { display: flex; gap: 0.5rem; }
    .csm-buttons button { cursor: pointer; padding: 0.3rem 0.7rem; border-radius: 6px; border: 1px solid var(--border, #ccc); background: var(--code-bg, #f5f5f5); color: inherit; font-size: 0.85rem; }
    .csm-buttons button:hover { background: var(--tag-border, #e0e0e0); }
    .csm-canvas { width: 100%; touch-action: none; cursor: crosshair; border: 1px solid var(--border, #ccc); border-radius: 6px; }
    .csm-canvas-wrap { position: relative; }
    .csm-canvas-label { position: absolute; opacity: 0.6; font-size: 0.8rem; pointer-events: none; }
    .csm-row .katex { font-size: 1.05em; }
    .csm-val-display { min-width: 3rem; display: inline-block; }
    .csm-hint { font-size: 0.85rem; margin-bottom: 0.5rem; }
  `;
    document.head.appendChild(style);

    function renderMath(el, tex) {
        if (window.katex) window.katex.render(tex, el, { throwOnError: false });
        else el.textContent = tex;
    }

    const wrap = document.createElement('div');
    wrap.className = 'csm-wrap';
    canvas.parentNode.insertBefore(wrap, canvas);

    const controls = document.createElement('div');
    controls.className = 'csm-controls';
    wrap.appendChild(controls);

    const cRow = document.createElement('div');
    cRow.className = 'csm-row';
    cRow.innerHTML = `<label for="csm-c2" id="csm-c2-label"></label>
    <input id="csm-c2" type="range" min="0.05" max="4" step="0.01" value="0.5">
    <span id="csm-c2-val">0.50</span>`;
    controls.appendChild(cRow);
    renderMath(document.getElementById('csm-c2-label'), '\\dfrac{KL^2}{M}');

    const nRow = document.createElement('div');
    nRow.className = 'csm-row';
    nRow.innerHTML = `<label for="csm-n" id="csm-n-label"></label>
    <input id="csm-n" type="range" min="1" max="20" step="1" value="5">
    <span id="csm-n-val">5</span>`;
    controls.appendChild(nRow);
    renderMath(document.getElementById('csm-n-label'), 'N');

    const speedRow = document.createElement('div');
    speedRow.className = 'csm-row';
    speedRow.innerHTML = `<label for="csm-speed">time/frame</label>
    <input id="csm-speed" type="range" min="0.01" max="0.2" step="0.01" value="0.05">
    <span id="csm-speed-val">0.05</span>`;
    controls.appendChild(speedRow);

    const timeRow = document.createElement('div');
    timeRow.className = 'csm-row';
    timeRow.innerHTML = `<span id="csm-time-label"></span><span id="csm-time-val" class="csm-val-display">0.00</span>`;
    controls.appendChild(timeRow);
    renderMath(document.getElementById('csm-time-label'), 't =');

    const energyRow = document.createElement('div');
    energyRow.className = 'csm-row';
    energyRow.innerHTML = `<span id="csm-energy-label"></span><span id="csm-energy-val" class="csm-val-display">0.000</span>`;
    controls.appendChild(energyRow);
    renderMath(document.getElementById('csm-energy-label'), '\\dfrac{E}{M} =');

    const buttons = document.createElement('div');
    buttons.className = 'csm-buttons';
    buttons.innerHTML = `
    <button id="csm-play">Play</button>
    <button id="csm-flat">Flat</button>
    <button id="csm-sine">Sine</button>
  `;
    controls.appendChild(buttons);

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'csm-canvas-wrap';
    wrap.appendChild(canvasWrap);
    canvasWrap.appendChild(canvas);
    canvas.className = 'csm-canvas';
    canvas.style.width = '100%';

    const hint = document.createElement('div');
    hint.className = 'csm-hint';
    hint.textContent = '💡 Tip: Drag the masses left or right to adjust their initial positions.';
    wrap.appendChild(hint);

    const ctx = canvas.getContext('2d');

    const c2Input = document.getElementById('csm-c2');
    const c2Val = document.getElementById('csm-c2-val');
    const nInput = document.getElementById('csm-n');
    const nVal = document.getElementById('csm-n-val');
    const speedInput = document.getElementById('csm-speed');
    const speedVal = document.getElementById('csm-speed-val');
    const timeVal = document.getElementById('csm-time-val');
    const energyVal = document.getElementById('csm-energy-val');
    const playBtn = document.getElementById('csm-play');
    const flatBtn = document.getElementById('csm-flat');
    const sineBtn = document.getElementById('csm-sine');

    const U_H = 90;
    const V_H = 90;
    const GAP = 12;
    const PHYS_H = 150;
    const PHYS_TOP = U_H + GAP + V_H + GAP;
    const CANVAS_H = PHYS_TOP + PHYS_H;
    const MAX_SUBSTEPS = 400;
    const MASS_COLOR = '#e07b39';
    const MASS_RADIUS = 5;
    const HIT_RADIUS = 14;
    const COMPRESSION_COLOR = [214, 64, 64];
    const TENSION_COLOR = [64, 110, 214];
    const NEUTRAL_COLOR = [150, 150, 150];
    const STRAIN_CLAMP = 2;
    const MIN_GAP_PX = 5;
    const SPRING_COILS = 5;
    const SPRING_AMP = 7;
    const X_MARGIN = 15;
    const LABEL_FONT = '11px sans-serif';

    function addCanvasLabel(top, tex) {
        const el = document.createElement('span');
        el.className = 'csm-canvas-label';
        el.style.left = (X_MARGIN + 6) + 'px';
        el.style.top = top + 'px';
        canvasWrap.appendChild(el);
        renderMath(el, tex);
    }
    addCanvasLabel(2, 'u(x)');
    addCanvasLabel(U_H + GAP + 2, '\\dot{u}(x)');

    let K_L2_M = parseFloat(c2Input.value);
    let N = parseInt(nInput.value, 10);
    let SIM_TIME_PER_FRAME = parseFloat(speedInput.value);
    let dx, dt, integrator, curveScale, vScale, ampScale;
    let u, v, a, aNext, posArr;
    let playing = false;
    let rafId = null;
    let draggingMass = null;
    let timeAccumulator = 0;
    let simTime = 0;

    function computeAcceleration(uArr, vArr, outArr) {
        const coeff = K_L2_M / (dx * dx);
        for (let i = 0; i < N; i++) {
            const left = i === 0 ? 0 : uArr[i - 1];
            const right = i === N - 1 ? 0 : uArr[i + 1];
            outArr[i] = coeff * (right - 2 * uArr[i] + left);
        }
    }

    function computeEnergy() {
        if (!u || !v) return 0;
        let kin = 0;
        for (let i = 0; i < N; i++) kin += v[i] * v[i];
        kin *= 0.5;

        let pot = 0;
        const k_m = K_L2_M / (dx * dx);
        for (let i = 0; i <= N; i++) {
            const du = nodeAt(u, i + 1) - nodeAt(u, i);
            pot += du * du;
        }
        pot *= 0.5 * k_m;

        return (kin + pot) / (1.0 / dx);
    }

    function nodeAt(arr, i) {
        if (i === 0 || i === N + 1) return 0;
        return arr[i - 1];
    }

    function setupGrid() {
        dx = 1 / (N + 1);
        const c = Math.sqrt(K_L2_M);
        const dtCFL = dx / c;
        dt = 0.1 * dtCFL;
        integrator = createVelocityVerlet(computeAcceleration);
        posArr = new Float64Array(N + 2);
    }

    function resetField(kind) {
        u = new Float64Array(N);
        v = new Float64Array(N);
        a = new Float64Array(N);
        aNext = new Float64Array(N);
        simTime = 0;

        if (kind === 'sine') {
            for (let i = 0; i < N; i++) u[i] = 0.3 * Math.sin((Math.PI * (i + 1)) / (N + 1));
        }

        computeAcceleration(u, v, a);
        draw();
    }

    function computeScales(width) {
        curveScale = U_H * 0.4;
        vScale = (V_H * 0.4) / Math.sqrt(K_L2_M);
        const plotW = width - 2 * X_MARGIN;
        ampScale = (plotW / (N + 1)) * 4;
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = CANVAS_H * dpr;
        canvas.style.height = CANVAS_H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        computeScales(rect.width);
        draw();
    }

    function clamp(x, lo, hi) {
        return Math.max(lo, Math.min(hi, x));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function strainColor(strain) {
        const t = clamp(strain / STRAIN_CLAMP, -1, 1);
        const target = t < 0 ? COMPRESSION_COLOR : TENSION_COLOR;
        const f = Math.abs(t);
        const r = lerp(NEUTRAL_COLOR[0], target[0], f) | 0;
        const g = lerp(NEUTRAL_COLOR[1], target[1], f) | 0;
        const b = lerp(NEUTRAL_COLOR[2], target[2], f) | 0;
        return `rgb(${r},${g},${b})`;
    }

    function drawWall(x, yTop, height, isRightSide) {
        const textColor = getComputedStyle(document.body).color || '#000';
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yTop + height);
        ctx.stroke();
        const n = 6;
        const dir = isRightSide ? 1 : -1;
        for (let k = 0; k < n; k++) {
            const y0 = yTop + (height / n) * k;
            const y1 = y0 + height / n;
            ctx.beginPath();
            ctx.moveTo(x, y0);
            ctx.lineTo(x + dir * 8, y1);
            ctx.stroke();
        }
    }

    function drawSpring(x0, y0, x1, y1, color) {
        const length = x1 - x0;
        const lead = length * 0.12;
        const coilLength = length - 2 * lead;
        const samples = SPRING_COILS * 4;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + lead, y0);
        for (let i = 1; i <= samples; i++) {
            const t = i / samples;
            const x = x0 + lead + coilLength * t;
            const y = y0 + SPRING_AMP * Math.sin(2 * Math.PI * SPRING_COILS * t);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(x1, y1);
        ctx.stroke();
    }

    function drawCurve(field, yTop, height, scale) {
        const w = canvas.clientWidth;
        const midY = yTop + height / 2;
        const textColor = getComputedStyle(document.body).color || '#000';
        const plotW = w - 2 * X_MARGIN;

        ctx.strokeStyle = textColor;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X_MARGIN, midY);
        ctx.lineTo(w - X_MARGIN, midY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= N + 1; i++) {
            const x = X_MARGIN + (plotW * i) / (N + 1);
            const y = midY - nodeAt(field, i) * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        drawWall(X_MARGIN, yTop, height, false);
        drawWall(w - X_MARGIN, yTop, height, true);
    }

    function computePositions(w) {
        const plotW = w - 2 * X_MARGIN;
        posArr[0] = X_MARGIN;
        posArr[N + 1] = w - X_MARGIN;

        for (let i = 1; i <= N; i++) {
            posArr[i] = X_MARGIN + (plotW * i) / (N + 1) + u[i - 1] * ampScale;
        }

        for (let iter = 0; iter < 2; iter++) {
            for (let i = 1; i <= N; i++) {
                posArr[i] = Math.max(posArr[i], posArr[i - 1] + MIN_GAP_PX);
            }
            for (let i = N; i >= 1; i--) {
                posArr[i] = Math.min(posArr[i], posArr[i + 1] - MIN_GAP_PX);
            }
        }

        return posArr;
    }

    function drawPhysicalPanel(w) {
        const midY = PHYS_TOP + PHYS_H / 2;
        const textColor = getComputedStyle(document.body).color || '#000';

        ctx.font = LABEL_FONT;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = textColor;
        ctx.fillText('physical chain', X_MARGIN + 6, PHYS_TOP + 14);
        ctx.globalAlpha = 1;

        computePositions(w);

        for (let i = 0; i <= N; i++) {
            const strain = (nodeAt(u, i + 1) - nodeAt(u, i)) / dx;
            drawSpring(posArr[i], midY, posArr[i + 1], midY, strainColor(strain));
        }

        ctx.fillStyle = MASS_COLOR;
        for (let i = 1; i <= N; i++) {
            ctx.beginPath();
            ctx.arc(posArr[i], midY, MASS_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }

        drawWall(X_MARGIN, PHYS_TOP, PHYS_H, false);
        drawWall(w - X_MARGIN, PHYS_TOP, PHYS_H, true);
    }

    function draw() {
        const w = canvas.clientWidth;
        ctx.clearRect(0, 0, w, CANVAS_H);
        drawCurve(u, 0, U_H, curveScale);
        drawCurve(v, U_H + GAP, V_H, vScale);
        drawPhysicalPanel(w);

        timeVal.textContent = simTime.toFixed(2);
        energyVal.textContent = computeEnergy().toFixed(3);
    }

    function findNearestMass(x, y) {
        if (!posArr) return null;
        const midY = PHYS_TOP + PHYS_H / 2;
        if (Math.abs(y - midY) > PHYS_H / 2) return null;
        let best = null;
        let bestDist = Infinity;
        for (let i = 1; i <= N; i++) {
            const d = Math.abs(x - posArr[i]);
            if (d < bestDist) {
                bestDist = d;
                best = i;
            }
        }
        return bestDist <= HIT_RADIUS ? best : null;
    }

    function updateDragFromClientX(clientX) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const w = rect.width;
        const plotW = w - 2 * X_MARGIN;

        posArr[0] = X_MARGIN;
        posArr[N + 1] = w - X_MARGIN;

        for (let i = 1; i <= N; i++) {
            posArr[i] = X_MARGIN + (plotW * i) / (N + 1) + u[i - 1] * ampScale;
        }

        const minX = X_MARGIN + draggingMass * MIN_GAP_PX;
        const maxX = (w - X_MARGIN) - (N + 1 - draggingMass) * MIN_GAP_PX;
        posArr[draggingMass] = clamp(x, minX, maxX);

        for (let i = draggingMass + 1; i <= N; i++) {
            posArr[i] = Math.max(posArr[i], posArr[i - 1] + MIN_GAP_PX);
        }
        for (let i = draggingMass - 1; i >= 1; i--) {
            posArr[i] = Math.min(posArr[i], posArr[i + 1] - MIN_GAP_PX);
        }

        for (let i = 1; i <= N; i++) {
            const basePos = X_MARGIN + (plotW * i) / (N + 1);
            u[i - 1] = (posArr[i] - basePos) / ampScale;
            v[i - 1] = 0;
        }

        computeAcceleration(u, v, a);
        draw();
    }

    canvas.addEventListener('pointerdown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const idx = findNearestMass(x, y);
        if (idx === null) return;
        setPlaying(false);
        draggingMass = idx;
        updateDragFromClientX(e.clientX);
    });
    window.addEventListener('pointermove', (e) => {
        if (draggingMass !== null) updateDragFromClientX(e.clientX);
    });
    window.addEventListener('pointerup', () => {
        draggingMass = null;
    });

    function tick() {
        timeAccumulator += SIM_TIME_PER_FRAME;
        let steps = 0;

        while (timeAccumulator >= dt && steps < MAX_SUBSTEPS) {
            integrator({ u, v, a, aNext }, dt);
            simTime += dt;
            timeAccumulator -= dt;
            steps++;
        }

        draw();
        if (playing) rafId = requestAnimationFrame(tick);
    }

    function setPlaying(value) {
        playing = value;
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
    flatBtn.addEventListener('click', () => { setPlaying(false); resetField('flat'); });
    sineBtn.addEventListener('click', () => { setPlaying(false); resetField('sine'); });

    c2Input.addEventListener('input', () => {
        K_L2_M = parseFloat(c2Input.value);
        c2Val.textContent = K_L2_M.toFixed(2);
        setupGrid();
        computeAcceleration(u, v, a);
        resize();
    });

    nInput.addEventListener('input', () => {
        N = parseInt(nInput.value, 10);
        nVal.textContent = String(N);
        setPlaying(false);
        setupGrid();
        resetField('flat');
        resize();
    });

    speedInput.addEventListener('input', () => {
        SIM_TIME_PER_FRAME = parseFloat(speedInput.value);
        speedVal.textContent = SIM_TIME_PER_FRAME.toFixed(2);
    });

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(wrap);

    setupGrid();
    resetField('sine');
    resize();
    setPlaying(true);
}