// Поиск, категории, фильтры и сортировка каталога витрины. Чистые функции: состояние → список лотов.
// Основа — логика мобильного каталога (thecultt-mobile-catalog/src/catalog-filters.js): фильтр по бренду,
// «Новое» (= состояние «Новое»), сортировка по цене; витрина показывает только доступные лоты.
// Для iPad: фильтры как на сайте THE CULTT — тип, бренд, модель, цена от–до, цвет, состояние (множественный выбор),
// плюс категории и поиск. Материала в данных лотов нет, поэтому фильтра «Материал» нет.

export const CATEGORIES = [
  { id: "all", label: "Все" },
  { id: "bags", label: "Сумки" },
  { id: "shoes", label: "Обувь" },
  { id: "jewelry", label: "Украшения" },
  { id: "watches", label: "Часы" },
  { id: "accessories", label: "Аксессуары" },
];

// «Сначала новые» = порядок выдачи сайта (дат публикации в данных нет). Цена — как в мобильном каталоге.
export const SORT_OPTIONS = [
  { id: "new", label: "Сначала новые" },
  { id: "price-asc", label: "Сначала дешевле" },
  { id: "price-desc", label: "Сначала дороже" },
];

export const CONDITIONS = ["Новое", "Отличное", "Хорошее"];
// «Чаще всего ищут» — порядок блока на сайте THE CULTT (фильтр «Бренд»); показываются только бренды, которые есть в каталоге.
export const POPULAR_BRANDS = ["Hermes", "The Row", "Celine", "Chanel", "Gucci", "Louis Vuitton", "Saint Laurent"];
export const modelKey = (p) => `${p.brand} ${p.name}`;

export const createCatalogState = () => ({
  query: "",
  category: "all",
  sort: "new",
  ...createFilters(),
});

// The filter part of the state (what the filters panel edits as a draft and applies at once).
export const createFilters = () => ({
  types: new Set(),
  brands: new Set(),
  models: new Set(),
  colors: new Set(),
  conditions: new Set(),
  priceMin: null,
  priceMax: null,
});
export const FILTER_SETS = ["types", "brands", "models", "colors", "conditions"];
export const copyFilters = (s) => ({
  ...Object.fromEntries(FILTER_SETS.map((k) => [k, new Set(s[k])])),
  priceMin: s.priceMin,
  priceMax: s.priceMax,
});
export const assignFilters = (target, f) => { Object.assign(target, copyFilters(f)); return target; };


// «292 000 ₽»: group separator and the space before «₽» are no-break spaces, so a price never wraps.
export const money = (amount) => `${new Intl.NumberFormat("ru-RU").format(amount).replace(/\s/g, "\u00a0")}\u00a0₽`;

// «Hermès» ≈ «hermes», «ё» ≈ «е», регистр не важен.
const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ё/g, "е").trim();

export function matchesQuery(p, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm(`${p.brand} ${p.name} ${p.article}`);
  return words.every((w) => hay.includes(w));
}

export const passesFilters = (p, s) => (
  (!s.types.size || s.types.has(p.subcategory))
  && (!s.brands.size || s.brands.has(p.brand))
  && (!s.models.size || s.models.has(modelKey(p)))
  && (!s.colors.size || s.colors.has(p.color))
  && (!s.conditions.size || s.conditions.has(p.condition))
  && (s.priceMin === null || p.price >= s.priceMin)
  && (s.priceMax === null || p.price <= s.priceMax)
);

export function applyCatalog(products, s) {
  const list = products.filter((p) => (
    p.availability === "available"
    && (s.category === "all" || p.category === s.category)
    && matchesQuery(p, s.query)
    && passesFilters(p, s)
  ));
  if (s.sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
  if (s.sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
  return list;
}

const uniqSorted = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, "ru"));
export const brandsOf = (products) => uniqSorted(products.map((p) => p.brand));
export const typesOf = (products) => uniqSorted(products.map((p) => p.subcategory));
export const colorsOf = (products) => uniqSorted(products.map((p) => p.color));
export const modelsOf = (products) => uniqSorted(products.map(modelKey));
// Price slider bounds: the catalogue's range, widened to whole 10 000 ₽.
export const priceBounds = (products) => {
  const prices = products.map((p) => p.price);
  return { min: Math.floor(Math.min(...prices) / 10_000) * 10_000, max: Math.ceil(Math.max(...prices) / 10_000) * 10_000 };
};
const bare = (n) => new Intl.NumberFormat("ru-RU").format(n).replace(/\s/g, "\u00a0");
export const priceRangeLabel = (min, max) => (
  min !== null && max !== null ? `${bare(min)}\u00a0–\u00a0${money(max)}` : min !== null ? `от\u00a0${money(min)}` : `до\u00a0${money(max)}`
);

// Активные фильтры как чипы; remove(state) снимает ровно этот фильтр.
export function activeFilterChips(s) {
  const chips = [];
  for (const v of s.types) chips.push({ key: `type:${v}`, label: v, remove: (st) => st.types.delete(v) });
  for (const b of s.brands) chips.push({ key: `brand:${b}`, label: b, remove: (st) => st.brands.delete(b) });
  for (const m of s.models) chips.push({ key: `model:${m}`, label: m, remove: (st) => st.models.delete(m) });
  if (s.priceMin !== null || s.priceMax !== null) chips.push({ key: "price", label: `Цена: ${priceRangeLabel(s.priceMin, s.priceMax)}`, remove: (st) => { st.priceMin = null; st.priceMax = null; } });
  for (const c of s.colors) chips.push({ key: `color:${c}`, label: `Цвет: ${c.toLowerCase()}`, remove: (st) => st.colors.delete(c) });
  for (const c of s.conditions) chips.push({ key: `cond:${c}`, label: `Состояние: ${c.toLowerCase()}`, remove: (st) => st.conditions.delete(c) });
  return chips;
}

export const clearFilters = (s) => assignFilters(s, createFilters());

// «12 лотов», «1 лот», «3 лота».
export function lotsWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "лот";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "лота";
  return "лотов";
}
