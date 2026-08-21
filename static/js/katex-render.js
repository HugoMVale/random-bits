/**
 * Renders a LaTeX string into a DOM element using KaTeX if available,
 * falling back to plain text otherwise.
 */
export function renderMath(el, tex) {
    if (window.katex) window.katex.render(tex, el, { throwOnError: false });
    else el.textContent = tex;
}
