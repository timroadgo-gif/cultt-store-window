// iPad presets for the desktop simulator. Landscape logical viewport = Safari's CSS viewport on that model
// (portrait points from Apple's tech specs, swapped). Frame geometry (bezel, corner radii, camera) is an approximation of
// the physical device for a recognisable frame; it never changes the app viewport.
export const DEVICES = [
  {
    id: "mini",
    name: "iPad mini",
    model: "iPad mini (A17 Pro, 2024)",
    chip: "A17 Pro · 8,3″",
    width: 1133, height: 744, // 744 × 1133 pt portrait
    bezel: 19, screenRadius: 22, camera: "side", // front camera on the short edge → left side in landscape
  },
  {
    id: "air",
    name: "iPad Air 13″",
    model: "iPad Air 13″ (M2, 2024; у M3, 2025 — тот же экран)",
    chip: "M2 / M3 · 13″",
    width: 1366, height: 1024, // 1024 × 1366 pt portrait
    bezel: 20, screenRadius: 18, camera: "top", // landscape front camera on the long edge
  },
  {
    id: "pro",
    name: "iPad Pro",
    model: "iPad Pro 13″ (M4, 2024)",
    chip: "M4 · 13″",
    width: 1376, height: 1032, // 1032 × 1376 pt portrait
    bezel: 17, screenRadius: 30, camera: "top",
  },
];

export const deviceById = (id) => DEVICES.find((d) => d.id === id) ?? null;
