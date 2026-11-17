// Выбор лотов на примерку: упорядоченный список id, не больше `limit`. Шестой лот не добавляется и ничего не
// вытесняет — toggle возвращает { ok: false, reason: "limit" }, экран показывает пояснение.
export const FITTING_LIMIT = 5;

export function createSelection({ limit = FITTING_LIMIT, onChange } = {}) {
  let ids = [];
  const emit = (change) => onChange?.({ ids: [...ids], ...change });
  return {
    limit,
    get ids() { return [...ids]; },
    get size() { return ids.length; },
    get full() { return ids.length >= limit; },
    has: (id) => ids.includes(id),
    toggle(id) {
      if (ids.includes(id)) {
        ids = ids.filter((x) => x !== id);
        emit({ type: "remove", id });
        return { ok: true, selected: false };
      }
      if (ids.length >= limit) return { ok: false, reason: "limit" };
      ids = [...ids, id];
      emit({ type: "add", id });
      return { ok: true, selected: true };
    },
    clear() {
      if (!ids.length) return;
      ids = [];
      emit({ type: "clear" });
    },
  };
}
