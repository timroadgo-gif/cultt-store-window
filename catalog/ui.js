// Small shared helpers for the kiosk screens.

// Action buttons in this flow are UI Kit Buttons with fully rounded (pill) ends: radius 9999px through the kit's
// corner system (`data-corner="circular"` = true capsule ends). Toolbar controls and icon buttons keep the kit radius.
export function pill(button) {
  button.classList.add("kiosk-pill");
  button.dataset.corner = "circular";
  return button;
}
