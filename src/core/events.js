// 事件总线 —— 事件名见 DESIGN.md §7
export function createBus() {
  const map = new Map();
  const bus = {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => bus.off(name, fn);
    },
    off(name, fn) {
      map.get(name)?.delete(fn);
    },
    once(name, fn) {
      const off = bus.on(name, (p) => {
        off();
        fn(p);
      });
      return off;
    },
    emit(name, payload) {
      for (const fn of [...(map.get(name) || [])]) {
        try {
          fn(payload);
        } catch (e) {
          console.error(`[bus] handler for ${name} failed`, e);
        }
      }
      for (const fn of [...(map.get('*') || [])]) {
        try {
          fn({ name, payload });
        } catch (e) {
          console.error('[bus] wildcard handler failed', e);
        }
      }
    },
  };
  return bus;
}
