import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fictionalComparisonPair } from './fixtures-v22';
import { fictionalBootstrapV2, fictionalRunV2 } from './fixtures';
import { readPendingRunRequest, SignalApiError, type SignalApi } from './api';
import { ContractError, decodeRun, type Run } from './contract';
import questionFixture from './backend-run-v2.5.fixture.json';
import { analysisQuestion } from './analysis-question';
import { comparisonStatusLabel } from './labels';
import { ComparisonPairSelector, PendingRunNotice, SignalWorkspace } from './SignalWorkspace';
import { SignalQuestionPicker, type SignalQuestion } from './SignalPurposeJourney';
import { SignalHistory, type HistoryState } from './SignalHistory';
import type { PublicRunReview } from './run-review';

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

function workspaceTree(api: SignalApi, developmentMode = false) {
  workspaceHooks.stateIndex = 0; workspaceHooks.refIndex = 0; workspaceHooks.effects = [];
  workspaceHooks.active = true;
  try { return SignalWorkspace({ api, developmentMode }); } finally { workspaceHooks.active = false; }
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

function questionPicker(node: ReactNode): ReactElement<{ onSelect: (question: SignalQuestion) => void }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onSelect: (question: SignalQuestion) => void }>(child)) continue;
    if (child.type === SignalQuestionPicker) return child;
    const found = questionPicker(child.props.children);
    if (found) return found;
  }
  return undefined;
}

function pairPicker(node: ReactNode): ReactElement<{ onSelect: (id: string) => void }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onSelect: (id: string) => void }>(child)) continue;
    if (child.type === ComparisonPairSelector) return child;
    const found = pairPicker(child.props.children); if (found) return found;
  }
  return undefined;
}

function historyPicker(node: ReactNode): ReactElement<{ onSelect: (id: string) => void; state: HistoryState }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onSelect: (id: string) => void; state: HistoryState }>(child)) continue;
    if (child.type === SignalHistory) return child;
    const found = historyPicker(child.props.children);
    if (found) return found;
  }
  return undefined;
}

function watchPicker(node: ReactNode, watchId: string): ReactElement<{ onChange: (event: { target: { value: string } }) => void }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; value?: string; onChange: (event: { target: { value: string } }) => void }>(child)) continue;
    if (child.type === 'select' && child.props.value === watchId) return child;
    const found = watchPicker(child.props.children, watchId);
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
      get length() { return values.size; },
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
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

  function startWorkspace(api: SignalApi, developmentMode = false) {
    workspaceTree(api, developmentMode);
    cleanups = workspaceHooks.effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  }
  function savedApi(): SignalApi {
    return {
      bootstrap: vi.fn().mockResolvedValue(fictionalBootstrapV2), run: vi.fn().mockResolvedValue(fictionalRunV2),
      runs: vi.fn(), comparisonPairs: vi.fn(), saveWatch: vi.fn(), start: vi.fn(), requestRun: vi.fn(),
    };
  }

  function questionApi(): SignalApi {
    const saved = decodeRun(structuredClone(questionFixture));
    if (saved.schemaVersion !== '2.5.0') throw new Error('Missing question fixture');
    location.href = `https://signals.example.test/?run=${saved.id}`;
    return {
      bootstrap: vi.fn().mockResolvedValue({ ...fictionalBootstrapV2, schemaVersion: '2.5.0', analysisMode: 'standard', analysisQuestionVersion: '1.0.0', watches: [saved.input.watch] }),
      run: vi.fn().mockResolvedValue(saved), runs: vi.fn().mockResolvedValue([saved]),
      comparisonPairs: vi.fn().mockResolvedValue({ schemaVersion: '2.3.0', comparisonPairs: [saved.input.comparisonPair] }),
      saveWatch: vi.fn(), start: vi.fn(), requestRun: vi.fn(),
    };
  }

  function flushReview(api: SignalApi, developmentMode = false) {
    workspaceTree(api, developmentMode);
    // 更新された選択結果のeffectだけを実行する。bootstrapの再実行はしない。
    workspaceHooks.effects[workspaceHooks.effects.length - 1]();
  }
  function savedReview(saved: Run): PublicRunReview {
    return { runId: saved.id, schemaVersion: saved.schemaVersion, promptVersion: saved.versions.prompt, modelId: saved.versions.model,
      reviewReference: 'FIXTURE-workspace-review', reviewedAt: null, failedChecks: ['V2', 'V4'], ownerAcceptance: 'NOT_PERFORMED' };
  }
  function apiFor(saved: Run, history: Run[] = [saved]): SignalApi {
    location.href = `https://signals.example.test/?run=${saved.id}`;
    return { ...savedApi(), run: vi.fn().mockImplementation(async (id: string) => history.find((item) => item.id === id) ?? saved), runs: vi.fn().mockResolvedValue(history) };
  }
  async function waitForHistory(api: SignalApi, count = 1) {
    await vi.waitFor(() => {
      expect(api.runs).toHaveBeenCalledTimes(count);
      expect(historyPicker(workspaceTree(api))?.props.state).toBe('ready');
      expect(buttonNamed(workspaceTree(api), '履歴を再取得')?.props.disabled).toBe(false);
    });
  }

  it.each([
    new SignalApiError('404', 'FIXTURE-old-backend'), new SignalApiError('401', 'FIXTURE-unreadable-review'),
    new SignalApiError('503', 'FIXTURE-unavailable-review'), new SignalApiError('connection', 'FIXTURE-connection'), new ContractError(),
  ])('keeps the saved result and history after an independent review read failure %#', async (failure) => {
    const saved = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_failure' };
    const original = JSON.stringify(saved);
    const api = { ...apiFor(saved), review: vi.fn().mockRejectedValue(failure) };
    startWorkspace(api); await waitForHistory(api);
    flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質レビュー：確認できません'));
    const html = renderToStaticMarkup(workspaceTree(api));
    expect(html).toContain('保存された確認結果'); expect(html).toContain('実行時の問い：未記録'); expect(html).toContain('aria-current="true"');
    expect(html).not.toContain('品質未達'); expect(new URL(location.href).searchParams.get('run')).toBe(saved.id);
    flushReview(api); expect(api.review).toHaveBeenCalledOnce(); expect(api.bootstrap).toHaveBeenCalledOnce();
    expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled(); expect(JSON.stringify(saved)).toBe(original);
  });

  it('settles the previous history row without applying its late review to the newly selected result', async () => {
    const first = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_first' };
    const second = { ...structuredClone(first), id: 'kds_fixture_review_second' };
    let finish!: (review: PublicRunReview) => void;
    const api = { ...apiFor(first, [first, second]), review: vi.fn().mockImplementation((saved: Run) => saved.id === first.id
      ? new Promise<PublicRunReview>((resolve) => { finish = resolve; }) : Promise.resolve(null)) };
    startWorkspace(api); await waitForHistory(api); flushReview(api);
    await vi.waitFor(() => expect(api.review).toHaveBeenCalledOnce());
    historyPicker(workspaceTree(api))!.props.onSelect(first.id);
    await vi.waitFor(() => { expect(api.run).toHaveBeenCalledTimes(2); expect(buttonNamed(workspaceTree(api), '履歴を再取得')?.props.disabled).toBe(false); }); flushReview(api);
    expect(api.review).toHaveBeenCalledOnce();
    historyPicker(workspaceTree(api))!.props.onSelect(second.id);
    await vi.waitFor(() => expect(new URL(location.href).searchParams.get('run')).toBe(second.id)); flushReview(api);
    await vi.waitFor(() => expect(api.review).toHaveBeenCalledTimes(2));
    finish(savedReview(first));
    await vi.waitFor(() => { const html = renderToStaticMarkup(workspaceTree(api)); expect(html).toContain('品質未達：V2 FAIL / V4 FAIL'); expect(html).not.toContain('品質レビュー：確認中'); });
    const html = renderToStaticMarkup(workspaceTree(api));
    const result = html.slice(html.indexOf('id="signal-result"'));
    expect(result).toContain('品質レビュー：未記録'); expect(result).not.toContain('V2 FAIL'); expect(result).not.toContain('本人受入：未実施');
    expect(html).not.toContain('品質レビュー：確認中'); expect(new URL(location.href).searchParams.get('run')).toBe(second.id);
    historyPicker(workspaceTree(api))!.props.onSelect(first.id);
    await vi.waitFor(() => expect(new URL(location.href).searchParams.get('run')).toBe(first.id)); flushReview(api);
    expect(api.review).toHaveBeenCalledTimes(2); expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled();
  });

  it('preserves a running request on review failure and refreshes its review only after an explicit history read', async () => {
    const running = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_running', status: 'running' as const, completedAt: null, signal: null };
    const completed = { ...structuredClone(fictionalRunV2), id: running.id };
    values.set('kiriko-design-signals-pending-request', JSON.stringify({ watchId: running.watchId, requestId: 'kds_fixture_review_request' }));
    const pendingBefore = new Map(values);
    const api = { ...apiFor(running), review: vi.fn().mockRejectedValueOnce(new SignalApiError('401', 'FIXTURE-review')).mockResolvedValueOnce(savedReview(completed)) };
    startWorkspace(api); await waitForHistory(api); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質レビュー：確認できません'));
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('バックエンドで確認中'); expect(values).toEqual(pendingBefore);
    flushReview(api); expect(api.review).toHaveBeenCalledOnce();
    vi.mocked(api.runs).mockResolvedValue([completed]); vi.mocked(api.requestRun).mockResolvedValue(completed);
    buttonNamed(workspaceTree(api), '履歴を再取得')!.props.onClick();
    await waitForHistory(api, 2); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質未達：V2 FAIL / V4 FAIL'));
    expect(api.review).toHaveBeenCalledTimes(2); expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled();
    expect(new URL(location.href).searchParams.get('run')).toBe(running.id); expect(values).toEqual(pendingBefore);
  });

  it('retries a settled unavailable review on explicit history refresh but deduplicates ordinary viewing', async () => {
    const saved = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_refresh' };
    const api = { ...apiFor(saved), review: vi.fn().mockRejectedValueOnce(new SignalApiError('connection', 'FIXTURE-review')).mockResolvedValueOnce(savedReview(saved)) };
    startWorkspace(api); await waitForHistory(api); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質レビュー：確認できません'));
    flushReview(api); expect(api.review).toHaveBeenCalledOnce();
    buttonNamed(workspaceTree(api), '履歴を再取得')!.props.onClick(); await waitForHistory(api, 2); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('本人受入：未実施'));
    expect(api.review).toHaveBeenCalledTimes(2); expect(api.start).not.toHaveBeenCalled(); expect(api.requestRun).not.toHaveBeenCalled();
  });

  it('does not overwrite a completed review with a late response from the running snapshot', async () => {
    const running = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_status', status: 'running' as const, completedAt: null, signal: null };
    const completed = { ...structuredClone(fictionalRunV2), id: running.id };
    let finish!: (review: null) => void;
    const api = { ...apiFor(running), review: vi.fn().mockReturnValueOnce(new Promise<null>((resolve) => { finish = resolve; })).mockResolvedValueOnce(savedReview(completed)) };
    startWorkspace(api); await waitForHistory(api); flushReview(api);
    await vi.waitFor(() => expect(api.review).toHaveBeenCalledOnce());
    vi.mocked(api.runs).mockResolvedValue([completed]);
    buttonNamed(workspaceTree(api), '履歴を再取得')!.props.onClick(); await waitForHistory(api, 2); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質未達：V2 FAIL / V4 FAIL'));
    finish(null); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質未達：V2 FAIL / V4 FAIL');
    expect(api.review).toHaveBeenCalledTimes(2); expect(api.start).not.toHaveBeenCalled();
  });

  it.each(['history-first', 'review-first'] as const)('does not duplicate the completed review while pending recovery waits for the history list (%s)', async (order) => {
    const running = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_recovery', status: 'running' as const, completedAt: null, signal: null };
    const completed = { ...structuredClone(fictionalRunV2), id: running.id };
    values.set('kiriko-design-signals-pending-request', JSON.stringify({ watchId: running.watchId, requestId: 'kds_fixture_review_recovery_request' }));
    let finishHistory!: (runs: Run[]) => void;
    let finishReview!: (review: PublicRunReview) => void;
    const api = { ...apiFor(running), review: vi.fn().mockRejectedValueOnce(new SignalApiError('connection', 'FIXTURE-review'))
      .mockReturnValueOnce(new Promise<PublicRunReview>((resolve) => { finishReview = resolve; })) };
    startWorkspace(api); await waitForHistory(api); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質レビュー：確認できません'));
    vi.mocked(api.requestRun).mockResolvedValue(completed);
    vi.mocked(api.runs).mockReturnValueOnce(new Promise<Run[]>((resolve) => { finishHistory = resolve; }));
    buttonNamed(workspaceTree(api), '履歴を再取得')!.props.onClick();
    await vi.waitFor(() => { expect(api.requestRun).toHaveBeenCalledOnce(); expect(api.runs).toHaveBeenCalledTimes(2); });
    expect(historyPicker(workspaceTree(api))?.props.state).toBe('loading'); flushReview(api);
    await vi.waitFor(() => expect(api.review).toHaveBeenCalledTimes(2));
    if (order === 'review-first') {
      finishReview(savedReview(completed));
      await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質未達：V2 FAIL / V4 FAIL'));
    }
    finishHistory([completed]); await waitForHistory(api, 2); flushReview(api);
    expect(api.review).toHaveBeenCalledTimes(2);
    if (order === 'history-first') finishReview(savedReview(completed));
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質未達：V2 FAIL / V4 FAIL'));
    expect(api.review).toHaveBeenCalledTimes(2); expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled();
  });

  it('keeps review and execution purpose bound to the saved run when the next viewing question changes', async () => {
    const base = questionApi(); const saved = decodeRun(structuredClone(questionFixture)); const original = JSON.stringify(saved);
    const api = { ...base, review: vi.fn().mockResolvedValue(savedReview(saved)) };
    startWorkspace(api); await waitForHistory(api); flushReview(api);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('品質未達：V2 FAIL / V4 FAIL'));
    questionPicker(workspaceTree(api))!.props.onSelect('next'); flushReview(api);
    expect(api.review).toHaveBeenCalledOnce(); expect(api.start).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(workspaceTree(api));
    if (saved.schemaVersion !== '2.5.0') throw new Error('Missing saved question');
    expect(html).toContain(`実行時の問い：${saved.input.analysisQuestion.text}`);
    expect(html).not.toContain('実行時の問い：次に何を確認すればよい？'); expect(JSON.stringify(saved)).toBe(original);
  });

  it('sends the selected immutable purpose only on explicit start and shows the same saved answer and history', async () => {
    const api = questionApi();
    const accepted = decodeRun(structuredClone(questionFixture)); accepted.id = 'kds_fixture_question_accepted';
    let finish!: (run: Run) => void;
    vi.mocked(api.start).mockReturnValue(new Promise<Run>((resolve) => { finish = resolve; }));
    startWorkspace(api);
    await vi.waitFor(() => { expect(api.runs).toHaveBeenCalledTimes(1); expect(api.comparisonPairs).toHaveBeenCalledTimes(1); expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('比較組の候補を読み込んでいます'); });
    expect(buttonNamed(workspaceTree(api), 'この問いで分析を開始')?.props.disabled).toBe(true);
    questionPicker(workspaceTree(api))!.props.onSelect('support');
    pairPicker(workspaceTree(api))!.props.onSelect(questionFixture.input.comparisonPair!.id);
    expect(api.start).not.toHaveBeenCalled();
    const start = buttonNamed(workspaceTree(api), 'この問いで分析を開始')!;
    expect(start.props.disabled).toBe(false); start.props.onClick(); start.props.onClick();
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.start).mock.calls[0][5]).toEqual(analysisQuestion('support'));
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('「公式の説明は図面を裏付ける？」');
    finish(accepted);
    await vi.waitFor(() => expect(new URL(location.href).searchParams.get('run')).toBe(accepted.id));
    const html = renderToStaticMarkup(workspaceTree(api));
    expect(html).toContain('実行時の問い：公式の説明は図面を裏付ける？');
    if (accepted.schemaVersion !== '2.5.0') throw new Error('Missing answer');
    expect(html).toContain(accepted.signal!.questionAnswer.text);
    questionPicker(workspaceTree(api))!.props.onSelect('next');
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(new URL(location.href).searchParams.get('run')).toBe(accepted.id);
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('実行時の問い：公式の説明は図面を裏付ける？');
    expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('実行時の問い：次に何を確認すればよい？');
    cleanups.forEach((cleanup) => cleanup()); workspaceHooks.states = []; workspaceHooks.refs = [];
    vi.mocked(api.run).mockResolvedValue(accepted); vi.mocked(api.runs).mockResolvedValue([accepted]);
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(2));
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('実行時の問い：公式の説明は図面を裏付ける？');
    expect(api.start).toHaveBeenCalledTimes(1);
  });

  it.each(['foreign-watch', 'different-question', 'missing-question'] as const)('keeps the prior saved result when admitted response has %s', async (kind) => {
    const api = questionApi(); const prior = decodeRun(structuredClone(questionFixture));
    const wrong = decodeRun(structuredClone(questionFixture)); wrong.id = 'kds_fixture_wrong_response';
    if (wrong.schemaVersion !== '2.5.0') throw new Error('Missing question');
    if (kind === 'foreign-watch') wrong.watchId = 'kds_fixture_other_watch';
    if (kind === 'different-question') wrong.input.analysisQuestion = analysisQuestion('next');
    const response = kind === 'missing-question' ? structuredClone(fictionalRunV2) : wrong;
    vi.mocked(api.start).mockResolvedValue(response);
    startWorkspace(api);
    await vi.waitFor(() => { expect(api.runs).toHaveBeenCalledTimes(1); expect(api.comparisonPairs).toHaveBeenCalledTimes(1); expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('比較組の候補を読み込んでいます'); });
    questionPicker(workspaceTree(api))!.props.onSelect('support');
    pairPicker(workspaceTree(api))!.props.onSelect(questionFixture.input.comparisonPair!.id);
    buttonNamed(workspaceTree(api), 'この問いで分析を開始')!.props.onClick();
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('保存データの形式または根拠の参照を確認できません'));
    expect(new URL(location.href).searchParams.get('run')).toBe(prior.id);
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.requestRun).not.toHaveBeenCalled();
  });

  it('changes the viewing question without starting analysis, changing saved results or touching storage', async () => {
    const api = savedApi();
    vi.mocked(api.runs).mockResolvedValue([fictionalRunV2]);
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(1));
    const saved = JSON.stringify(fictionalRunV2);
    const before = new URL(location.href).searchParams.get('run');
    const picker = questionPicker(workspaceTree(api));
    expect(picker).toBeDefined();
    picker!.props.onSelect('support');
    const html = renderToStaticMarkup(workspaceTree(api));
    expect(html).toContain('閲覧する問い：公式の説明は図面を裏付ける？');
    expect(html).toContain('実行時の問い：未記録');
    expect(html).toContain('href="#signal-official"');
    expect(JSON.stringify(fictionalRunV2)).toBe(saved);
    expect(new URL(location.href).searchParams.get('run')).toBe(before);
    expect(api.start).not.toHaveBeenCalled();
    expect(api.saveWatch).not.toHaveBeenCalled();
    expect(api.requestRun).not.toHaveBeenCalled();
    expect(api.runs).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('does not carry a viewing question into another saved result selected from history', async () => {
    const api = savedApi();
    const second = structuredClone(fictionalRunV2);
    second.id = 'FIXTURE-SECOND-SAVED-RUN'; second.createdAt = '2026-09-22T01:00:00Z';
    vi.mocked(api.runs).mockResolvedValue([fictionalRunV2, second]);
    vi.mocked(api.run).mockResolvedValueOnce(fictionalRunV2).mockResolvedValueOnce(second);
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(1));
    questionPicker(workspaceTree(api))!.props.onSelect('support');
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('閲覧する問い：');
    historyPicker(workspaceTree(api))!.props.onSelect(second.id);
    expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('閲覧する問い：');
    await vi.waitFor(() => expect(new URL(location.href).searchParams.get('run')).toBe(second.id));
    const html = renderToStaticMarkup(workspaceTree(api));
    expect(html).toContain(second.createdAt);
    expect(html).toContain('実行時の問い：未記録');
    expect(html).not.toContain('閲覧する問い：');
    expect(api.start).not.toHaveBeenCalled();
  });

  it('rejects a same-ID history GET whose saved watch changed to a different case', async () => {
    const api = savedApi(); const entry = structuredClone(fictionalRunV2); entry.id = 'FIXTURE-HISTORY-IDENTITY';
    const foreign = structuredClone(entry); foreign.watchId = 'FIXTURE-FOREIGN-HISTORY-WATCH'; foreign.input.watch.id = foreign.watchId;
    vi.mocked(api.runs).mockResolvedValue([fictionalRunV2, entry]);
    vi.mocked(api.run).mockResolvedValueOnce(fictionalRunV2).mockResolvedValueOnce(foreign);
    startWorkspace(api); await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(1));
    historyPicker(workspaceTree(api))!.props.onSelect(entry.id);
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('保存データの形式または根拠の参照を確認できません'));
    expect(new URL(location.href).searchParams.get('run')).toBe(fictionalRunV2.id);
    expect(api.start).not.toHaveBeenCalled();
  });

  it('clears the viewing question before loading another watch and keeps saved inputs unchanged', async () => {
    const api = savedApi();
    const bootstrap = structuredClone(fictionalBootstrapV2);
    const second = structuredClone(fictionalRunV2);
    const watch = { ...bootstrap.watches[0], id: 'FIXTURE-SECOND-WATCH', name: '架空の別確認条件' };
    bootstrap.watches.push(watch);
    second.id = 'FIXTURE-SECOND-WATCH-RUN'; second.watchId = watch.id; second.input.watch = watch;
    const saved = JSON.stringify(second);
    vi.mocked(api.bootstrap).mockResolvedValue(bootstrap);
    vi.mocked(api.runs).mockResolvedValueOnce([fictionalRunV2]).mockResolvedValueOnce([second]);
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(1));
    questionPicker(workspaceTree(api))!.props.onSelect('drawings');
    watchPicker(workspaceTree(api), fictionalRunV2.watchId)!.props.onChange({ target: { value: watch.id } });
    expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('閲覧する問い：');
    await vi.waitFor(() => expect(new URL(location.href).searchParams.get('run')).toBe(second.id));
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('実行時の問い：未記録');
    expect(JSON.stringify(second)).toBe(saved);
    expect(api.start).not.toHaveBeenCalled();
  });

  it('clears the viewing question on failure and reload without inventing a stored analysis question', async () => {
    const api = savedApi();
    const saved = JSON.stringify(fictionalRunV2);
    vi.mocked(api.runs).mockResolvedValue([fictionalRunV2]);
    vi.mocked(api.start).mockRejectedValue(new SignalApiError('503', '今回の確認要求を受け付けられません。'));
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(1));
    questionPicker(workspaceTree(api))!.props.onSelect('next');
    buttonNamed(workspaceTree(api), '更新を確認')!.props.onClick();
    await vi.waitFor(() => expect(renderToStaticMarkup(workspaceTree(api))).toContain('今回の確認要求を受け付けられません。'));
    expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('閲覧する問い：');
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('実行時の問い：未記録');
    expect(JSON.stringify(fictionalRunV2)).toBe(saved);
    questionPicker(workspaceTree(api))!.props.onSelect('support');
    cleanups.forEach((cleanup) => cleanup());
    workspaceHooks.states = []; workspaceHooks.refs = [];
    startWorkspace(api);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledTimes(2));
    expect(renderToStaticMarkup(workspaceTree(api))).not.toContain('閲覧する問い：');
    expect(renderToStaticMarkup(workspaceTree(api))).toContain('実行時の問い：未記録');
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
  });

  it('keeps real pending storage untouched in the explicitly injected local development view', async () => {
    values.set('kiriko-design-signals-pending-request', 'a real-mode pending value which must not be read');
    const api = savedApi();
    vi.mocked(api.runs).mockResolvedValue([fictionalRunV2]);
    vi.mocked(api.start).mockResolvedValue(fictionalRunV2);
    startWorkspace(api, true);
    await vi.waitFor(() => expect(api.runs).toHaveBeenCalledWith(fictionalRunV2.watchId));
    const tree = workspaceTree(api, true);
    expect(renderToStaticMarkup(tree)).toContain('このブラウザーのローカル保存だけ');
    const start = buttonNamed(tree, '更新を確認');
    expect(start?.props.disabled).toBe(false);
    start!.props.onClick();
    await vi.waitFor(() => expect(api.start).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(window.addEventListener).not.toHaveBeenCalledWith('storage', expect.anything());
    expect(values.get('kiriko-design-signals-pending-request')).toBe('a real-mode pending value which must not be read');
    expect(api.requestRun).not.toHaveBeenCalled();
  });

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

  it('keeps run A selected and another watch request B durable without automatically posting either', async () => {
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
    expect(html).toContain('現在の登録範囲に含まれない');
    expect(new URL(location.href).searchParams.get('run')).toBe(fictionalRunV2.id);
    expect(readPendingRunRequest()).toEqual(pending);
    expect(values.get('kiriko-design-signals-pending-request')).toBe(pendingValue);
    expect(localStorage.setItem).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled();
    expect(api.runs).toHaveBeenCalledExactlyOnceWith(fictionalRunV2.watchId);
    const start = buttonNamed(tree, '更新を確認');
    expect(start).toBeDefined(); expect(start!.props.disabled).toBe(false);
    expect(api.start).not.toHaveBeenCalled(); expect(api.saveWatch).not.toHaveBeenCalled(); expect(api.requestRun).not.toHaveBeenCalled();
  });
});
