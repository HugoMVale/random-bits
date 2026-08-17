/**
 * equilibrium-diacid.js
 *
 * Animated canvas illustration for the "A Diacid Paradox" blog post.
 *
 * Renders a floating, jittering population of simplified diacid molecules
 * (wavy backbones with a circular "acid group" at each end). A slider lets
 * the reader control the degree of ionization (alpha, 0-1); each acid group
 * end is independently ionized with probability alpha and colored
 * accordingly (green = non-ionized, red = ionized), re-rolled at a fixed
 * interval to visualize the equilibrium as a dynamic, statistical process
 * rather than a static snapshot.
 *
 * Molecules drift with simple Brownian-motion-like jitter, damping, and
 * pairwise elastic collisions to keep the scene lively without overlap.
 */
(function () {
    const CANVAS_ID = 'equilibrium-diacid';
    const NUM_MOLECULES = 35;
    const UPDATE_INTERVAL_MS = 500;
    const BROWNIAN_JITTER = 0.35;
    const ROTATION_JITTER = 0.03;
    const MAX_SPEED = 0.8;
    const DAMPING = 0.98;
    const COLOR_NON_IONIZED = '#2b8a3e';
    const COLOR_IONIZED = '#e03131';
    const COLOR_BACKBONE = '#495057';

    let canvas = document.getElementById(CANVAS_ID);
    if (!canvas) return;

    let ctx = canvas.getContext('2d');
    let alpha = 0.5;
    let molecules = [];
    let lastUpdate = 0;
    let currentDpr = 1;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '12px';
    container.style.margin = '20px 0';

    const sliderContainer = document.createElement('div');
    sliderContainer.style.display = 'flex';
    sliderContainer.style.alignItems = 'center';
    sliderContainer.style.gap = '10px';
    sliderContainer.style.fontFamily = 'sans-serif';
    sliderContainer.style.fontSize = '14px';

    const label = document.createElement('label');
    label.setAttribute('for', 'alpha-slider');
    label.textContent = 'Degree of ionization (α):';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'alpha-slider';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = alpha;

    const valueSpan = document.createElement('span');
    valueSpan.id = 'alpha-val';
    valueSpan.textContent = alpha.toFixed(2);
    valueSpan.style.minWidth = '35px';

    slider.addEventListener('input', (e) => {
        alpha = parseFloat(e.target.value);
        document.getElementById('alpha-val').textContent = alpha.toFixed(2);
    });

    sliderContainer.appendChild(label);
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueSpan);

    canvas.parentNode.insertBefore(container, canvas);
    container.appendChild(canvas);
    container.appendChild(sliderContainer);

    function resizeCanvas() {
        const rect = container.getBoundingClientRect();
        const width = Math.min(rect.width, 650);
        const height = 320;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        currentDpr = dpr;
        initMolecules(width, height);
    }

    function initMolecules(width, height) {
        molecules = [];
        const maxAttempts = 1000;

        for (let i = 0; i < NUM_MOLECULES; i++) {
            const length = 45 + Math.random() * 15;
            const radius = length / 2 + 4;
            let x, y, overlaps, attempts = 0;

            do {
                x = radius + Math.random() * (width - 2 * radius);
                y = radius + Math.random() * (height - 2 * radius);
                overlaps = false;

                for (let j = 0; j < molecules.length; j++) {
                    const other = molecules[j];
                    const dist = Math.hypot(x - other.x, y - other.y);
                    if (dist < radius + other.radius) {
                        overlaps = true;
                        break;
                    }
                }
                attempts++;
            } while (overlaps && attempts < maxAttempts);

            if (attempts < maxAttempts) {
                molecules.push({
                    x: x,
                    y: y,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    angle: Math.random() * Math.PI * 2,
                    vAngle: (Math.random() - 0.5) * 0.02,
                    length: length,
                    radius: radius,
                    waves: 3,
                    leftIonized: Math.random() < alpha,
                    rightIonized: Math.random() < alpha
                });
            }
        }
    }

    function updateStates() {
        molecules.forEach(m => {
            m.leftIonized = Math.random() < alpha;
            m.rightIonized = Math.random() < alpha;
        });
    }

    function updatePhysics(width, height) {
        for (let i = 0; i < molecules.length; i++) {
            const m = molecules[i];

            m.vx += (Math.random() - 0.5) * BROWNIAN_JITTER;
            m.vy += (Math.random() - 0.5) * BROWNIAN_JITTER;
            m.vAngle += (Math.random() - 0.5) * ROTATION_JITTER;

            m.vx *= DAMPING;
            m.vy *= DAMPING;
            m.vAngle *= DAMPING;

            const speed = Math.hypot(m.vx, m.vy);
            if (speed > MAX_SPEED) {
                m.vx = (m.vx / speed) * MAX_SPEED;
                m.vy = (m.vy / speed) * MAX_SPEED;
            }

            m.x += m.vx;
            m.y += m.vy;
            m.angle += m.vAngle;

            if (m.x - m.radius < 0) {
                m.x = m.radius;
                m.vx *= -1;
            } else if (m.x + m.radius > width) {
                m.x = width - m.radius;
                m.vx *= -1;
            }

            if (m.y - m.radius < 0) {
                m.y = m.radius;
                m.vy *= -1;
            } else if (m.y + m.radius > height) {
                m.y = height - m.radius;
                m.vy *= -1;
            }
        }

        for (let i = 0; i < molecules.length; i++) {
            for (let j = i + 1; j < molecules.length; j++) {
                const m1 = molecules[i];
                const m2 = molecules[j];
                const dx = m2.x - m1.x;
                const dy = m2.y - m1.y;
                const dist = Math.hypot(dx, dy);
                const minDist = m1.radius + m2.radius;

                if (dist < minDist && dist > 0) {
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    m1.x -= nx * overlap * 0.5;
                    m1.y -= ny * overlap * 0.5;
                    m2.x += nx * overlap * 0.5;
                    m2.y += ny * overlap * 0.5;

                    const kx = m1.vx - m2.vx;
                    const ky = m1.vy - m2.vy;
                    const p = 2 * (nx * kx + ny * ky) / 2;

                    m1.vx -= p * nx;
                    m1.vy -= p * ny;
                    m2.vx += p * nx;
                    m2.vy += p * ny;
                }
            }
        }
    }

    function drawWavyLine(x1, y1, x2, y2, waves, amplitude) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        const nx = -uy;
        const ny = ux;

        ctx.beginPath();
        ctx.moveTo(x1, y1);

        const steps = waves * 4;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + ux * len * t;
            const py = y1 + uy * len * t;
            const side = (i % 2 === 0) ? 0 : (i % 4 === 1 ? 1 : -1);
            const offX = nx * amplitude * side;
            const offY = ny * amplitude * side;

            ctx.lineTo(px + offX, py + offY);
        }

        ctx.strokeStyle = COLOR_BACKBONE;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function render(time) {
        if (time - lastUpdate > UPDATE_INTERVAL_MS) {
            updateStates();
            lastUpdate = time;
        }

        const width = canvas.width / currentDpr;
        const height = canvas.height / currentDpr;

        updatePhysics(width, height);

        ctx.clearRect(0, 0, width, height);

        const ionizedPath = new Path2D();
        const nonIonizedPath = new Path2D();

        molecules.forEach(m => {
            const cos = Math.cos(m.angle);
            const sin = Math.sin(m.angle);
            const halfLen = m.length / 2;

            const x1 = m.x - cos * halfLen;
            const y1 = m.y - sin * halfLen;
            const x2 = m.x + cos * halfLen;
            const y2 = m.y + sin * halfLen;

            drawWavyLine(x1, y1, x2, y2, m.waves, 4);

            (m.leftIonized ? ionizedPath : nonIonizedPath).moveTo(x1 + 5, y1);
            (m.leftIonized ? ionizedPath : nonIonizedPath).arc(x1, y1, 5, 0, Math.PI * 2);

            (m.rightIonized ? ionizedPath : nonIonizedPath).moveTo(x2 + 5, y2);
            (m.rightIonized ? ionizedPath : nonIonizedPath).arc(x2, y2, 5, 0, Math.PI * 2);
        });

        ctx.fillStyle = COLOR_NON_IONIZED;
        ctx.fill(nonIonizedPath);
        ctx.fillStyle = COLOR_IONIZED;
        ctx.fill(ionizedPath);

        requestAnimationFrame(render);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    requestAnimationFrame(render);
})();