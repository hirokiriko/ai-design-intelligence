import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fictionalComparisonPair } from './fixtures-v22';
import { fictionalBootstrapV2, fictionalRunV2 } from './fixtures';
import { readPendingRunRequest, SignalApiError, type SignalApi } from './api';
import type { Run } from './contract';
import { comparisonStatusLabel } from './labels';
import { ComparisonPairSelector, PendingRunNotice, SignalWorkspace } from './SignalWorkspace';

// 初期effectと更新handlerを実行する。子カードの表示は既存SSRを使う。
const workspaceHooks = vi.hoisted(() => ({
  active: false, stateIndex: 0, refIndex: 0,
  states: [] as unknown[], refs: [] as { current: unknown }[],
  effects: [] as (() => void | (() => void))[],
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initial: unknown) => {
      if (!workspaceHooks.active) return actual.useState(initial);
      const index = workspaceHooks.stateIndex++;
      if (index >= workspaceHooks.states.length) workspaceHooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [workspaceHooks.states[index], (update: unknown) => {
        workspaceHooks.states[index] = typeof update === 'function' ? update(workspaceHooks.states[index]) : update;
      }];
    }) as typeof actual.useState,
    useRef: ((initial: unknown) => {
      if (!workspaceHooks.active) return actual.useRef(initial);
      const index = workspaceHooks.refIndex++;
      return workspaceHooks.refs[index] ??= { current: initial };
    }) as typeof actual.useRef,
    useCallback: ((callback: (...args: unknown[]) => unknown, dependencies: readonly unknown[]) => workspaceHooks.active ? callback : actual.useCallback(callback, dependencies)) as typeof actual.useCallback,
    useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
      if (!workspaceHooks.active) return actual.useEffect(effect, dependencies);
      workspaceHooks.effects.push(effect);
    },
  };
});

function workspaceTree(api: SignalApi) {
  workspaceHooks.stateIndex = 0; workspaceHooks.refIndex = 0; workspaceHooks.effects = [];
  workspaceHooks.active = true;
  try { return SignalWorkspace({ api }); } finally { workspaceHooks.active = false; }
}
function buttonNamed(node: ReactNode, label: string): ReactElement<{ children?: ReactNode; disabled?: boolean; onClick: () => void }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; disabled?: boolean; onClick: () => void }>(child)) continue;
    if (child.type === 'button' && child.props.children === label) return child;
    const found = buttonNamed(child.props.children, label);
    if (found) return found;
  }
  return undefined;
}

describe('comparison pair selection', () => {
  it('explains the fictional comparison status while preserving candidate values', () => {
    const pair = structuredClone(fictionalComparisonPair);
    const status = pair.media[0].comparisonStatus;
    const html = renderToStaticMarkup(createElement(ComparisonPairSelector, {
      pairs: [pair], state: 'ready', selectedId: pair.id, busy: false,
      onSelect: () => undefined, onReload: () => undefined,
    }));
    expect(html).toContain('次の実行に使う比較組');
    expect(html).toContain('管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）');
    expect(html).not.toContain(status);
    expect(pair.media[0].comparisonStatus).toBe(status);
  });
  it('hides unknown backend comparison codes in the selection while retaining the candidate', () => {
    const pair = structuredClone(fictionalComparisonPair);
    pair.media[0].comparisonStatus = 'orientation_unverified';
    pair.media[1].comparisonStatus = 'orientation_unverified';
    const html = renderToStaticMarkup(createElement(ComparisonPairSelector, {
      pairs: [pair], state: 'ready', selectedId: pair.id, busy: false,
      onSelect: () => undefined, onReload: () => undefined,
    }));
    expect(html).toContain('比較条件の詳細は未確認');
    expect(html).not.toContain('orientation_unverified');
    expect(pair.media[0].comparisonStatus).toBe('orientation_unverified');
  });
  it('explains a registered unknown scale and retains descriptive Japanese input', () => {
    expect(comparisonStatusLabel('scale_unknown')).toBe('縮尺は未確認');
    expect(comparisonStatusLabel('同方向を確認')).toBe('同方向を確認');
    expect(comparisonStatusLabel('3D形状の縮尺は未確認')).toBe('3D形状の縮尺は未確認');
  });
});

describe('pending run recovery notice', () => {
  it('offers only outcome lookup after a lost response without exposing the request identifiers', () => {
    const html = renderToStaticMarkup(createElement(PendingRunNotice, {
      pending: { watchId: 'private-watch-id', requestId: 'private-request-id' }, busy: false, onRecover: () => undefined,
    }));
    expect(html).toContain('新しい実行を開始しません');
    expect(html).toContain('要求を再送することはありません');
    expect(html).toContain('保留した実行の状態を確認');
    expect(html).not.toContain('private-watch-id');
    expect(html).not.toContain('private-request-id');
    expect(html).not.toContain('disabled=""');
  });

  it('disables lookup during another GET and offers no reset when pending storage is unreadable', () => {
    const waiting = renderToStaticMarkup(createElement(PendingRunNotice, {
      pending: { watchId: 'watch-example', requestId: 'request-lost' }, busy: true, onRecover: () => undefined,
    }));
    expect(waiting).toContain('disabled=""');
    const unreadable = renderToStaticMarkup(createElement(PendingRunNotice, { pending: 'unavailable', busy: false, onRecover: () => undefined }));
    expect(unreadable).toContain('保存結果は閲覧できます');
    expect(unreadable).toContain('新しい実行は開始しません');
    expect(unreadable).not.toContain('<button');
  });
});

describe('saved URL initialization', () => {
  let cleanups: (() => void)[];
  let values: Map<string, string>;
  let location: { href: string };
  beforeEach(() => {
    workspaceHooks.states = []; workspaceHooks.refs = []; workspaceHooks.effects = []; workspaceHooks.active = false;
    cleanups = []; values = new Map();
    location = { href: `https://signals.example.test/?run=${fictionalRunV2.id}` };
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); }),
    });
    vi.stubGlobal('window', {
      location, history: { replaceState: vi.fn((_state: unknown, _title: string, url: unknown) => { location.href = String(url); }) },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
  });
  afterEach(() => { cleanups.forEach((cleanup) => cleanup()); workspaceHooks.active = false; vi.unstubAllGlobals(); });

  function startWorkspace(api: SignalApi) {
    workspaceTree(api);
    cleanups = workspaceHooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  }
  function savedApi(): SignalApi {
    return {
      bootstrap: vi.fn().mockResolvedValue(fictionalBootstrapV2), run: vi.fn().mockResolvedValue(fictionalRunV2),
      runs: vi.fn(), comparisonPairs: vi.fn(), saveWatch: vi.fn(), start: vi.fn(), requestRun: vi.fn(),
    };
  }

  it('shows the exact saved result before history resolves and preserves it after history failure and GET recovery', async () => {
    const api = savedApi();
    let rejectHistory!: (failure: Error) => void;
    const initialHistory = new Promise<Run[]>((_resolve, reject) => { rejectHistory = reject; });
    vi.mocked(api.runs).mockReturnValueOnce(initialHistory).mockResolvedValueOnce([fictionalRunV2]);
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledWith(fictionalRunV2.watchId));
    const beforeHistory = renderToStaticMarkup(workspaceTree(api));
    expect(beforeHistory).toContain('保存された確認結果');
    expect(beforeHistory).toContain(fictionalRunV2.createdAt);
    expect(beforeHistory).toContain(fictionalRunV2.signal!.officialFacts[0].quote);
    expect(new URL(location.href).searchParams.get('run')).toBe(fictionalRunV2.id);

    rejectHistory(new SignalApiError('503', '履歴を取得できません。'));
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('履歴一覧の取得には失敗しました'));
    const failedTree = workspaceTree(api);
    expect(renderToStaticMarkup(failedTree)).toContain('保存された確認結果');
    expect(renderToStaticMarkup(failedTree)).toContain('保存履歴を取得できません');
    const reload = buttonNamed(failedTree, '履歴を再取得');
    expect(reload).toBeDefined(); expect(reload!.props.disabled).toBe(false);
    reload!.props.onClick();
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('保存履歴を再取得しました。AIは実行していません。'));
    expect(api.runs).toHaveBeenCalledTimes(2);
    expect(new URL(location.href).searchParams.get('run')).toBe(fictionalRunV2.id);
    expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled(); expect(api.requestRun).not.toHaveBeenCalled();
  });

  it('keeps run A selected while an unrelated unresolved request B stays durable and blocks new POSTs', async () => {
    const pending = { watchId: 'watch-other-pending', requestId: 'request-other-pending' };
    const pendingValue = JSON.stringify(pending);
    values.set('kiriko-design-signals-pending-request', pendingValue);
    const api = savedApi();
    vi.mocked(api.runs).mockImplementation(async (watchId) => {
      if (watchId !== fictionalRunV2.watchId) throw new SignalApiError('403', '別条件は審査範囲外です。');
      return [fictionalRunV2];
    });
    startWorkspace(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('保存された確認結果'));
    const tree = workspaceTree(api);
    const html = renderToStaticMarkup(tree);
    expect(html).toContain(fictionalRunV2.createdAt);
    expect(html).toContain(fictionalRunV2.signal!.officialFacts[0].quote);
    expect(html).toContain('前の実行要求の成否を確認するまで');
    expect(new URL(location.href).searchParams.get('run')).toBe(fictionalRunV2.id);
    expect(readPendingRunRequest()).toEqual(pending);
    expect(values.get('kiriko-design-signals-pending-request')).toBe(pendingValue);
    expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(api.runs).toHaveBeenCalledExactlyOnceWith(fictionalRunV2.watchId);
    const start = buttonNamed(tree, '更新を確認');
    expect(start).toBeDefined(); expect(start!.props.disabled).toBe(true);
    start!.props.onClick();
    expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled(); expect(api.requestRun).not.toHaveBeenCalled();
  });
});
