// Поиск, категории, фильтры и сортировка каталога витрины. Чистые функции: состояние → список лотов.
// Основа — логика мобильного каталога (thecultt-mobile-catalog/src/catalog-filters.js): фильтр по бренду,
// «Новое» (= состояние «Новое»), сортировка по цене; витрина показывает только доступные лоты.
// Для iPad бренд и состояние стали множественным выбором, добавлены цена «до», категории и поиск.

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
export const PRICE_LIMITS = [200_000, 250_000, 280_000];

export const createCatalogState = () => ({
  query: "",
  category: "all",
  sort: "new",
  brands: new Set(),
  conditions: new Set(),
  priceMax: null,
});

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

const passesFilters = (p, s) => (
  (!s.brands.size || s.brands.has(p.brand))
  && (!s.conditions.size || s.conditions.has(p.condition))
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

export const brandsOf = (products) => [...new Set(products.map((p) => p.brand))].sort((a, b) => a.localeCompare(b, "ru"));

// Активные фильтры как чипы; remove(state) снимает ровно этот фильтр.
export function activeFilterChips(s) {
  const chips = [];
  for (const b of s.brands) chips.push({ key: `brand:${b}`, label: b, remove: (st) => st.brands.delete(b) });
  for (const c of s.conditions) chips.push({ key: `cond:${c}`, label: `Состояние: ${c.toLowerCase()}`, remove: (st) => st.conditions.delete(c) });
  if (s.priceMax !== null) chips.push({ key: "price", label: `Цена: до ${money(s.priceMax)}`, remove: (st) => { st.priceMax = null; } });
  return chips;
}

export const clearFilters = (s) => { s.brands.clear(); s.conditions.clear(); s.priceMax = null; };

// «12 лотов», «1 лот», «3 лота».
export function lotsWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "лот";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "лота";
  return "лотов";
}
