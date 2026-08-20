// Some Android/Skia canvas backends drop a thin sliver where a single
// 0..2π arc() sweep wraps back to its start, even with closePath(); two
// half-arcs avoid relying on that wrap-around point entirely.
export function fillCircle(ctx, cx, cy, r, color) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI);
    ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
