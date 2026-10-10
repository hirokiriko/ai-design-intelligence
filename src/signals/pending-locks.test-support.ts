import { vi } from 'vitest';

// 実navigator.locksと同じ、origin内の同名exclusive待機列を各moduleから共有する。
export function installPendingLocks() {
  const queues = new Map<string, Promise<void>>();
  const request = vi.fn(async (name: string, options: LockOptions, callback: (lock: Lock) => unknown) => {
    if (options.mode !== 'exclusive') throw new Error('FIXTURE-EXCLUSIVE-ONLY');
    const previous = queues.get(name) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    queues.set(name, previous.then(() => held));
    await previous;
    try { return await callback({ name, mode: 'exclusive' }); }
    finally { release(); }
  });
  vi.stubGlobal('navigator', { locks: { request } });
  return request;
}
