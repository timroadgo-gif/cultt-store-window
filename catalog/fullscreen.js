// Shared fullscreen photo viewer for both product pages (standard and experimental gallery): PhotoSwipe 5 (vendored,
// MIT) — swipe between photos, pinch / double-tap zoom, pan, counter, UI Kit icons, ink background.
// The host keeps its gallery in sync through onChange(index) and gets the photo element for the open/close «zoom».
import PhotoSwipe from "../vendor/photoswipe/photoswipe.esm.min.js?v=824c37b7dc74";
import { iconMarkup } from "../design-system/icons/icon.js?v=824c37b7dc74";

const PHOTO = { w: 960, h: 1280 };
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const icon = (name, cls) => iconMarkup(name, { size: 24 }).replace('class="ds-icon"', `class="ds-icon pswp__icn ${cls}"`);

export function openFullscreen({ product, index, thumbFor, onChange, onClose }) {
  const pswp = new PhotoSwipe({
    dataSource: product.gallery.map((g) => ({ src: g.src, msrc: g.src, width: PHOTO.w, height: PHOTO.h, alt: `${product.brand} ${product.name}` })),
    index,
    bgOpacity: 1,
    showHideAnimationType: reducedMotion() ? "none" : "zoom",
    showAnimationDuration: 280,
    hideAnimationDuration: 240,
    initialZoomLevel: "fit",
    secondaryZoomLevel: 1.5, // double tap → 1.5 × the 960 × 1280 source
    maxZoomLevel: 3,
    wheelToZoom: true,
    loop: false,
    pinchToClose: false,
    closeOnVerticalDrag: true,
    imageClickAction: "zoom-or-close",
    tapAction: "toggle-controls",
    doubleTapAction: "zoom",
    bgClickAction: "close",
    paddingFn: () => ({ top: 24, bottom: 24, left: 72, right: 72 }),
    closeTitle: "Закрыть",
    zoomTitle: "Увеличить",
    arrowPrevTitle: "Предыдущее фото",
    arrowNextTitle: "Следующее фото",
    indexIndicatorSep: " / ",
    errorMsg: "Фото загрузится, когда вернется связь", // no connection and not cached yet
    closeSVG: icon("close", "kp-pswp-close"),
    zoomSVG: icon("search", "kp-pswp-zoom"),
    arrowPrevSVG: icon("chevron-left", "kp-pswp-arrow"),
    arrowNextSVG: icon("chevron-right", "kp-pswp-arrow"),
    mainClass: "kp-pswp",
    returnFocus: false, // the default would focus the photo it opened from and scroll the gallery back to it
  });
  pswp.addFilter("thumbEl", (el, data, k) => thumbFor(k) ?? el);
  pswp.addFilter("placeholderSrc", (src, slide) => product.gallery[slide.index]?.src ?? src);
  pswp.on("change", () => onChange?.(pswp.currIndex));
  pswp.on("destroy", () => onClose?.());
  pswp.init();
  return pswp;
}
