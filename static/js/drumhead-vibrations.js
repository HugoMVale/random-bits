/**
 * drumhead-vibrations.js
 *
 * Interactive simulation of a circular drumhead's normal modes for the
 * "Waves Under Tension" blog post.
 *
 * Solves the 2D wave equation on a circular membrane analytically via
 * separation of variables, using Bessel functions J_n and their zeros
 * j_{n,m} to build the normal modes phi_{n,m}(r,theta). Clicking a point
 * on the drumhead (left panel) "strikes" it there, setting each mode's
 * excitation amplitude proportional to J_n(j_{n,m} r_strike / R), and the
 * resulting superposition u(r,theta,t) = sum C_{n,m} J_n(...) cos(n(theta -
 * theta_strike)) cos(omega_{n,m} t) is animated as a pseudo-3D height field
 * (right panel), alongside a bar chart of the excited frequency spectrum.
 *
 * Wave speed c, membrane radius R, and animation speed are adjustable via
 * sliders and recompute the mode frequencies and shapes accordingly.
 */

import { bessel } from './math/bessel.js';
import { renderMath } from './math/katex-render.js';
import { fillCircle } from './canvas-utils.js';

const canvas = document.getElementById('drumhead-vibrations');

if (canvas) {
    const style = document.createElement('style');
    style.textContent = `
    .dh-wrap { font-family: inherit; margin: 1.5rem 0; }
    .dh-controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 1rem; font-size: 0.85rem; padding: 1rem; background: var(--code-bg, #f5f5f5); border: 1px solid var(--border, #ccc); border-radius: 6px; justify-content: center; }
    .dh-group { display: flex; flex-direction: column; gap: 0.5rem; max-width: 500px; margin: 0 auto; width: 100%; }
    .dh-row { display: grid; grid-template-columns: 100px 1fr 50px; align-items: center; gap: 0.5rem; }
    .dh-row label { white-space: nowrap; display: flex; align-items: baseline; gap: 0.3rem; }
    .dh-row input[type="range"] { width: 100%; margin: 0; cursor: pointer; }
    .dh-val { text-align: right; font-variant-numeric: tabular-nums; }
    .dh-canvas-container { position: relative; width: 100%; border: 1px solid var(--border, #ccc); border-radius: 6px; overflow: hidden; touch-action: none; background: #fff; }
    .dh-canvas { width: 100%; display: block; }
    .dh-top-bar { display: flex; justify-content: space-between; padding: 0.5rem 1rem; background: var(--code-bg, #f5f5f5); border-bottom: 1px solid var(--border, #ccc); font-size: 0.85rem; }
    .dh-info-text { display: flex; gap: 1rem; }
    .dh-time-display { font-family: ui-monospace, SFMono-Regular, monospace; font-weight: bold; }
    .dh-instructions { text-align: center; font-size: 0.8rem; color: #666; margin-top: 0.5rem; }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'dh-wrap';
    canvas.parentNode.insertBefore(wrap, canvas);

    const controls = document.createElement('div');
    controls.className = 'dh-controls';

    const group = document.createElement('div');
    group.className = 'dh-group';

    const config = [
        { id: 'c', tex: 'c', unit: '(m/s)', min: 50, max: 400, step: 1, val: 150 },
        { id: 'R', tex: 'R', unit: '(m)', min: 0.1, max: 1.0, step: 0.01, val: 0.4 },
        { id: 'speed', tex: '\\text{Speed}', unit: '(x)', min: 0.001, max: 1.0, step: 0.001, val: 0.001 }
    ];

    const state = {};
    config.forEach(c => {
        state[c.id] = c.val;
        const row = document.createElement('div');
        row.className = 'dh-row';
        row.innerHTML = `<label for="dh-${c.id}"><span id="dh-${c.id}-label"></span><span style="font-style:normal">${c.unit}</span></label>
        <input id="dh-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.val}">
        <span id="dh-${c.id}-val" class="dh-val">${c.val}</span>`;
        group.appendChild(row);
        renderMath(row.querySelector(`#dh-${c.id}-label`), c.tex);
    });

    controls.appendChild(group);
    wrap.appendChild(controls);

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'dh-canvas-container';

    const topBar = document.createElement('div');
    topBar.className = 'dh-top-bar';
    topBar.innerHTML = `
        <div class="dh-info-text">
            <span>Strike Point: <span id="dh-r-val">0.00</span> m, <span id="dh-theta-val">0.0</span>°</span>
        </div>
        <div class="dh-time-display" id="dh-time-val">0.000 s</div>
    `;
    canvasContainer.appendChild(topBar);
    canvasContainer.appendChild(canvas);
    wrap.appendChild(canvasContainer);

    const instructions = document.createElement('div');
    instructions.className = 'dh-instructions';
    instructions.innerHTML = '💡 Tip: Hover to select strike point and click to strike the drumhead';
    wrap.appendChild(instructions);

    canvas.className = 'dh-canvas';
    const ctx = canvas.getContext('2d');

    let w, h;
    const N_MODES = 10;
    const R_STEPS = 30;
    const T_STEPS = 50;
    let t = 0;
    let playing = false;
    let rafId = null;
    let lastTime = 0;
    let scaleFactor = 1.0;

    let rs = 0;
    let ts = 0;
    let displayRs = 0;
    let displayTs = 0;

    let struckRs = 0;
    let struckTs = 0;
    let hasStruck = false;

    let spectrum = [];
    let maxFreq = 0;
    let maxAmp = 0;

    const modes = [];
    for (let n = 0; n <= N_MODES; n++) {
        modes[n] = [];
        for (let m = 1; m <= N_MODES; m++) {
            modes[n][m] = {
                j: bessel.getZero(n, m),
                C: 0,
                omega: 0,
                grid: new Float64Array((R_STEPS + 1) * T_STEPS)
            };
        }
    }

    const gridX = new Float64Array((R_STEPS + 1) * T_STEPS);
    const gridY = new Float64Array((R_STEPS + 1) * T_STEPS);
    const Z = new Float64Array((R_STEPS + 1) * T_STEPS);

    function computeSpatialGrid() {
        let idx = 0;
        for (let ir = 0; ir <= R_STEPS; ir++) {
            const r_norm = ir / R_STEPS;
            for (let it = 0; it < T_STEPS; it++) {
                const theta = (it / T_STEPS) * 2 * Math.PI;
                gridX[idx] = r_norm * Math.cos(theta);
                gridY[idx] = r_norm * Math.sin(theta);
                idx++;
            }
        }
    }

    function precomputeModes() {
        spectrum = [];
        maxFreq = 0;
        maxAmp = 0;

        const isRimStrike = rs >= state.R * 0.98;

        for (let n = 0; n <= N_MODES; n++) {
            for (let m = 1; m <= N_MODES; m++) {
                const md = modes[n][m];
                md.omega = (state.c * md.j) / state.R;

                if (isRimStrike) {
                    md.C = 0;
                } else {
                    md.C = bessel.J(n, (md.j * rs) / state.R);
                    if (n > 0) md.C *= 2;
                }

                const f = md.omega / (2 * Math.PI);
                const amp = Math.abs(md.C);
                spectrum.push({ f, amp });

                if (f > maxFreq) maxFreq = f;
                if (amp > maxAmp) maxAmp = amp;

                let idx = 0;
                for (let ir = 0; ir <= R_STEPS; ir++) {
                    const r = (ir / R_STEPS) * state.R;
                    const bVal = md.C * bessel.J(n, (md.j * r) / state.R);
                    for (let it = 0; it < T_STEPS; it++) {
                        const theta = (it / T_STEPS) * 2 * Math.PI;
                        md.grid[idx] = bVal * Math.cos(n * (theta - ts));
                        idx++;
                    }
                }
            }
        }

        if (maxAmp < 1e-4) {
            maxAmp = 0;
        }
    }

    function strike() {
        rs = displayRs;
        ts = displayTs;
        struckRs = displayRs;
        struckTs = displayTs;
        hasStruck = true;

        document.getElementById('dh-r-val').textContent = struckRs.toFixed(2);
        document.getElementById('dh-theta-val').textContent = ((struckTs * 180) / Math.PI).toFixed(1);

        t = 0;
        precomputeModes();

        let maxZ = 0;
        let idx = 0;
        for (let ir = 0; ir <= R_STEPS; ir++) {
            for (let it = 0; it < T_STEPS; it++) {
                let sum = 0;
                for (let n = 0; n <= N_MODES; n++) {
                    for (let m = 1; m <= N_MODES; m++) {
                        sum += modes[n][m].grid[idx];
                    }
                }
                if (Math.abs(sum) > maxZ) maxZ = Math.abs(sum);
                idx++;
            }
        }

        scaleFactor = maxZ > 1e-6 ? 0.35 / maxZ : 1;

        if (!playing) {
            playing = true;
            lastTime = performance.now();
            tick(lastTime);
        }
    }

    const cosOmegaT = new Float64Array((N_MODES + 1) * (N_MODES + 1));

    function tick(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        t += dt * state.speed;

        document.getElementById('dh-time-val').textContent = t.toFixed(4) + ' s';

        for (let n = 0; n <= N_MODES; n++) {
            for (let m = 1; m <= N_MODES; m++) {
                cosOmegaT[n * (N_MODES + 1) + m] = Math.cos(modes[n][m].omega * t);
            }
        }

        Z.fill(0);
        let idx = 0;
        for (let ir = 0; ir <= R_STEPS; ir++) {
            for (let it = 0; it < T_STEPS; it++) {
                let sum = 0;
                for (let n = 0; n <= N_MODES; n++) {
                    for (let m = 1; m <= N_MODES; m++) {
                        sum += modes[n][m].grid[idx] * cosOmegaT[n * (N_MODES + 1) + m];
                    }
                }
                Z[idx] = sum;
                idx++;
            }
        }

        draw();

        if (t < 5.0) {
            rafId = requestAnimationFrame(tick);
        } else {
            playing = false;
        }
    }

    function resize() {
        const rect = canvasContainer.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        w = rect.width;
        h = 450;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        computeSpatialGrid();
        if (!playing) draw();
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);

        const leftCenterX = w * 0.22;
        const leftCenterY = h * 0.35;
        const leftRadius = Math.min(w * 0.16, h * 0.25);

        fillCircle(ctx, leftCenterX, leftCenterY, leftRadius, '#f8f9fa', '#2c3e50', 2);

        ctx.beginPath();
        ctx.arc(leftCenterX, leftCenterY, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ccc';
        ctx.fill();

        const hX = leftCenterX + (displayRs / state.R) * leftRadius * Math.cos(displayTs);
        const hY = leftCenterY - (displayRs / state.R) * leftRadius * Math.sin(displayTs);

        ctx.beginPath();
        ctx.arc(hX, hY, 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(120, 140, 160, 0.5)';
        ctx.fill();

        if (hasStruck) {
            const sX = leftCenterX + (struckRs / state.R) * leftRadius * Math.cos(struckTs);
            const sY = leftCenterY - (struckRs / state.R) * leftRadius * Math.sin(struckTs);

            ctx.beginPath();
            ctx.arc(sX, sY, 6, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(231, 76, 60, 0.9)';
            ctx.fill();
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(sX, sY, 10, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        const rightCenterX = w * 0.68;
        const rightCenterY = h * 0.35;
        const projScale = Math.min(w * 0.28, h * 0.32);

        ctx.lineJoin = 'round';
        ctx.lineWidth = 1.0;

        for (let ir = 0; ir < R_STEPS; ir++) {
            for (let it = 0; it < T_STEPS; it++) {
                const i1 = ir * T_STEPS + it;
                const i2 = ir * T_STEPS + ((it + 1) % T_STEPS);
                const i3 = (ir + 1) * T_STEPS + ((it + 1) % T_STEPS);
                const i4 = (ir + 1) * T_STEPS + it;

                const poly = [i1, i2, i3, i4].map(idx => {
                    const gx = gridX[idx];
                    const gy = gridY[idx];
                    const z = Z[idx] * scaleFactor;

                    const px = rightCenterX + gx * projScale - gy * projScale * 0.5;
                    const py = rightCenterY + gy * projScale * 0.5 + gx * projScale * 0.25 - z * projScale;
                    return { x: px, y: py, z: z };
                });

                ctx.beginPath();
                ctx.moveTo(poly[0].x, poly[0].y);
                ctx.lineTo(poly[1].x, poly[1].y);
                ctx.lineTo(poly[2].x, poly[2].y);
                ctx.lineTo(poly[3].x, poly[3].y);
                ctx.closePath();

                const avgZ = (poly[0].z + poly[1].z + poly[2].z + poly[3].z) / 4;
                const colorIntensity = avgZ / 0.35;
                const rCol = Math.floor(255 - colorIntensity * 200);
                const bCol = Math.floor(255 + colorIntensity * 200);

                ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, rCol))}, 240, ${Math.max(0, Math.min(255, bCol))})`;
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.stroke();
            }
        }

        const specX = w * 0.15;
        const specY = h * 0.9;
        const specW = w * 0.7;
        const specH = h * 0.22;

        ctx.beginPath();
        ctx.moveTo(specX, specY - specH);
        ctx.lineTo(specX, specY);
        ctx.lineTo(specX + specW, specY);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Frequency (Hz)', specX + specW / 2, specY + 28);

        ctx.save();
        ctx.translate(specX - 25, specY - specH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText('Amplitude', 0, 0);
        ctx.restore();

        ctx.textAlign = 'center';
        ctx.fillText('0', specX, specY + 14);
        ctx.fillText(maxFreq.toFixed(0), specX + specW, specY + 14);

        if (maxAmp > 0) {
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            spectrum.forEach(mode => {
                if (mode.amp < 1e-4) return;
                const x = specX + (mode.f / maxFreq) * specW;
                const y = specY - (mode.amp / maxAmp) * specH;

                ctx.beginPath();
                ctx.moveTo(x, specY);
                ctx.lineTo(x, y);
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#2980b9';
                ctx.fill();
            });
        }
    }

    function updateMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left);
        const my = (e.clientY - rect.top);

        const leftCenterX = w * 0.22;
        const leftCenterY = h * 0.35;
        const leftRadius = Math.min(w * 0.16, h * 0.25);

        const dx = mx - leftCenterX;
        const dy = -(my - leftCenterY);
        const dist = Math.sqrt(dx * dx + dy * dy);

        let normR = dist / leftRadius;
        if (normR > 0.99) normR = 0.99;
        displayRs = normR * state.R;

        displayTs = Math.atan2(dy, dx);
        if (displayTs < 0) displayTs += 2 * Math.PI;

        if (!hasStruck) {
            document.getElementById('dh-r-val').textContent = displayRs.toFixed(2);
            document.getElementById('dh-theta-val').textContent = ((displayTs * 180) / Math.PI).toFixed(1);
        }

        if (!playing) draw();
    }

    canvas.addEventListener('mousemove', updateMousePos);

    canvas.addEventListener('click', (e) => {
        updateMousePos(e);
        strike();
    });

    config.forEach(c => {
        const input = document.getElementById(`dh-${c.id}`);
        const valSpan = document.getElementById(`dh-${c.id}-val`);

        input.addEventListener('input', () => {
            state[c.id] = parseFloat(input.value);
            valSpan.textContent = state[c.id].toFixed(c.step % 1 === 0 ? 0 : (c.step.toString().split('.')[1]?.length || 1));

            if (c.id === 'c' || c.id === 'R') {
                precomputeModes();
            }
            if (!playing) draw();
        });
    });

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvasContainer);
}