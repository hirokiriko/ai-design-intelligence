import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, signalApi } from './api';
import { decodeRun, type Run, type WatchInput } from './contract';
import { evidenceId } from './labels';
import { SignalHistory } from './SignalHistory';
import { ComparisonPairSelector, SignalWorkspace } from './SignalWorkspace';
import { installPendingLocks } from './pending-locks.test-support';

interface Exchange {
  method: string; path: string; requestBody?: unknown; status: number; document: unknown;
}
interface Scenario {
  authMode?: 'public';
  watchInput: WatchInput;
  request: { requestId: string; comparisonPairId: string; intent: 'check' | 'reanalyze' };
  exchanges: Exchange[];
  savedRun: unknown;
}
// 保存された架空API交換を使うreplay。任意pathや外部URLは受け付けない。
const exchangeFile = process.env.KDS_FIXTURE_EXCHANGES_FILE ?? 'backend-exchanges-fictional.json';
if (!['backend-exchanges-fictional.json', 'backend-public-exchanges-fictional.json'].includes(exchangeFile)) throw new Error('FIXTURE-UNKNOWN-EXCHANGES-FILE');
const scenario = JSON.parse(readFileSync(new URL(`./${exchangeFile.replace('.json', '.fixture.json')}`, import.meta.url), 'utf8')) as Scenario;

// Workspaceのeffectと操作handlerを通す。子カードは実React SSRで検証する。
// これはブラウザ描画・画像取得・PostgreSQL永続保存の証明ではない。
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

type ElementProps = {
  children?: ReactNode; disabled?: boolean; onClick?: () => void;
  onSave?: (input: WatchInput) => Promise<void>; onSelect?: (id: string) => void;
};
function tree() {
  hooks.stateIndex = 0; hooks.refIndex = 0; hooks.effects = [];
  hooks.active = true;
  try { return SignalWorkspace({ api: signalApi }); } finally { hooks.active = false; }
}
function findElement(node: ReactNode, matches: (element: ReactElement<ElementProps>) => boolean): ReactElement<ElementProps> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<ElementProps>(child)) continue;
    if (matches(child)) return child;
    const found = findElement(child.props.children, matches);
    if (found) return found;
  }
  return undefined;
}
function button(label: string) {
  return findElement(tree(), (element) => element.type === 'button' && element.props.children === label);
}
function html() { return renderToStaticMarkup(tree()); }
function encodedText(value: string) { return renderToStaticMarkup(createElement('span', null, value)).slice(6, -7); }
function resetHooks() {
  hooks.states = []; hooks.refs = []; hooks.effects = []; hooks.active = false;
}

describe('current Backend fixture through actual API and saved-result UI', () => {
  let cleanups: (() => void)[];
  let calls: { method: string; path: string; body: unknown }[];
  let unexpectedRequests: string[];
  let storage: Map<string, string>;
  let location: { href: string };
  beforeEach(() => {
    installPendingLocks();
    resetHooks(); cleanups = []; calls = []; unexpectedRequests = []; storage = new Map();
    location = { href: 'https://kds-fixture.example.test/' };
    vi.stubGlobal('localStorage', {
      get length() { return storage.size; },
      key: vi.fn((index: number) => [...storage.keys()][index] ?? null),
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
      removeItem: vi.fn((key: string) => { storage.delete(key); }),
    });
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => scenario.request.requestId) });
    vi.stubGlobal('window', {
      location,
      history: { replaceState: vi.fn((_state: unknown, _title: string, url: unknown) => { location.href = String(url); }) },
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    const queues = new Map<string, Exchange[]>();
    for (const exchange of scenario.exchanges) {
      const key = `${exchange.method} ${exchange.path}`;
      const queue = queues.get(key) ?? [];
      queue.push(exchange); queues.set(key, queue);
    }
    vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
      if (!path.startsWith('/api/v1/') || path.includes('://')) {
        unexpectedRequests.push(path); throw new Error('FIXTURE_UNEXPECTED_ROUTE');
      }
      const method = options.method ?? 'GET';
      const body: unknown = options.body ? JSON.parse(String(options.body)) : null;
      calls.push({ method, path, body });
      // 既存版serverはquery付きBootstrapを受付前に拒否する。新FEのGET交渉だけを補う。
      if (method === 'GET' && path === '/api/v1/bootstrap?analysisQuestionVersion=1.0.0') return Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_REQUEST' } }, { status: 400 });
      const exchange = queues.get(`${method} ${path}`)?.shift();
      if (!exchange) {
        unexpectedRequests.push(`${method} ${path}`); throw new Error('FIXTURE_UNEXPECTED_REQUEST');
      }
      if (method === 'POST') expect(body).toEqual(exchange.requestBody);
      expect(options.credentials).toBe('same-origin');
      expect(new Headers(options.headers).has('Authorization')).toBe(false);
      expect(options.cache).toBe('no-store'); expect(options.redirect).toBe('error');
      return Response.json(exchange.document, { status: exchange.status });
    }));
  });
  afterEach(() => { cleanups.forEach((cleanup) => cleanup()); resetHooks(); vi.unstubAllGlobals(); });

  function mount() {
    tree();
    cleanups = hooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  }
  function assertSavedDisplay(run: Run) {
    if (run.schemaVersion === '1.0.0' || !run.signal) throw new Error('FIXTURE_REQUIRES_CURRENT_SIGNAL');
    const source = run.signal.sources[0];
    expect(source.publishedAt).toBeNull();
    expect(source.updatedAt).toBe('2026-09-04'); expect(source.releaseAt).toBe('2026-09-05');
    const markup = html();
    expect(markup).toContain('保存された確認結果');
    expect(markup).toContain('発表日：不明');
    expect(markup).toContain('更新日：2026-09-04 · 発売日：2026-09-05');
    expect(markup).toContain('模擬モデル（接続・保存の検証）');
    expect(markup).toContain(encodedText(run.input.context.entity.name ?? '企業名不明'));
    expect(markup).toContain(encodedText(run.input.context.category.label));
    expect(run.signal.officialFacts.length).toBeGreaterThan(0);
    for (const fact of run.signal.officialFacts) {
      expect(markup).toContain(encodedText(fact.quote));
      expect(markup).toContain(`href="#${evidenceId(fact.sourceId)}"`);
      expect(markup).toContain(`id="${evidenceId(fact.sourceId)}"`);
    }
    for (const question of run.signal.questionsForHuman) expect(markup).toContain(encodedText(question));
    expect(new URL(location.href).searchParams.get('run')).toBe(run.id);
  }

  it('saves a condition, explicitly runs once, and restores exact unknown-date evidence with GET only', async () => {
    if (exchangeFile === 'backend-public-exchanges-fictional.json') expect(scenario.authMode).toBe('public');
    const saved = decodeRun(scenario.savedRun);
    const immutable = JSON.stringify(saved);
    mount();
    await vi.waitFor(() => expect(html()).toContain('最初の確認条件を保存してください'));
    const form = findElement(tree(), (element) => typeof element.props.onSave === 'function');
    expect(form).toBeDefined();
    await form!.props.onSave!(scenario.watchInput);
    await vi.waitFor(() => expect(html()).toContain('比較組を選択してください'));
    expect(await signalApi.runs(saved.watchId)).toEqual([]);
    const selector = findElement(tree(), (element) => element.type === ComparisonPairSelector);
    expect(selector).toBeDefined();
    selector!.props.onSelect!(scenario.request.comparisonPairId);
    expect(button('更新を確認')?.props.disabled).toBe(false);
    button('更新を確認')!.props.onClick!();
    await vi.waitFor(() => expect(html()).toContain('保存された確認結果'));
    assertSavedDisplay(saved);
    expect(readPendingRunRequest()).toBeNull(); expect(storage.size).toBe(0);
    const runPosts = () => calls.filter((call) => call.method === 'POST' && call.path.endsWith('/runs'));
    expect(runPosts()).toHaveLength(1);
    expect(runPosts()[0].body).toEqual({ ...scenario.request });

    const viewingStart = calls.length;
    button('履歴を再取得')!.props.onClick!();
    await vi.waitFor(() => expect(html()).toContain('保存履歴を再取得しました。AIは実行していません。'));
    const history = findElement(tree(), (element) => element.type === SignalHistory);
    expect(history).toBeDefined();
    history!.props.onSelect!(saved.id);
    await vi.waitFor(() => expect(html()).toContain('保存結果を表示しました。AIは実行していません。'));
    expect(await signalApi.requestRun(saved.watchId, scenario.request.requestId)).toEqual(saved);
    assertSavedDisplay(saved);

    cleanups.forEach((cleanup) => cleanup()); resetHooks(); cleanups = [];
    mount();
    await vi.waitFor(() => expect(html()).toContain('保存された確認結果'));
    await vi.waitFor(() => expect(button('履歴を再取得')?.props.disabled).toBe(false));
    assertSavedDisplay(saved);
    expect(calls.slice(viewingStart).every((call) => call.method === 'GET')).toBe(true);
    expect(runPosts()).toHaveLength(1);
    expect(calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/watches')).toHaveLength(1);
    expect(JSON.stringify(saved)).toBe(immutable);
    expect(readPendingRunRequest()).toBeNull(); expect(storage.size).toBe(0);
    expect(unexpectedRequests).toEqual([]);
  });
});
