// Characteristics shown in the product page accordions («Информация о лоте», «Размеры»), structured like the
// THE CULTT website («Год выпуска: 2019», «Длина (см): 20»…).
//
// DEMO VALUES — the prototype's lot data (catalog/products.js) has only condition, colour and article. To evaluate
// the full expanded layout, the remaining rows use the representative defaults below, the same for every lot, and the
// page marks them as demo values. Real attributes, when a lot has them, always win. Replace DEMO_DETAILS with real
// lot data once it exists; nothing else needs to change.
export const DEMO_DETAILS = {
  info: {
    year: "2019",
    outerMaterial: "Кожа",
    lining: "Текстиль",
    hardware: "Серебристая",
    gender: "Женский",
    kit: "Пыльник",
  },
  sizes: {
    length: 30,
    width: 12,
    height: 22,
    handles: 18,
    strap: 90,
  },
};

const INFO_FIELDS = [
  ["year", "Год выпуска"],
  ["outerMaterial", "Внешний материал"],
  ["lining", "Материал подкладки"],
  ["hardware", "Фурнитура"],
  ["color", "Цвет"],
  ["condition", "Состояние"],
  ["gender", "Пол"],
  ["kit", "Комплект"],
  ["article", "Артикул"],
];
const SIZE_FIELDS = [
  ["length", "Длина (см)"],
  ["width", "Ширина (см)"],
  ["height", "Высота (см)"],
  ["handles", "Длина ручек (см)"],
  ["strap", "Длина плечевого ремня (см)"],
];

// → { info: [{ label, value, demo }], sizes: [...] } — real product fields first, demo defaults fill the gaps.
export function lotDetails(product) {
  const pick = (fields, demo) => fields
    .map(([key, label]) => {
      const real = product[key] ?? product.details?.[key];
      const value = real ?? demo[key];
      return value == null || value === "" ? null : { label, value: String(value), demo: real == null };
    })
    .filter(Boolean);
  return { info: pick(INFO_FIELDS, DEMO_DETAILS.info), sizes: pick(SIZE_FIELDS, DEMO_DETAILS.sizes) };
}
