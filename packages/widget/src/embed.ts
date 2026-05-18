/**
 * @interligens/widget — standalone embed script
 *
 * Usage:
 *   <script src="https://app.interligens.com/widget/embed.js"
 *           data-partner-key="YOUR_KEY" defer></script>
 *   <div data-interligens-widget
 *        data-address="EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
 *        data-size="120"></div>
 */

const API_BASE = "https://app.interligens.com";

const TIER_COLOR: Record<string, string> = {
  GREEN:  "#00C853",
  ORANGE: "#FF6B00",
  RED:    "#FF1744",
};

const SPIN_KEYFRAME = `@keyframes iw-spin{to{transform:rotate(360deg);transform-origin:50% 50%}}`;

function injectStyles() {
  if (document.getElementById("iw-styles")) return;
  const s = document.createElement("style");
  s.id = "iw-styles";
  s.textContent = SPIN_KEYFRAME;
  document.head.appendChild(s);
}

function makeSvgSpinner(size: number): SVGSVGElement {
  const r = (size - 16) / 2;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.style.animation = "iw-spin 1s linear infinite";

  const track = document.createElementNS(ns, "circle");
  track.setAttribute("cx", String(size / 2));
  track.setAttribute("cy", String(size / 2));
  track.setAttribute("r", String(r));
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "#ffffff1a");
  track.setAttribute("stroke-width", "8");
  svg.appendChild(track);

  const arc = document.createElementNS(ns, "circle");
  arc.setAttribute("cx", String(size / 2));
  arc.setAttribute("cy", String(size / 2));
  arc.setAttribute("r", String(r));
  arc.setAttribute("fill", "none");
  arc.setAttribute("stroke", "#FF6B00");
  arc.setAttribute("stroke-width", "8");
  arc.setAttribute("stroke-dasharray", `${r * 1.5} ${2 * Math.PI * r}`);
  arc.setAttribute("stroke-linecap", "round");
  arc.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
  svg.appendChild(arc);

  return svg;
}

function makeRing(score: number, tier: string, size: number): SVGSVGElement {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = ((100 - score) / 100) * circ;
  const color = TIER_COLOR[tier] ?? "#FF6B00";
  const ns = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));

  const track = document.createElementNS(ns, "circle");
  track.setAttribute("cx", String(size / 2));
  track.setAttribute("cy", String(size / 2));
  track.setAttribute("r", String(r));
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "#ffffff1a");
  track.setAttribute("stroke-width", "8");
  svg.appendChild(track);

  const arc = document.createElementNS(ns, "circle");
  arc.setAttribute("cx", String(size / 2));
  arc.setAttribute("cy", String(size / 2));
  arc.setAttribute("r", String(r));
  arc.setAttribute("fill", "none");
  arc.setAttribute("stroke", color);
  arc.setAttribute("stroke-width", "8");
  arc.setAttribute("stroke-dasharray", String(circ));
  arc.setAttribute("stroke-dashoffset", String(dashOffset));
  arc.setAttribute("stroke-linecap", "round");
  arc.setAttribute("transform", `rotate(-90 ${size / 2} ${size / 2})`);
  arc.style.transition = "stroke-dashoffset 0.9s ease";
  svg.appendChild(arc);

  const score_text = document.createElementNS(ns, "text");
  score_text.setAttribute("x", "50%");
  score_text.setAttribute("y", "50%");
  score_text.setAttribute("dominant-baseline", "middle");
  score_text.setAttribute("text-anchor", "middle");
  score_text.style.cssText = `fill:${color};font-size:${size * 0.22}px;font-weight:700;font-family:sans-serif`;
  score_text.textContent = String(score);
  svg.appendChild(score_text);

  const tier_text = document.createElementNS(ns, "text");
  tier_text.setAttribute("x", "50%");
  tier_text.setAttribute("y", "50%");
  tier_text.setAttribute("dy", String(size * 0.18));
  tier_text.setAttribute("dominant-baseline", "middle");
  tier_text.setAttribute("text-anchor", "middle");
  tier_text.style.cssText = `fill:#ffffff80;font-size:${size * 0.1}px;font-family:sans-serif`;
  tier_text.textContent = tier;
  svg.appendChild(tier_text);

  return svg;
}

async function renderWidget(el: HTMLElement, partnerKey: string) {
  const address = el.dataset.address ?? "";
  const size = parseInt(el.dataset.size ?? "120", 10);

  el.style.cssText = "display:inline-flex;flex-direction:column;align-items:center;gap:4px;background:transparent;";

  const spinner = makeSvgSpinner(size);
  el.appendChild(spinner);

  const link = document.createElement("a");
  link.href = "https://app.interligens.com";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Powered by INTERLIGENS";
  link.style.cssText = "font-size:9px;color:#ffffff50;text-decoration:none;font-family:sans-serif;letter-spacing:0.05em;";
  el.appendChild(link);

  if (!address) {
    el.removeChild(spinner);
    const errEl = document.createElement("span");
    errEl.style.cssText = `color:#FF1744;font-size:10px;font-family:sans-serif;width:${size}px;text-align:center;`;
    errEl.textContent = "missing address";
    el.insertBefore(errEl, link);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/partner/v1/score-lite?address=${encodeURIComponent(address)}`, {
      headers: { "X-Partner-Key": partnerKey },
    });
    const data = await res.json() as { score?: number; tier?: string; error?: string };

    el.removeChild(spinner);

    if (data.error || data.score == null) {
      const errEl = document.createElement("span");
      errEl.style.cssText = `color:#FF1744;font-size:10px;font-family:sans-serif;width:${size}px;text-align:center;`;
      errEl.textContent = "unavailable";
      el.insertBefore(errEl, link);
      return;
    }

    const ring = makeRing(data.score, data.tier ?? "GREEN", size);
    el.insertBefore(ring, link);
  } catch {
    el.removeChild(spinner);
    const errEl = document.createElement("span");
    errEl.style.cssText = `color:#FF1744;font-size:10px;font-family:sans-serif;width:${size}px;text-align:center;`;
    errEl.textContent = "unavailable";
    el.insertBefore(errEl, link);
  }
}

function init() {
  const scriptEl = document.currentScript as HTMLScriptElement | null;
  const partnerKey = scriptEl?.dataset.partnerKey ?? "";

  injectStyles();

  const widgets = document.querySelectorAll<HTMLElement>("[data-interligens-widget]");
  widgets.forEach((el) => renderWidget(el, partnerKey));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
