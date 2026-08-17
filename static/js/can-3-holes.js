/**
 * can-3-holes.js
 *
 * Interactive animation for the "Case of the 3-Hole Can" blog post.
 *
 * Draws a tall can filled with water up to height H, with a single hole
 * at adjustable height h (controlled by a slider). Water is modeled as a
 * stream of particles launched horizontally from the hole with the
 * theoretical Torricelli efflux velocity v = sqrt(2g(H-h)), then falling
 * under gravity as projectiles until they reach the ground (y = 0).
 *
 * Moving the slider changes h/H, updates the exit velocity accordingly,
 * and resets the particle stream so the new jet trajectory is visible
 * immediately.
 *
 * The canvas is drawn in a fixed logical 500x400 coordinate space
 * (see baseWidth/baseHeight below) and scaled responsively to fit the
 * container width and the device's pixel ratio, so it renders correctly
 * on both desktop and narrow mobile viewports.
 */
(function () {
    const canvas = document.getElementById("can-3-holes");
    if (!canvas) return;

    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.fontFamily = "sans-serif";
    container.style.margin = "1em 0";

    const controls = document.createElement("div");
    controls.style.marginBottom = "10px";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.gap = "10px";

    const label = document.createElement("label");
    label.htmlFor = "h-slider";
    label.style.fontFamily = "Times New Roman, Latin Modern Math, serif";
    label.style.fontStyle = "italic";
    label.style.fontSize = "18px";
    label.textContent = "h/H: ";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = "h-slider";
    slider.min = "0.01";
    slider.max = "0.99";
    slider.step = "0.01";
    slider.value = "0.5";

    const valDisplay = document.createElement("span");
    valDisplay.style.fontFamily = "Times New Roman, Latin Modern Math, serif";
    valDisplay.style.fontSize = "18px";
    valDisplay.textContent = slider.value;

    controls.appendChild(label);
    controls.appendChild(slider);
    controls.appendChild(valDisplay);

    canvas.parentNode.insertBefore(container, canvas);
    container.appendChild(controls);
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    // All drawing below happens in a fixed *logical* coordinate space
    // (baseWidth x baseHeight). The actual backing-store size of the
    // canvas is scaled separately to fit the container width and the
    // device's pixel ratio, via ctx.setTransform() in resizeCanvas().
    // This keeps the geometry/animation math untouched while making the
    // canvas responsive on narrow screens (e.g. Android phones), where a
    // hard-coded 500px-wide canvas would otherwise overflow or get
    // stretched/squished by the page's CSS.
    const baseWidth = 500;
    const baseHeight = 400;

    container.style.width = "100%";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.maxWidth = baseWidth + "px";
    canvas.style.height = "auto";

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = Math.min(canvas.clientWidth || baseWidth, baseWidth);
        const displayHeight = displayWidth * (baseHeight / baseWidth);

        canvas.width = Math.round(displayWidth * dpr);
        canvas.height = Math.round(displayHeight * dpr);

        const scaleX = canvas.width / baseWidth;
        const scaleY = canvas.height / baseHeight;
        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", resizeCanvas);

    const H = 1.0;
    const g = 9.81;
    let h = parseFloat(slider.value);

    const padding = 50;
    const canWidth = 90;
    const canHeight = 260;
    const originX = padding + 40;
    const originY = baseHeight - padding;
    const scale = canHeight / H;

    let particles = [];

    slider.addEventListener("input", (e) => {
        h = parseFloat(e.target.value);
        valDisplay.textContent = h.toFixed(2);
        particles = [];
    });

    function drawSketchLine(x1, y1, x2, y2, strokeStyle = "#111", lineWidth = 2) {
        ctx.beginPath();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function drawSketchEllipse(cx, cy, rx, ry, strokeStyle = "#111", fillStyle = null) {
        ctx.beginPath();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
        ctx.stroke();
    }

    function drawHatchWater(x, y, w, height) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, height);
        ctx.clip();
        ctx.strokeStyle = "rgba(70, 150, 220, 0.4)";
        ctx.lineWidth = 1.5;
        for (let i = -height; i < w + height; i += 10) {
            ctx.beginPath();
            ctx.moveTo(x + i, y + height);
            ctx.lineTo(x + i + 20, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawArrowHead(x, y, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-7, -4);
        ctx.lineTo(-7, 4);
        ctx.closePath();
        ctx.fillStyle = "#111";
        ctx.fill();
        ctx.restore();
    }

    let lastTime = performance.now();
    let spawnTimer = 0;

    function animate(now) {
        const dt = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        ctx.fillStyle = "#faf8f5";
        ctx.fillRect(0, 0, baseWidth, baseHeight);

        const v_x = Math.sqrt(2 * g * (H - h));
        const holeX_math = 0;
        const holeY_math = h;
        const holeCanvasX = originX + canWidth;
        const holeCanvasY = originY - holeY_math * scale;

        const waterTopY = originY - H * scale;
        const waterHeightPx = H * scale;
        const rx = canWidth / 2;
        const ry = 12;

        drawHatchWater(originX, waterTopY, canWidth, waterHeightPx);

        drawSketchEllipse(originX + rx, waterTopY, rx, ry, "#336699", "rgba(180, 220, 240, 0.5)");
        drawSketchLine(originX, waterTopY, originX, originY, "#222", 2);
        drawSketchLine(originX + canWidth, waterTopY, originX + canWidth, originY, "#222", 2);
        drawSketchEllipse(originX + rx, originY, rx, ry, "#222");

        drawSketchLine(originX - 25, originY, baseWidth - 20, originY, "#333", 2);
        drawArrowHead(baseWidth - 20, originY, 0);

        drawSketchLine(originX, originY + 15, originX, waterTopY - 25, "#333", 2);
        drawArrowHead(originX, waterTopY - 25, -Math.PI / 2);

        const dimHX = originX - 35;
        drawSketchLine(dimHX, waterTopY, dimHX, originY, "#555", 1);
        drawArrowHead(dimHX, waterTopY, -Math.PI / 2);
        drawArrowHead(dimHX, originY, Math.PI / 2);

        const dimhX = holeCanvasX + 25;
        drawSketchLine(dimhX, holeCanvasY, dimhX, originY, "#555", 1);
        drawArrowHead(dimhX, holeCanvasY, -Math.PI / 2);
        drawArrowHead(dimhX, originY, Math.PI / 2);

        ctx.fillStyle = "#111";
        ctx.font = "italic 22px 'Times New Roman', 'Latin Modern Math', serif";
        ctx.fillText("x", baseWidth - 30, originY + 25);
        ctx.fillText("y", originX + 12, waterTopY - 15);
        ctx.fillText("H", dimHX - 22, waterTopY + canHeight / 2 + 7);
        ctx.fillText("h", dimhX + 10, holeCanvasY + (originY - holeCanvasY) / 2 + 7);

        drawSketchEllipse(holeCanvasX, holeCanvasY, 4, 6, "#111", "#faf8f5");

        spawnTimer += dt;
        if (spawnTimer > 0.04) {
            particles.push({ t: 0 });
            spawnTimer = 0;
        }

        ctx.fillStyle = "rgba(60, 140, 210, 0.75)";
        ctx.strokeStyle = "rgba(30, 80, 160, 0.85)";
        ctx.lineWidth = 1;

        const timeScale = 0.65;

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.t += dt * timeScale;

            const x_math = v_x * p.t;
            const y_math = holeY_math - 0.5 * g * p.t * p.t;

            if (y_math <= 0) {
                particles.splice(i, 1);
                continue;
            }

            const px = holeCanvasX + x_math * scale;
            const py = originY - y_math * scale;

            ctx.beginPath();
            ctx.ellipse(px, py, 4, 3, Math.atan2(g * p.t, v_x), 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
})();