// Desktop iPad simulator shell.
//   #            → device picker
//   #air         → iPad Air, scaled to fit the window
//   #air/100     → iPad Air at 100 % (1 CSS px = 1 iPad point; the stage scrolls if the window is smaller)
// The app (app.html) runs in an iframe of exactly the device's landscape CSS viewport; only a CSS transform on the
// whole device scales it visually, so the app's innerWidth / innerHeight and media queries never see the window size.
// One iframe for the whole session: switching devices resizes it and keeps the app state.
import { DEVICES, deviceById } from "./devices.js?v=9b084982c555";

const $ = (id) => document.getElementById(id);
const els = {
  picker: $("picker"), device: $("device"), list: $("deviceList"), back: $("backToPicker"), name: $("deviceName"), meta: $("deviceMeta"),
  select: $("deviceSelect"), stage: $("stage"), slot: $("slot"), ipad: $("ipad"), app: $("app"), scale: $("scaleLabel"),
  zoomButtons: [...document.querySelectorAll("[data-zoom]")],
};
const STAGE_PAD = 32;
// Old links to the app itself (…/#/catalog, …/#/product/<id>) land here since the root became the simulator:
// keep that route and open it inside the device once one is chosen.
let appHash = location.hash.startsWith("#/") ? location.hash : "";
if (appHash) history.replaceState(null, "", location.pathname + location.search);
// Build id on the picker: shows at a glance whether the page is the latest deploy or a cached copy.
const build = document.querySelector('meta[name="app-build"]')?.content;
if (build) document.getElementById("buildId").textContent = `Сборка ${build}`;
let current = null;
let zoom = "fit";

// ---------- Picker ----------
const SILHOUETTE_K = 0.17; // silhouettes keep the real relative sizes of the three iPads
for (const d of DEVICES) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sim-card";
  b.dataset.device = d.id;
  const frameW = (d.width + d.bezel * 2) * SILHOUETTE_K;
  const frameH = (d.height + d.bezel * 2) * SILHOUETTE_K;
  b.innerHTML = `
    <span class="sim-card__art">
      <span class="sim-card__ipad" data-camera="${d.camera}" style="width:${frameW.toFixed(1)}px;height:${frameH.toFixed(1)}px;--o:${((d.screenRadius + d.bezel) * SILHOUETTE_K).toFixed(1)}px;--b:${Math.max(3, d.bezel * SILHOUETTE_K).toFixed(1)}px;--r:${(d.screenRadius * SILHOUETTE_K).toFixed(1)}px">
        <span class="sim-card__screen"></span><span class="sim-card__cam"></span>
      </span>
    </span>
    <span class="sim-card__name">${d.name}</span>
    <span class="sim-card__spec ds-text-body-s">${d.width} × ${d.height} · ${d.chip}</span>`;
  b.setAttribute("aria-label", `${d.name}, ${d.width} на ${d.height}, горизонтально`);
  b.addEventListener("click", () => { location.hash = d.id; });
  els.list.append(b);
  const o = document.createElement("option");
  o.value = d.id;
  o.textContent = `${d.name} — ${d.width} × ${d.height}`;
  els.select.append(o);
}

// ---------- Device ----------
function applyDevice(d) {
  const first = !current;
  current = d;
  const root = els.ipad.style;
  root.setProperty("--w", `${d.width}px`);
  root.setProperty("--h", `${d.height}px`);
  root.setProperty("--bezel", `${d.bezel}px`);
  root.setProperty("--screen-r", `${d.screenRadius}px`);
  root.setProperty("--outer-r", `${d.screenRadius + d.bezel}px`);
  els.ipad.dataset.camera = d.camera;
  els.ipad.dataset.device = d.id;
  els.app.width = String(d.width);
  els.app.height = String(d.height);
  els.name.textContent = d.name;
  els.meta.textContent = `${d.model} · ${d.width} × ${d.height} CSS px, горизонтально`;
  els.select.value = d.id;
  document.title = `${d.name} — витрина THE CULTT`;
  if (first) { els.app.src = `./app.html${location.search}${appHash}`; appHash = ""; } // ?idle=… is passed through for testing
  layout();
}

function layout() {
  if (!current) return;
  const W = current.width + current.bezel * 2;
  const H = current.height + current.bezel * 2;
  const availW = els.stage.clientWidth - STAGE_PAD * 2;
  const availH = els.stage.clientHeight - STAGE_PAD * 2;
  const s = zoom === "fit" ? Math.min(1, availW / W, availH / H) : 1;
  els.ipad.style.transform = `scale(${s})`;
  els.slot.style.width = `${W * s}px`;
  els.slot.style.height = `${H * s}px`;
  els.stage.dataset.zoom = zoom;
  els.scale.textContent = `${Math.round(s * 100)}%`;
  for (const b of els.zoomButtons) b.setAttribute("aria-pressed", String(b.dataset.zoom === zoom));
  window.__sim = { device: current.id, scale: s, frame: [W, H], viewport: [current.width, current.height], zoom };
}

// ---------- Routing ----------
function route() {
  if (location.hash.startsWith("#/")) { // app route pasted while the simulator is open
    appHash = location.hash;
    history.replaceState(null, "", location.pathname + location.search + (current ? `#${current.id}` : ""));
    if (current && els.app.contentWindow) { els.app.contentWindow.location.hash = appHash; appHash = ""; }
  }
  const [id, z] = location.hash.slice(1).split("/");
  const d = deviceById(id);
  document.body.dataset.view = d ? "device" : "picker";
  els.picker.hidden = !!d;
  els.device.hidden = !d;
  if (!d) { document.title = "Витрина THE CULTT — симулятор iPad"; return; }
  zoom = z === "100" ? "100" : "fit";
  if (current?.id !== d.id) applyDevice(d);
  else layout();
}

els.back.addEventListener("click", () => { location.hash = ""; });
els.select.addEventListener("change", () => { location.hash = els.select.value + (zoom === "100" ? "/100" : ""); });
for (const b of els.zoomButtons) b.addEventListener("click", () => { location.hash = current.id + (b.dataset.zoom === "100" ? "/100" : ""); });
addEventListener("hashchange", route);
new ResizeObserver(layout).observe(els.stage);
route();
