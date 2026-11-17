// Welcome-screen showcase: two columns of decorative product cards drifting in opposite directions.
// Seamless loop: each column track holds the same sequence twice ([A][A]); a linear CSS animation moves the track
// by exactly one sequence (translateY 0 → -50 %, or the reverse), so the last frame equals the first.
// Every card carries its own trailing gap (margin-bottom), so one sequence is exactly half the track.
// Duration = sequence height / speed, so both columns move at the same constant px/s at any screen size.
import { SHOWCASE_SPEED_PX_S } from "./config.js?v=5bc579cdda05";

const card = ({ name, image }) => {
  const el = document.createElement("figure");
  el.className = "showcase-card ds-corner";
  const img = document.createElement("img");
  img.className = "showcase-card__image";
  img.src = image;
  img.alt = "";
  img.decoding = "async";
  img.draggable = false;
  const label = document.createElement("figcaption");
  label.className = "showcase-card__label ds-corner ds-text-body-s";
  label.textContent = name;
  el.append(img, label);
  return el;
};

export function mountShowcase(root, columns) {
  const tracks = columns.map((items, i) => {
    const col = document.createElement("div");
    col.className = "showcase__column";
    const track = document.createElement("div");
    track.className = "showcase__track";
    track.dataset.direction = i % 2 === 0 ? "up" : "down";
    col.append(track);
    root.append(col);
    return { col, track, items };
  });

  // Fill each half with whole copies of the sequence until it covers the visible column (needed only on very
  // tall screens), then duplicate the half. Recomputed on resize.
  const layout = () => {
    for (const { col, track, items } of tracks) {
      track.replaceChildren();
      // Whole-pixel card height (square, = column width): one sequence is then an integer distance, so the
      // wrap from -50 % back to 0 lands on the same pixel grid and shows no sub-pixel shift.
      track.style.setProperty("--showcase-card-height", `${Math.round(col.clientWidth)}px`);
      const seq = () => items.map(card);
      track.append(...seq());
      const seqHeight = track.scrollHeight;
      if (!seqHeight) continue;
      const copies = Math.max(1, Math.ceil(col.clientHeight / seqHeight));
      for (let c = 1; c < copies; c++) track.append(...seq());
      const half = [...track.children];
      half.forEach((n) => n.setAttribute("data-half", "a"));
      track.append(...half.map((n) => { const d = n.cloneNode(true); d.dataset.half = "b"; return d; }));
      const distance = seqHeight * copies; // = half of the track
      track.style.setProperty("--showcase-duration", `${(distance / SHOWCASE_SPEED_PX_S).toFixed(3)}s`);
      track.dataset.distance = String(distance);
    }
  };

  let raf = 0;
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); });
  ro.observe(root);
  layout();

  return {
    setRunning(on) { root.dataset.running = on ? "true" : "false"; },
    dispose() { ro.disconnect(); cancelAnimationFrame(raf); root.replaceChildren(); },
  };
}
