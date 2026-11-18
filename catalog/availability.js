// Прототипные сценарии доступности (только для демонстрации, данные лотов не меняются).
// «Часть лотов продана»: лоты, которые купили, пока посетитель собирал примерку. Состояние живет отдельно от
// products.js и от выбора: проданная отметка держится, пока лот в примерке; лот убрали → отметка снята.
// Сброс сценария (симулятор → «Сценарии» → «Обычный режим») или новый посетитель снимают все отметки.

// Детерминированный набор: 5 лотов в этом порядке, проданы 2-й и 4-й.
export const SOLD_SCENARIO = {
  ids: ["cultt-s31882541", "cultt-r30720497", "cultt-ns29336463", "cultt-p31913817", "cultt-r30006229"],
  sold: ["cultt-r30720497", "cultt-p31913817"],
};

export function createAvailability() {
  let sold = new Set();
  let scenario = null; // null | "sold"
  const subs = new Set();
  const emit = () => { for (const fn of subs) fn(); };
  return {
    isSold: (id) => sold.has(id),
    get sold() { return [...sold]; },
    get scenario() { return scenario; },
    start(name, ids) { scenario = name; sold = new Set(ids); emit(); },
    release(id) { if (sold.delete(id)) emit(); },
    reset() { const had = sold.size || scenario; sold = new Set(); scenario = null; if (had) emit(); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}

// «1 товар больше недоступен», «2 товара больше недоступны», «5 товаров больше недоступны».
export function unavailablePhrase(n) {
  const m10 = n % 10, m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? "товар" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "товара" : "товаров";
  return `${n} ${word} больше ${m10 === 1 && m100 !== 11 ? "недоступен" : "недоступны"}`;
}
