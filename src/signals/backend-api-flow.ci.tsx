import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysisQuestion } from './analysis-question';
import { readPendingRunRequest, signalApi, SignalApiError } from './api';
import { decodeRun, type Run, type RunV25, type WatchInput } from './contract';
import { evidenceId } from './labels';
import { decodeRunReview, type RunReviewState } from './run-review';
import { SignalHistory } from './SignalHistory';
import { SignalQuestionPicker, SignalSavedQuestion } from './SignalPurposeJourney';
import { SignalResult } from './SignalResult';
import { ComparisonPairSelector, SignalWorkspace } from './SignalWorkspace';
import { installPendingLocks } from './pending-locks.test-support';

interface Exchange {
  method: 'GET' | 'POST'; path: string; requestBody?: unknown; status: number; document: unknown;
}
interface Scenario {
  schemaVersion: '1.0.0'; fictional: true; watchInput: WatchInput;
  request: {
    intent: 'check'; requestId: string; comparisonPairId: string;
    analysisQuestionId: 'support'; analysisQuestionVersion: '1.0.0';
  };
  exchanges: Exchange[]; savedRun: unknown; savedHash: string; oldRun: unknown;
  savedReview: unknown; oldReview: unknown;
  counters: {
    beginRunCalls: number; finishRunCalls: number; generationPosts: number; modelCalls: number;
    parsedOfficialPages: number; externalRequests: number; realAIExecutions: number;
  };
}

// CI の実 Application/parser 呼出しが保存した応答を読む。任意パス・外部 URL は受け付けない。
const scenario = JSON.parse(readFileSync(new URL('./backend-integration-exchanges-fictional.fixture.json', import.meta.url), 'utf8')) as Scenario;
const fixtureId = /^(?:FIXTURE-|kds_fixture_)[A-Za-z0-9_-]+$/;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, item]) => [key, canonical(item)]));
  }
  return value;
}
function hash(value: unknown) {
  const document = JSON.stringify(canonical(value));
  if (document === undefined) throw new Error('FIXTURE_INVALID_HASH_INPUT');
  return createHash('sha256').update(document, 'utf8').digest('hex');
}
function savedRun(): RunV25 {
  const run = decodeRun(scenario.savedRun);
  if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('FIXTURE_REQUIRES_SAVED_QUESTION');
  return run;
}

// Workspace の effect と実操作 handler を通す。子カードは実 React SSR で描画する。
// ブラウザーの画像表示、実モデル、永続 PostgreSQL の検証とは区別する。
const hooks = vi.hoisted(() => ({
  active: false, mounted: false, flushing: false, stateIndex: 0, refIndex: 0, callbackIndex: 0, effectIndex: 0,
  states: [] as unknown[], refs: [] as { current: unknown }[],
  callbacks: [] as { callback: (...args: unknown[]) => unknown; dependencies: readonly unknown[] }[],
  effects: [] as { effect: () => void | (() => void); dependencies?: readonly unknown[]; pending: boolean; cleanup?: () => void }[],
}));
function sameDependencies(left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) {
  return left !== undefined && right !== undefined && left.length === right.length && left.every((item, index) => Object.is(item, right[index]));
}
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
    useCallback: ((callback: (...args: unknown[]) => unknown, dependencies: readonly unknown[]) => {
      if (!hooks.active) return actual.useCallback(callback, dependencies);
      const index = hooks.callbackIndex++;
      const previous = hooks.callbacks[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return previous.callback;
      hooks.callbacks[index] = { callback, dependencies };
      return callback;
    }) as typeof actual.useCallback,
    useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
      if (!hooks.active) return actual.useEffect(effect, dependencies);
      const index = hooks.effectIndex++;
      const previous = hooks.effects[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return;
      hooks.effects[index] = { effect, dependencies, pending: true, cleanup: previous?.cleanup };
    },
  };
});

type ElementProps = {
  children?: ReactNode; disabled?: boolean; onClick?: () => void;
  onSave?: (input: WatchInput) => Promise<void>; onSelect?: (id: string) => void;
  run?: Run; runs?: Run[]; selected?: string | null; reviewState?: RunReviewState;
};
function flushEffects() {
  if (!hooks.mounted || hooks.flushing) return;
  hooks.flushing = true;
  try {
    for (const record of hooks.effects) {
      if (!record.pending) continue;
      record.pending = false;
      record.cleanup?.();
      const cleanup = record.effect();
      record.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    }
  } finally { hooks.flushing = false; }
}
function tree() {
  hooks.stateIndex = 0; hooks.refIndex = 0; hooks.callbackIndex = 0; hooks.effectIndex = 0;
  hooks.active = true;
  let node: ReactNode;
  try { node = SignalWorkspace({ api: signalApi }); } finally { hooks.active = false; }
  // 依存変更時だけ effect を実行する。useCallback も維持し、表示のたびに bootstrap を再実行しない。
  flushEffects();
  return node;
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
function button(label: string) { return findElement(tree(), (element) => element.type === 'button' && element.props.children === label); }
function html() { return renderToStaticMarkup(tree()); }
function encodedText(value: string) { return renderToStaticMarkup(createElement('span', null, value)).slice(6, -7); }
function resetHooks() {
  hooks.states = []; hooks.refs = []; hooks.callbacks = []; hooks.effects = [];
  hooks.active = false; hooks.mounted = false; hooks.flushing = false;
}
function unmount() { hooks.effects.forEach((record) => record.cleanup?.()); resetHooks(); }
function displayedRun() { return findElement(tree(), (element) => element.type === SignalResult)?.props.run; }
function displayedReview() { return findElement(tree(), (element) => element.type === SignalResult)?.props.reviewState; }
function displayedHistory() { return findElement(tree(), (element) => element.type === SignalHistory)?.props.runs; }

describe('generated fictional Backend API exchange through current question and saved-result UI', () => {
  let calls: { method: string; path: string; body: unknown }[];
  let unexpectedRequests: string[];
  let storage: Map<string, string>;
  let location: { href: string };
  beforeEach(() => {
    installPendingLocks();
    resetHooks(); calls = []; unexpectedRequests = []; storage = new Map();
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
    const reads = new Map<string, (Exchange & { phase: number })[]>();
    const writes = new Map<string, Exchange[]>();
    let capturedPhase = 0;
    for (const exchange of scenario.exchanges) {
      if (!exchange.path.startsWith('/api/v1/') || exchange.path.includes('://')) throw new Error('FIXTURE_INVALID_ROUTE');
      const key = `${exchange.method} ${exchange.path}`;
      if (exchange.method === 'GET') {
        const entries = reads.get(key) ?? [];
        entries.push({ ...exchange, phase: capturedPhase }); reads.set(key, entries);
      } else {
        const entries = writes.get(key) ?? [];
        entries.push(exchange); writes.set(key, entries);
        if (exchange.status >= 200 && exchange.status < 300) capturedPhase += 1;
      }
    }
    let phase = 0;
    vi.stubGlobal('fetch', vi.fn(async (path: string, options: RequestInit = {}) => {
      if (!path.startsWith('/api/v1/') || path.includes('://')) {
        unexpectedRequests.push(path); throw new Error('FIXTURE_UNEXPECTED_ROUTE');
      }
      const method = options.method ?? 'GET';
      const body: unknown = options.body ? JSON.parse(String(options.body)) : null;
      calls.push({ method, path, body });
      const key = `${method} ${path}`;
      // 受動 GET は同じ保存時点の捕捉済み応答を再利用する。POST は各捕捉要求を一度だけ消費する。
      const exchange = method === 'GET'
        ? reads.get(key)?.filter((entry) => entry.phase <= phase).slice(-1)[0]
        : method === 'POST' ? writes.get(key)?.shift() : undefined;
      if (!exchange) { unexpectedRequests.push(key); throw new Error('FIXTURE_UNEXPECTED_REQUEST'); }
      if (method === 'POST') {
        expect(body).toEqual(exchange.requestBody);
        if (exchange.status >= 200 && exchange.status < 300) phase += 1;
      }
      expect(options.credentials).toBe('same-origin');
      expect(new Headers(options.headers).has('Authorization')).toBe(false);
      expect(options.cache).toBe('no-store'); expect(options.redirect).toBe('error');
      return Response.json(exchange.document, { status: exchange.status });
    }));
  });
  afterEach(() => { unmount(); vi.unstubAllGlobals(); });

  function mount() {
    hooks.mounted = true;
    tree();
  }
  function assertSavedDisplay(run: RunV25) {
    expect(displayedRun()).toEqual(run);
    expect(displayedRun()?.schemaVersion).toBe('2.5.0');
    const current = displayedRun();
    if (current?.schemaVersion !== '2.5.0' || !current.signal || !run.signal) throw new Error('FIXTURE_MISSING_SAVED_QUESTION');
    expect(current.input.analysisQuestion).toEqual(analysisQuestion('support'));
    expect(current.signal.questionAnswer).toEqual(run.signal.questionAnswer);
    expect(hash(current)).toBe(scenario.savedHash);
    const markup = html();
    expect(markup).toContain(encodedText(`実行時の問い：${analysisQuestion('support').text}`));
    expect(markup).toContain('この実行に保存された回答');
    expect(markup).toContain(encodedText(run.input.context.entity.name ?? '企業名不明'));
    expect(markup).toContain(encodedText(run.input.context.category.label));
    const answer = run.signal.questionAnswer;
    expect(answer.questionId).toBe('support'); expect(answer.questionVersion).toBe('1.0.0');
    expect(answer.text).not.toBeNull();
    expect(markup).toContain(encodedText(answer.text!));
    for (const text of [...answer.nextChecks, ...answer.limitations]) expect(markup).toContain(encodedText(text));
    for (const id of [...answer.evidenceIds, ...answer.supportingEvidenceIds, ...answer.opposingEvidenceIds]) {
      expect(markup).toContain(`href="#${evidenceId(id)}"`);
      expect(markup).toContain(`id="${evidenceId(id)}"`);
    }
    expect(run.signal.media).toHaveLength(2);
    for (const media of run.signal.media) {
      expect(fixtureId.test(media.id)).toBe(true);
      expect(markup).toContain(`src="/api/v1/media/${encodeURIComponent(media.id)}"`);
      expect(markup).toContain(`id="${evidenceId(media.id)}"`);
    }
    expect(run.signal.sources.length).toBeGreaterThan(0);
    expect(run.signal.officialFacts.length).toBeGreaterThan(0);
    for (const source of run.signal.sources) {
      expect(source.publishedAt).toBeNull();
      expect(source.updatedAt).toBe('2026-09-04'); expect(source.releaseAt).toBe('2026-09-05');
      expect(markup).toContain(`id="${evidenceId(source.id)}"`);
    }
    expect(markup).toContain('発表日：不明');
    expect(markup).toContain('更新日：2026-09-04 · 発売日：2026-09-05');
    for (const fact of run.signal.officialFacts) {
      const source = run.signal.sources.find((item) => item.id === fact.sourceId);
      expect(source).toBeDefined();
      const start = fact.start - source!.excerptStart;
      const end = fact.end - source!.excerptStart;
      expect(start).toBeGreaterThanOrEqual(0); expect(end).toBeGreaterThan(start);
      expect(Array.from(source!.excerpt).slice(start, end).join('')).toBe(fact.quote);
      expect(markup).toContain(encodedText(fact.quote));
      expect(markup).toContain(`href="#${evidenceId(fact.sourceId)}"`);
    }
    expect(new URL(location.href).searchParams.get('run')).toBe(run.id);
  }

  it('uses generated 2.5 input and exact saved answer, with no substituted publication date', () => {
    expect(scenario.schemaVersion).toBe('1.0.0'); expect(scenario.fictional).toBe(true);
    const saved = savedRun();
    expect(saved.status).toBe('complete');
    expect(fixtureId.test(saved.id)).toBe(true); expect(fixtureId.test(saved.watchId)).toBe(true);
    expect(fixtureId.test(scenario.request.requestId)).toBe(true);
    expect(fixtureId.test(scenario.request.comparisonPairId)).toBe(true);
    expect(scenario.request.analysisQuestionId).toBe('support'); expect(scenario.request.analysisQuestionVersion).toBe('1.0.0');
    expect(saved.input.analysisQuestion).toEqual(analysisQuestion('support'));
    expect(saved.input.comparisonPair?.id).toBe(scenario.request.comparisonPairId);
    expect(hash(scenario.savedRun)).toBe(scenario.savedHash); expect(hash(saved)).toBe(scenario.savedHash);
    const accepted = scenario.exchanges.filter((exchange) => exchange.method === 'POST' && exchange.path.endsWith('/runs') && exchange.status >= 200 && exchange.status < 300);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].requestBody).toEqual(scenario.request);
    expect(decodeRun(accepted[0].document)).toEqual(saved);
    expect(scenario.counters.generationPosts).toBe(accepted.length);
    expect(scenario.counters.beginRunCalls).toBe(1); expect(scenario.counters.finishRunCalls).toBe(1);
    expect(scenario.counters.modelCalls).toBeGreaterThan(0); expect(scenario.counters.modelCalls).toBe(saved.usage.modelRequests);
    expect(scenario.counters.parsedOfficialPages).toBeGreaterThan(0);
    expect(scenario.counters.externalRequests).toBe(0); expect(scenario.counters.realAIExecutions).toBe(0);
    const currentReview = scenario.exchanges.find((exchange) => exchange.method === 'GET' && exchange.path === `/api/v1/runs/${saved.id}/review`);
    expect(currentReview?.status).toBe(200); expect(currentReview?.document).toEqual(scenario.savedReview);
    expect(decodeRunReview(scenario.savedReview, saved)).toBeNull();
    const old = decodeRun(scenario.oldRun);
    const oldReview = scenario.exchanges.find((exchange) => exchange.method === 'GET' && exchange.path === `/api/v1/runs/${old.id}/review`);
    expect(oldReview?.status).toBe(200); expect(oldReview?.document).toEqual(scenario.oldReview);
    const review = decodeRunReview(scenario.oldReview, old);
    expect(review?.failedChecks).toEqual(['V2', 'V4']); expect(review?.ownerAcceptance).toBe('NOT_PERFORMED');
  });

  it('registers materials, explicitly starts support once, then reads exact history and restores via GET only', async () => {
    const saved = savedRun();
    const immutable = hash(scenario.savedRun);
    mount();
    await vi.waitFor(() => expect(html()).toContain('最初の確認条件を保存してください。'));
    const form = findElement(tree(), (element) => typeof element.props.onSave === 'function');
    expect(form).toBeDefined();
    await form!.props.onSave!(scenario.watchInput);
    await vi.waitFor(() => expect(html()).toContain('比較組を選択してください'));
    expect(await signalApi.runs(saved.watchId)).toEqual([]);
    const selector = findElement(tree(), (element) => element.type === ComparisonPairSelector);
    expect(selector).toBeDefined(); selector!.props.onSelect!(scenario.request.comparisonPairId);
    expect(button('この問いで分析を開始')?.props.disabled).toBe(true);
    const picker = findElement(tree(), (element) => element.type === SignalQuestionPicker);
    expect(picker).toBeDefined(); picker!.props.onSelect!('support');
    expect(calls.filter((call) => call.method === 'POST' && call.path.endsWith('/runs'))).toHaveLength(0);
    const start = button('この問いで分析を開始');
    expect(start?.props.disabled).toBe(false);
    start!.props.onClick!();
    // 同じ handler の重複クリックでも mutation ref が最初の要求を保護する。
    start!.props.onClick!();
    expect(button('確認しています…')?.props.disabled).toBe(true);
    await vi.waitFor(() => expect(displayedRun()?.id).toBe(saved.id));
    await vi.waitFor(() => expect(displayedReview()).toEqual({ status: 'ready', review: null }));
    expect(html()).toContain('品質レビュー：未記録');
    expect(html()).not.toContain('登録された未達指摘なし');
    assertSavedDisplay(saved);
    expect(displayedHistory()).toEqual([saved]);
    expect(readPendingRunRequest()).toBeNull(); expect(storage.size).toBe(0);
    const runPosts = () => calls.filter((call) => call.method === 'POST' && call.path.endsWith('/runs'));
    expect(runPosts()).toHaveLength(1); expect(runPosts()[0].body).toEqual(scenario.request);
    expect(calls.filter((call) => call.path === `/api/v1/runs/${saved.id}/review`)).toHaveLength(1);

    const viewingStart = calls.length;
    button('履歴を再取得')!.props.onClick!();
    await vi.waitFor(() => expect(html()).toContain('保存履歴を再取得しました。AIは実行していません。'));
    await vi.waitFor(() => {
      expect(displayedReview()).toEqual({ status: 'ready', review: null });
      expect(calls.filter((call) => call.path === `/api/v1/runs/${saved.id}/review`)).toHaveLength(2);
    });
    expect(displayedHistory()?.find((run) => run.id === saved.id)).toEqual(saved);
    const history = findElement(tree(), (element) => element.type === SignalHistory);
    expect(history).toBeDefined(); history!.props.onSelect!(saved.id);
    await vi.waitFor(() => expect(html()).toContain('保存結果を表示しました。AIは実行していません。'));
    expect(await signalApi.requestRun(saved.watchId, scenario.request.requestId)).toEqual(saved);
    expect(await signalApi.run(saved.id)).toEqual(saved);
    assertSavedDisplay(saved);
    expect(calls.filter((call) => call.path === `/api/v1/runs/${saved.id}/review`)).toHaveLength(2);
    expect(calls.filter((call) => call.path.startsWith('/api/v1/bootstrap'))).toHaveLength(1);

    const foreignReads = scenario.exchanges.filter((exchange) => exchange.method === 'GET' && exchange.status >= 400
      && (/^\/api\/v1\/runs\/[^/?]+$/.test(exchange.path) || /^\/api\/v1\/watches\/[^/?]+\/requests\/[^/?]+$/.test(exchange.path)));
    expect(foreignReads.some((exchange) => exchange.path.startsWith('/api/v1/runs/'))).toBe(true);
    expect(foreignReads.some((exchange) => exchange.path.startsWith('/api/v1/watches/'))).toBe(true);
    for (const exchange of foreignReads) {
      const parts = exchange.path.split('/');
      expect(fixtureId.test(decodeURIComponent(parts[4]))).toBe(true);
      if (parts[3] === 'watches') expect(fixtureId.test(decodeURIComponent(parts[6]))).toBe(true);
      const operation = parts[3] === 'runs'
        ? signalApi.run(decodeURIComponent(parts[4]))
        : signalApi.requestRun(decodeURIComponent(parts[4]), decodeURIComponent(parts[6]));
      await expect(operation).rejects.toBeInstanceOf(SignalApiError);
      await expect(operation).rejects.toMatchObject({ code: String(exchange.status) });
    }
    assertSavedDisplay(saved);

    unmount();
    mount();
    await vi.waitFor(() => expect(displayedRun()?.id).toBe(saved.id));
    await vi.waitFor(() => expect(button('履歴を再取得')?.props.disabled).toBe(false));
    await vi.waitFor(() => expect(displayedReview()).toEqual({ status: 'ready', review: null }));
    assertSavedDisplay(saved);
    expect(displayedHistory()?.find((run) => run.id === saved.id)).toEqual(saved);
    expect(calls.filter((call) => call.path === `/api/v1/runs/${saved.id}/review`)).toHaveLength(3);

    // 別 watch の旧結果は履歴選択で境界を緩めず、保存 URL の再読込として開く。
    const old = decodeRun(scenario.oldRun);
    const oldHash = hash(old);
    const countersHash = hash(scenario.counters);
    const oldReview = decodeRunReview(scenario.oldReview, old);
    expect(old.schemaVersion).toBe('2.3.0');
    expect(oldReview).not.toBeNull();
    unmount();
    location.href = `https://kds-fixture.example.test/?run=${encodeURIComponent(old.id)}`;
    mount();
    await vi.waitFor(() => expect(displayedRun()).toEqual(old));
    await vi.waitFor(() => expect(displayedReview()).toEqual({ status: 'ready', review: oldReview }));
    const oldMarkup = html();
    expect(oldMarkup).toContain('品質未達：V2 FAIL / V4 FAIL');
    expect(oldMarkup).toContain('本人受入：未実施');
    expect(oldMarkup).toContain('レビュー日時：未記録');
    expect(oldMarkup).toContain('実行時の問い：未記録');
    expect(oldMarkup).not.toContain('id="signal-question-answer-title"');
    expect(oldMarkup).not.toContain('本人受入：受入記録あり');
    expect(oldMarkup).not.toContain('登録された未達指摘なし');
    expect(hash(displayedRun())).toBe(oldHash); expect(hash(scenario.oldRun)).toBe(oldHash);
    expect(hash(scenario.counters)).toBe(countersHash);
    expect(new URL(location.href).searchParams.get('run')).toBe(old.id);
    expect(calls.filter((call) => call.path === `/api/v1/runs/${old.id}/review`)).toHaveLength(1);
    expect(calls.filter((call) => call.path.startsWith('/api/v1/bootstrap'))).toHaveLength(3);
    expect(calls.slice(viewingStart).every((call) => call.method === 'GET')).toBe(true);
    expect(calls.filter((call) => call.path.includes('/media/'))).toHaveLength(0);
    expect(runPosts()).toHaveLength(1);
    expect(calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/watches')).toHaveLength(1);
    expect(hash(scenario.savedRun)).toBe(immutable);
    expect(readPendingRunRequest()).toBeNull(); expect(storage.size).toBe(0);
    expect(unexpectedRequests).toEqual([]);
  });

  it('keeps the generated old 2.3 purpose unrecorded in result and history without starting any request', () => {
    const old = decodeRun(scenario.oldRun);
    expect(old.schemaVersion).toBe('2.3.0');
    const immutable = hash(old);
    expect(Object.prototype.hasOwnProperty.call(old.input, 'analysisQuestion')).toBe(false);
    const purpose = renderToStaticMarkup(createElement(SignalSavedQuestion, { run: old }));
    expect(purpose).toContain('実行時の問い：未記録');
    const result = renderToStaticMarkup(createElement(SignalResult, { run: old }));
    expect(result).toContain('実行時の問い：未記録');
    expect(result).not.toContain('id="signal-question-answer-title"');
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [old], selectedId: old.id, state: 'ready', disabled: false, onSelect: vi.fn() }));
    expect(history).toContain('実行時の問い：未記録');
    expect(hash(old)).toBe(immutable); expect(calls).toEqual([]);
  });
});
