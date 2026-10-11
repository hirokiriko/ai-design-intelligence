import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, readPendingRunRequests, signalApi } from './api';
import { fictionalBootstrapV22, fictionalPairsResponse, fictionalRunV22 } from './fixtures-v22';
import { ComparisonPairSelector, PendingRunNotice, SignalWorkspace } from './SignalWorkspace';
import { installPendingLocks } from './pending-locks.test-support';
import type { Run, WatchInput } from './contract';
import { SignalHistory } from './SignalHistory';

const saved = { ...structuredClone(fictionalRunV22), id: 'FIXTURE-RUN-CURRENT', watchId: 'FIXTURE-WATCH-CURRENT', input: { ...fictionalRunV22.input, watch: { ...fictionalRunV22.input.watch, id: 'FIXTURE-WATCH-CURRENT' } } };
const bootstrap = { ...structuredClone(fictionalBootstrapV22), watches: [saved.input.watch], catalog: {
  entities: [{ ...fictionalBootstrapV22.catalog.entities[0], id: saved.input.watch.entityId, name: saved.input.context.entity.name }],
  categories: [{ ...fictionalBootstrapV22.catalog.categories[0], id: saved.input.watch.categoryId }],
  datasets: [
    { ...fictionalBootstrapV22.catalog.datasets[0], id: saved.input.watch.beforeDatasetId, dataAsOf: saved.input.context.beforeDataset.dataAsOf },
    { ...fictionalBootstrapV22.catalog.datasets[1], id: saved.input.watch.afterDatasetId, dataAsOf: saved.input.context.afterDataset.dataAsOf },
  ],
  sourceProfiles: [{ ...fictionalBootstrapV22.catalog.sourceProfiles[0], id: saved.input.watch.sourceProfileId }],
} };
const pairs = fictionalPairsResponse;
const pairId = pairs.comparisonPairs[0].id;
const newWatch = { ...saved.input.watch, id: 'FIXTURE-WATCH-NEWLY-SAVED' };
const scopedKey = (watchId: string, requestId: string) => `kiriko-design-signals-pending-request:${encodeURIComponent(watchId)}:${requestId}`;
const legacy = { watchId: 'FIXTURE-WATCH-LEGACY-OUTSIDE-SCOPE', requestId: 'FIXTURE-REQUEST-LEGACY-UNCERTAIN' };
const key = 'kiriko-design-signals-pending-request';
const legacyValue = JSON.stringify(legacy);

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

type Props = { children?: ReactNode; disabled?: boolean; value?: string; runs?: Run[]; onClick?: () => void; onRecover?: () => void; onSelect?: (id: string) => void; onChange?: (event: { target: { value: string } }) => void; onSave?: (input: WatchInput) => Promise<void> };
function tree() {
  hooks.stateIndex = 0; hooks.refIndex = 0; hooks.effects = []; hooks.active = true;
  try { return SignalWorkspace({ api: signalApi }); } finally { hooks.active = false; }
}
function find(node: ReactNode, matches: (element: ReactElement<Props>) => boolean): ReactElement<Props> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Props>(child)) continue;
    if (matches(child)) return child;
    const found = find(child.props.children, matches);
    if (found) return found;
  }
  return undefined;
}
const button = (label: string) => find(tree(), (element) => element.type === 'button' && element.props.children === label);
const markup = () => renderToStaticMarkup(tree());


describe('separate watch pending without discarding legacy uncertainty', () => {
  let store: Map<string, string>;
  let calls: { path: string; method: string; body?: string }[];
  let cleanups: (() => void)[];
  let denial: 403 | 404 | 'network';
  let oldResult: typeof saved | null;
  let oldUrlResult: Run | null;
  let postFailure: null | 'network' | 'fixed409' | 'generic409';
  let location: { href: string };
  beforeEach(() => {
    hooks.states = []; hooks.refs = []; hooks.effects = []; hooks.active = false;
    store = new Map([[key, legacyValue]]); calls = []; cleanups = []; denial = 403; oldResult = null; oldUrlResult = null; postFailure = null;
    installPendingLocks();
    location = { href: 'https://kds-fixture.example.test/' };
    vi.stubGlobal('localStorage', {
      get length() { return store.size; }, key: vi.fn((index: number) => [...store.keys()][index] ?? null),
      getItem: vi.fn((name: string) => store.get(name) ?? null),
      setItem: vi.fn((name: string, value: string) => { store.set(name, value); }),
      removeItem: vi.fn((name: string) => { store.delete(name); }),
    });
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'FIXTURE-REQUEST-CURRENT-NEW') });
    vi.stubGlobal('window', {
      location, history: { replaceState: vi.fn((_state: unknown, _title: string, url: unknown) => { location.href = String(url); }) },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
      const method = options.method ?? 'GET'; calls.push({ path, method, body: options.body as string | undefined });
      if (path === '/api/v1/bootstrap?analysisQuestionVersion=1.0.0') return Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_REQUEST' } }, { status: 400 });
      if (path === '/api/v1/bootstrap') return Response.json(bootstrap);
      if (path === `/api/v1/runs/${saved.id}`) return Response.json(saved);
      if (path === `/api/v1/runs?watchId=${saved.watchId}`) return Response.json({ schemaVersion: '2.2.0', runs: [saved] });
      if (path === `/api/v1/watches/${saved.watchId}/comparison-pairs`) return Response.json(pairs);
      if (path === `/api/v1/watches/${newWatch.id}/comparison-pairs`) return Response.json(pairs);
      if (path === '/api/v1/watches' && method === 'POST') return Response.json(newWatch);
      if (path === `/api/v1/watches/${saved.watchId}/runs` && method === 'POST') {
        if (postFailure === 'network') throw new TypeError('FIXTURE-RESPONSE-LOST');
        if (postFailure) return Response.json({ schemaVersion: '2.3.0', error: { code: postFailure === 'fixed409' ? 'RUN_IN_PROGRESS' : 'REQUEST_CONFLICT' } }, { status: 409 });
        return Response.json(saved);
      }
      if (path === `/api/v1/watches/${legacy.watchId}/requests/${legacy.requestId}` && oldResult) return Response.json(oldResult);
      if (path === '/api/v1/runs/FIXTURE-RUN-OLD-URL' && oldUrlResult) return Response.json(oldUrlResult);
      if (path === `/api/v1/runs/FIXTURE-RUN-OLD-URL` || path.includes(legacy.watchId)) {
        if (denial === 'network') throw new TypeError('FIXTURE-OLD-LOOKUP-FAILED');
        return Response.json({ schemaVersion: '2.3.0', error: { code: 'FIXTURE-SCOPE-DENIED' } }, { status: denial });
      }
      throw new Error('FIXTURE-UNEXPECTED-REQUEST');
    }));
  });
  afterEach(() => { cleanups.forEach((cleanup) => cleanup()); hooks.active = false; vi.unstubAllGlobals(); });
  function mount() {
    tree(); cleanups = hooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  }
  async function ready() {
    mount(); await vi.waitFor(() => expect(markup()).toContain('比較組を選択してください'));
    await vi.waitFor(() => expect(markup()).toContain('保存された確認結果'));
    find(tree(), (element) => element.type === ComparisonPairSelector)!.props.onSelect!(pairId);
  }
  const posts = () => calls.filter((call) => call.method === 'POST');
  function oldUnchanged() { expect(store.get(key)).toBe(legacyValue); expect(readPendingRunRequest(legacy.watchId)).toEqual(legacy); }

  it('initializes the current permitted watch without polling or deleting an unavailable legacy watch', async () => {
    await ready(); expect(button('更新を確認')?.props.disabled).toBe(false);
    expect(markup()).toContain('現在の登録範囲に含まれない');
    expect(calls.some((call) => call.path.includes(legacy.watchId))).toBe(false);
    expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled(); oldUnchanged();
    expect(posts()).toHaveLength(0);
  });
  it('keeps outside-watch complete/running saved URLs readable without polling, while same-watch running still blocks', async () => {
    for (const scenario of ['outside-complete', 'outside-running', 'same-watch-running'] as const) {
      const status = scenario === 'outside-complete' ? 'complete' : 'running';
      const outside = scenario !== 'same-watch-running';
      const savedWatchId = outside ? legacy.watchId : saved.watchId;
      cleanups.forEach((cleanup) => cleanup()); hooks.states = []; hooks.refs = []; hooks.effects = []; cleanups = []; calls = [];
      store = new Map([[key, legacyValue]]);
      oldUrlResult = { ...saved, id: 'FIXTURE-RUN-OLD-URL', watchId: savedWatchId, status,
        completedAt: status === 'running' ? null : saved.completedAt, signal: status === 'running' ? null : saved.signal,
        input: { ...saved.input, watch: { ...saved.input.watch, id: savedWatchId } } };
      location.href = 'https://kds-fixture.example.test/?run=FIXTURE-RUN-OLD-URL'; mount();
      await vi.waitFor(() => expect(button('履歴を再取得')?.props.disabled).toBe(false));
      await vi.waitFor(() => expect(markup()).toContain('比較組を選択してください'));
      if (outside) expect(markup()).toContain('指定された保存結果を閲覧しています');
      expect(markup()).toContain('保存された確認結果');
      expect(new URL(location.href).searchParams.get('run')).toBe('FIXTURE-RUN-OLD-URL');
      const selector = find(tree(), (element) => element.type === 'select' && typeof element.props.onChange === 'function');
      expect(selector?.props.value).toBe(saved.watchId);
      expect(calls.filter((call) => call.path.includes(legacy.watchId))).toEqual([]);
      expect(calls.filter((call) => call.path === `/api/v1/runs?watchId=${saved.watchId}`)).toHaveLength(1);
      expect(find(tree(), (element) => element.type === SignalHistory)?.props.runs?.map((run) => run.id)).toEqual(outside ? [saved.id] : ['FIXTURE-RUN-OLD-URL', saved.id]);
      find(tree(), (element) => element.type === ComparisonPairSelector)!.props.onSelect!(pairId);
      expect(button('更新を確認')?.props.disabled).toBe(!outside); expect(button('別の実行として再確認')).toBeUndefined();
      oldUnchanged(); expect(posts()).toHaveLength(0);
      expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled();
    }
  });
  it.each([403, 404, 'network'] as const)('keeps the permitted catalog, selected result and old pending after explicit out-of-scope GET %s', async (failure) => {
    denial = failure; location.href += `?run=${saved.id}`; await ready();
    find(tree(), (element) => element.type === PendingRunNotice)!.props.onRecover!();
    await vi.waitFor(() => expect(markup()).toContain('要求は再送していません'));
    expect(markup()).toContain('保存した確認条件'); expect(markup()).toContain('保存された確認結果');
    expect(button('更新を確認')?.props.disabled).toBe(false);
    expect(new URL(location.href).searchParams.get('run')).toBe(saved.id);
    expect(calls.some((call) => call.path === `/api/v1/runs?watchId=${legacy.watchId}`)).toBe(false);
    oldUnchanged(); expect(posts()).toHaveLength(0);
  });
  it.each([403, 404, 'network'] as const)('retains the current catalog and old pending after a stale saved URL GET %s', async (failure) => {
    denial = failure; location.href += '?run=FIXTURE-RUN-OLD-URL'; await ready();
    expect(markup()).toContain('指定された保存結果は取得できません'); expect(button('更新を確認')?.props.disabled).toBe(false);
    oldUnchanged(); expect(posts()).toHaveLength(0);
  });
  it('executes one explicit current-watch request, ignores duplicate clicks and clears only its own terminal key', async () => {
    await ready(); const start = button('更新を確認')!; start.props.onClick!(); start.props.onClick!();
    await vi.waitFor(() => expect(markup()).toContain('確認結果を表示しました'));
    expect(posts()).toHaveLength(1); expect(JSON.parse(posts()[0].body!).requestId).toBe('FIXTURE-REQUEST-CURRENT-NEW');
    expect(store.size).toBe(1); expect(vi.mocked(localStorage.removeItem).mock.calls).toEqual([[scopedKey(saved.watchId, 'FIXTURE-REQUEST-CURRENT-NEW')]]);
    oldUnchanged();
  });
  it('saves a new condition explicitly while preserving old uncertainty and never starting analysis', async () => {
    await ready(); button('＋ 確認条件を保存')!.props.onClick!();
    const form = find(tree(), (element) => typeof element.props.onSave === 'function');
    expect(form).toBeDefined();
    const { name, entityId, categoryId, beforeDatasetId, afterDatasetId, sourceProfileId } = newWatch;
    await form!.props.onSave!({ name, entityId, categoryId, beforeDatasetId, afterDatasetId, sourceProfileId });
    expect(posts()).toHaveLength(1); expect(posts()[0].path).toBe('/api/v1/watches'); oldUnchanged();
    expect(new URL(location.href).searchParams.has('run')).toBe(false);
    expect(calls.some((call) => call.path.endsWith('/runs') && call.method === 'POST')).toBe(false);
  });
  it('retains both legacy and new uncertainty across reload, blocks the same watch and never resends', async () => {
    postFailure = 'network'; await ready(); button('更新を確認')!.props.onClick!();
    await vi.waitFor(() => expect(readPendingRunRequest(saved.watchId)?.requestId).toBe('FIXTURE-REQUEST-CURRENT-NEW'));
    await vi.waitFor(() => expect(button('更新を確認')?.props.disabled).toBe(true));
    cleanups.forEach((cleanup) => cleanup()); hooks.states = []; hooks.refs = []; hooks.effects = []; cleanups = [];
    await ready(); expect(button('更新を確認')?.props.disabled).toBe(true); button('更新を確認')!.props.onClick!();
    expect(readPendingRunRequests()).toHaveLength(2); oldUnchanged(); expect(posts()).toHaveLength(1);
  });
  it.each(['fixed409', 'generic409'] as const)('preserves legacy while handling a fresh new-watch %s response', async (failure) => {
    postFailure = failure;
    await expect(signalApi.start(saved.watchId, 'check', 'FIXTURE-REQUEST-CURRENT-NEW', bootstrap.csrfToken, pairId)).rejects.toMatchObject({ code: '409' });
    oldUnchanged(); expect(posts()).toHaveLength(1);
    expect(readPendingRunRequest(saved.watchId)).toEqual(failure === 'fixed409' ? null : { watchId: saved.watchId, requestId: 'FIXTURE-REQUEST-CURRENT-NEW' });
  });
  it('blocks same-watch legacy and scoped requests independently and clearing one exact outcome cannot clear the other', async () => {
    const second = { watchId: legacy.watchId, requestId: 'FIXTURE-REQUEST-LEGACY-SECOND' };
    store.set(scopedKey(second.watchId, second.requestId), JSON.stringify(second));
    await expect(signalApi.start(legacy.watchId, 'check', 'FIXTURE-REQUEST-THIRD', bootstrap.csrfToken)).rejects.toMatchObject({ code: 'pending' });
    expect(calls).toHaveLength(0);
    oldResult = { ...saved, watchId: legacy.watchId, input: { ...saved.input, watch: { ...saved.input.watch, id: legacy.watchId } } };
    await signalApi.requestRun(legacy.watchId, legacy.requestId);
    expect(store.has(key)).toBe(false); expect(readPendingRunRequests()).toEqual([second]);
    await expect(signalApi.start(legacy.watchId, 'check', 'FIXTURE-REQUEST-THIRD', bootstrap.csrfToken)).rejects.toMatchObject({ code: 'pending' });
    expect(posts()).toHaveLength(0);
  });
  it('does not replace the current watch/result when an explicit out-of-scope terminal GET succeeds', async () => {
    await ready(); oldResult = { ...saved, id: 'FIXTURE-RUN-OLD-TERMINAL', watchId: legacy.watchId, input: { ...saved.input, watch: { ...saved.input.watch, id: legacy.watchId } } };
    find(tree(), (element) => element.type === PendingRunNotice)!.props.onRecover!();
    await vi.waitFor(() => expect(markup()).toContain('現在選択中の条件と結果は保持'));
    expect(new URL(location.href).searchParams.get('run')).toBe(saved.id); expect(button('更新を確認')?.props.disabled).toBe(false);
    expect(readPendingRunRequests()).toEqual([]); expect(posts()).toHaveLength(0);
  });
  it('rehydrates a same-watch request through storage events, then blocks without resending', async () => {
    await ready(); const pending = { watchId: saved.watchId, requestId: 'FIXTURE-REQUEST-OTHER-TAB' };
    store.set(scopedKey(pending.watchId, pending.requestId), JSON.stringify(pending));
    const listener = vi.mocked(window.addEventListener).mock.calls.find(([event]) => event === 'storage')?.[1];
    if (typeof listener !== 'function') throw new Error('FIXTURE-LISTENER-MISSING'); listener.call(window, new Event('storage'));
    expect(button('更新を確認')?.props.disabled).toBe(true); button('更新を確認')!.props.onClick!();
    oldUnchanged(); expect(readPendingRunRequests()).toHaveLength(2); expect(posts()).toHaveLength(0);
  });
  it.each(['unsupported', 'corrupt'] as const)('keeps all pending and sends no POST when storage safety is %s', async (failure) => {
    if (failure === 'unsupported') vi.stubGlobal('navigator', {});
    else store.set(scopedKey(saved.watchId, 'FIXTURE-CORRUPT'), '{broken');
    await expect(signalApi.start(saved.watchId, 'check', 'FIXTURE-REQUEST-CURRENT-NEW', bootstrap.csrfToken, pairId)).rejects.toMatchObject({ code: failure === 'unsupported' ? 'pending-lock' : 'pending-storage' });
    expect(store.get(key)).toBe(legacyValue); expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled(); expect(posts()).toHaveLength(0);
  });
});
