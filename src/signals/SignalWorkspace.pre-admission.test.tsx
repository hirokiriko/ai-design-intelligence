import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, signalApi, type SignalApi } from './api';
import { fictionalBootstrapV2 } from './fixtures';
import { SignalWorkspace } from './SignalWorkspace';
import { installPendingLocks } from './pending-locks.test-support';

// 既存Workspace試験と同じくeffectとhandlerを実行し、通知とPOST回数を確認する。
const hooks = vi.hoisted(() => ({
  active: false, stateIndex: 0, refIndex: 0,
  states: [] as unknown[], refs: [] as { current: unknown }[],
  effects: [] as (() => void | (() => void))[],
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.stateIndex++;
      if (index >= hooks.states.length) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (update: unknown) => {
        hooks.states[index] = typeof update === 'function' ? update(hooks.states[index]) : update;
      }];
    }) as typeof actual.useState,
    useRef: ((initial: unknown) => {
      if (!hooks.active) return actual.useRef(initial);
      const index = hooks.refIndex++;
      return hooks.refs[index] ??= { current: initial };
    }) as typeof actual.useRef,
    useCallback: ((callback: (...args: unknown[]) => unknown, dependencies: readonly unknown[]) => hooks.active ? callback : actual.useCallback(callback, dependencies)) as typeof actual.useCallback,
    useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
      if (!hooks.active) return actual.useEffect(effect, dependencies);
      hooks.effects.push(effect);
    },
  };
});

function workspaceTree(api: SignalApi) {
  hooks.stateIndex = 0; hooks.refIndex = 0; hooks.effects = [];
  hooks.active = true;
  try { return SignalWorkspace({ api }); } finally { hooks.active = false; }
}
type ElementProps = { children?: ReactNode; className?: string; disabled?: boolean; onClick?: () => void };
function findElement(node: ReactNode, matches: (element: ReactElement<ElementProps>) => boolean): ReactElement<ElementProps> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<ElementProps>(child)) continue;
    if (matches(child)) return child;
    const found = findElement(child.props.children, matches);
    if (found) return found;
  }
  return undefined;
}
const liveNotice = (api: SignalApi) => findElement(workspaceTree(api), (element) => element.props.className === 'signal-live')?.props.children;
const uncertainNotice = '通信または確認処理が完了していません。要求を再送せず、保存履歴で状態を確認してください。';
const watchId = 'FIXTURE-WATCH-NOTICE';
const requestId = 'FIXTURE-REQUEST-NOTICE';

describe('fresh run rejection notice', () => {
  let cleanups: (() => void)[];
  beforeEach(() => {
    installPendingLocks();
    hooks.states = []; hooks.refs = []; hooks.effects = []; hooks.active = false;
    cleanups = [];
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return values.size; },
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    });
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => requestId) });
    const location = { href: 'https://fixture.example.test/' };
    vi.stubGlobal('window', {
      location, history: { replaceState: vi.fn((_state: unknown, _title: string, url: unknown) => { location.href = String(url); }) },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
  });
  afterEach(() => { cleanups.forEach((cleanup) => cleanup()); hooks.active = false; vi.unstubAllGlobals(); });

  async function startWorkspace() {
    const bootstrap = structuredClone(fictionalBootstrapV2);
    bootstrap.watches[0].id = watchId;
    const api: SignalApi = {
      bootstrap: vi.fn().mockResolvedValue(bootstrap), runs: vi.fn().mockResolvedValue([]),
      run: vi.fn(), comparisonPairs: vi.fn(), saveWatch: vi.fn(), start: signalApi.start, requestRun: vi.fn(),
    };
    workspaceTree(api);
    cleanups = hooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledWith(watchId));
    const start = findElement(workspaceTree(api), (element) => element.type === 'button' && element.props.children === '更新を確認');
    expect(start?.props.disabled).toBe(false);
    return { api, start: start! };
  }

  it.each([
    [503, 'RUNS_DISABLED', '新しい実行は現在停止しています。保存履歴は閲覧できます。再開後に改めて実行してください。'],
    [409, 'RUN_IN_PROGRESS', '別の実行が処理中のため、今回の要求は受け付けていません。処理完了後に改めて実行してください。'],
  ] as const)('shows confirmed pre-admission rejection for %s/%s without resending', async (status, code, rejectionMessage) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ schemaVersion: '2.3.0', error: { code } }, { status }));
    vi.stubGlobal('fetch', fetcher);
    const { api, start } = await startWorkspace();
    start.props.onClick!();
    await vi.waitFor(() => expect(liveNotice(api)).toBe(`今回の要求は受付前に拒否されました。${rejectionMessage}自動では再送しません。`));
    expect(readPendingRunRequest()).toBeNull();
    expect(findElement(workspaceTree(api), (element) => element.type === 'button' && element.props.children === '更新を確認')?.props.disabled).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBe('POST');
    expect(api.requestRun).not.toHaveBeenCalled();
  });

  it('keeps the uncertain notice and pending after a generic 503 without resending', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ schemaVersion: '2.3.0', error: { code: 'SERVICE_UNAVAILABLE' } }, { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    const { api, start } = await startWorkspace();
    start.props.onClick!();
    await vi.waitFor(() => expect(liveNotice(api)).toBe(uncertainNotice));
    expect(readPendingRunRequest()).toEqual({ watchId, requestId });
    expect(findElement(workspaceTree(api), (element) => element.type === 'button' && element.props.children === '更新を確認')?.props.disabled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(api.requestRun).not.toHaveBeenCalled();
  });

  it('explains that an unsupported browser sent no request while keeping saved-history actions available', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const { api, start } = await startWorkspace();
    vi.stubGlobal('navigator', {});
    start.props.onClick!();
    await vi.waitFor(() => expect(liveNotice(api)).toBe('今回の新しい要求は送信していません。対応ブラウザーで開き直し、保存履歴から確認できます。自動では再送しません。'));
    expect(readPendingRunRequest()).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
    expect(findElement(workspaceTree(api), (element) => element.type === 'button' && element.props.children === '履歴を再取得')?.props.disabled).toBe(false);
  });

  it('rehydrates another watch pending from a storage event without automatically starting or resending it', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('FIXTURE-OTHER-TAB-RESPONSE-LOST'));
    vi.stubGlobal('fetch', fetcher);
    const { api } = await startWorkspace();
    await expect(signalApi.start('FIXTURE-WATCH-OTHER', 'check', 'FIXTURE-REQUEST-OTHER', 'FIXTURE-CSRF')).rejects.toMatchObject({ code: 'connection' });
    const listener = vi.mocked(window.addEventListener).mock.calls.find(([event]) => event === 'storage')?.[1];
    expect(typeof listener).toBe('function');
    if (typeof listener !== 'function') throw new Error('FIXTURE-STORAGE-LISTENER-MISSING');
    listener.call(window, new Event('storage'));
    const start = findElement(workspaceTree(api), (element) => element.type === 'button' && element.props.children === '更新を確認');
    expect(start?.props.disabled).toBe(false);
    expect(readPendingRunRequest()).toEqual({ watchId: 'FIXTURE-WATCH-OTHER', requestId: 'FIXTURE-REQUEST-OTHER' });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(api.requestRun).not.toHaveBeenCalled();
  });
});
