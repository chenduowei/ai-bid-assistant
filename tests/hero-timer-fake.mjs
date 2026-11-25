/**
 * v0.54.0：英雄区 1 秒定时器的假时钟。
 *
 * 背景：v0.54.0 起 renderHero 会启动真 setInterval（1 秒）；node --test
 * 进程会被未清的 interval 钉住不退出（Node v24 实测：测试本身全过，
 * 进程仍挂起、timeout 15s 杀掉才结束）。凡是会调 renderHero / render /
 * renderAfterWrite、且状态里可能有未来开标项目的测试文件，都须在
 * import js/ui.js 之前装此桩。
 *
 * 只桩 setInterval / clearInterval，不动 setTimeout（form-locate 的 sleep
 * 还靠它），不碰 Date（时间用各文件自己的 FakeDate 或真实时钟）。
 * 每个测试文件是独立进程，桩只影响本文件。
 */
export function installHeroTimerFake() {
  const realSetInterval = globalThis.setInterval;
  const realClearInterval = globalThis.clearInterval;
  let nextId = 1;
  const created = []; // { id, fn, ms }
  const cleared = []; // id
  const active = new Map(); // id -> { id, fn, ms }
  globalThis.setInterval = (fn, ms, ...args) => {
    const id = nextId++;
    const entry = { id, fn, ms, args };
    created.push(entry);
    active.set(id, entry);
    return id;
  };
  globalThis.clearInterval = (id) => {
    cleared.push(id);
    active.delete(id);
  };
  return {
    created,
    cleared,
    active,
    activeCount: () => active.size,
    activeMs: () => [...active.values()].map((e) => e.ms),
    /** 手动驱动一次所有存活回调（模拟 1 秒过去；不推进真实时间）。 */
    tickAll: () => {
      for (const entry of [...active.values()]) entry.fn();
    },
    tick: (id) => active.get(id)?.fn(),
    restore: () => {
      globalThis.setInterval = realSetInterval;
      globalThis.clearInterval = realClearInterval;
    },
  };
}
