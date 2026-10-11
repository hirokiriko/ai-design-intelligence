import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fictionalRunV22 } from './fixtures-v22';
import type { ApprovedPreview } from './approved-preview';
import type { RunV23 } from './contract';
import { ApprovedEvidenceContent, SignalApprovedEvidenceWorkspace } from './SignalApprovedEvidenceWorkspace';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';
import { evidenceId } from './labels';

const hooks = vi.hoisted(() => ({ active: false, index: 0, states: [] as unknown[], effects: [] as (() => void | (() => void))[] }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState: ((initial: unknown) => {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.index++;
      if (index >= hooks.states.length) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (update: unknown) => { hooks.states[index] = typeof update === 'function' ? update(hooks.states[index]) : update; }];
    }) as typeof actual.useState,
    useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
      if (hooks.active) hooks.effects.push(effect); else actual.useEffect(effect, dependencies);
    },
    useRef: ((initial: unknown) => hooks.active ? { current: initial } : actual.useRef(initial)) as typeof actual.useRef,
  };
});

function fixture(): ApprovedPreview {
  const prior = structuredClone(fictionalRunV22);
  const run: RunV23 = { ...prior, schemaVersion: '2.3.0', input: { ...prior.input, context: { ...prior.input.context, dataMode: 'approved_public' } }, versions: { ...prior.versions, schema: '2.3.0' } };
  for (const source of run.signal!.sources) { source.publishedAt = null; source.updatedAt = null; source.releaseAt = null; }
  return { version: 1, run, quality: { v2: 'FAIL', v4: 'FAIL', humanAcceptance: 'NOT_PERFORMED' },
    observations: [{ id: 'observation-a', text: '架空図面の内側と外側を別々に確認した事実。', mediaIds: run.signal!.media.map((item) => item.id) }],
    media: run.input.comparisonPair!.media.map((item, index) => ({ id: item.id, file: index ? 'b.jpg' : 'a.jpg', sha256: '1'.repeat(64), width: item.width, height: item.height })) as ApprovedPreview['media'],
    provenance: { savedRunSha256: '2'.repeat(64), qualityReviewSha256: '3'.repeat(64) } };
}
function tree(load: () => Promise<ApprovedPreview>) {
  hooks.index = 0; hooks.effects = []; hooks.active = true;
  try { return SignalApprovedEvidenceWorkspace({ load }); } finally { hooks.active = false; }
}
function find(node: ReactNode, predicate: (element: ReactElement<Record<string, unknown>>) => boolean): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Record<string, unknown>>(child)) continue;
    if (predicate(child)) return child;
    const found = find(child.props.children as ReactNode, predicate); if (found) return found;
  }
  return undefined;
}
function content(node: ReactNode) { return find(node, (item) => item.type === ApprovedEvidenceContent)!; }
function approvedTree(view: ReactElement<Record<string, unknown>>) {
  hooks.active = true;
  try { return ApprovedEvidenceContent(view.props as Parameters<typeof ApprovedEvidenceContent>[0]); } finally { hooks.active = false; }
}

describe('approved evidence and archived failed result separation', () => {
  beforeEach(() => {
    const record = fixture().run.signal!.media[0].recordId;
    vi.stubGlobal('window', { location: { search: new URLSearchParams({ record }).toString() } });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('shows material facts and exact quotes first, without exposing incorrect archived AI observations', () => {
    const preview = fixture();
    preview.run.signal!.visualObservations[0].observation = 'kds_fixture_ARCHIVED_WRONG_OBSERVATION';
    const saved = JSON.stringify(preview);
    const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, { preview, question: 'support', onQuestion: () => undefined, replay: false, onReplay: () => undefined }));
    expect(html).toContain('資料から確認した事実');
    expect(html).toContain(preview.observations[0].text);
    expect(html).toContain(preview.run.signal!.officialFacts[0].quote);
    expect(html).toContain('V2・V4はFAILのまま');
    expect(html).toContain('この読み取り画面では新しい分析を開始しません');
    expect(html).not.toContain('kds_fixture_ARCHIVED_WRONG_OBSERVATION');
    expect(html).not.toContain('id="signal-result"');
    for (const media of preview.media) expect(html).toContain(`/__signals-local-preview/approved/media/${media.id}`);
    for (const fact of preview.run.signal!.officialFacts) { expect(html).toContain(`id="${evidenceId(fact.id)}"`); expect(html).toContain(`id="${evidenceId(fact.sourceId)}"`); }
    expect(JSON.stringify(preview)).toBe(saved);
  });
  it('replays the original failed result only after a warning, with no duplicate evidence targets', () => {
    const preview = fixture(); preview.run.signal!.visualObservations[0].observation = 'kds_fixture_ARCHIVED_WRONG_OBSERVATION';
    const saved = JSON.stringify(preview.run);
    const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, { preview, question: 'next', onQuestion: () => undefined, replay: true, onReplay: () => undefined }));
    expect(html.indexOf('V2 FAIL / V4 FAIL')).toBeLessThan(html.indexOf('kds_fixture_ARCHIVED_WRONG_OBSERVATION'));
    expect(html).toContain('V2 FAIL / V4 FAIL · 本人受入は未実施');
    expect(html).not.toContain('aria-label="保存結果の品質レビュー"');
    expect(html).not.toContain('品質レビュー：未確認');
    const normalResult = renderToStaticMarkup(createElement(SignalResult, { run: preview.run, focusOnLoad: false }));
    expect(normalResult).toContain('aria-label="保存結果の品質レビュー"');
    expect(html).toContain('実行時の問い：未記録'); expect(html).toContain(preview.run.versions.prompt);
    expect(html).not.toContain('id="signal-approved-drawings"');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(preview.run)).toBe(saved);
  });
  it('keeps shared source targets unique and ties each saved observation to its actual drawing labels', () => {
    const preview = fixture();
    const fact = preview.run.signal!.officialFacts[0];
    const additionalFact = { ...fact, id: 'kds_fixture_SHARED_OFFICIAL_FACT' };
    preview.run.signal!.officialFacts.push(additionalFact);
    const saved = JSON.stringify(preview);
    const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, { preview, question: 'support', onQuestion: () => undefined, replay: false, onReplay: () => undefined }));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === evidenceId(fact.sourceId))).toHaveLength(1);
    expect(ids).toContain(evidenceId(additionalFact.id));
    for (const media of preview.run.signal!.media) expect(html).toContain(`${media.label}へ</a>`);
    expect(html).toContain('aria-describedby="signal-approved-observation-a"');
    expect(html).toContain('id="signal-approved-observation-a"');
    expect(html).not.toContain('輪郭と操作部');
    expect(html).not.toContain('内側の円、操作部');
    expect(html).toContain('保存された確認内容');
    expect(html).toContain(fact.text);
    expect(JSON.stringify(preview)).toBe(saved);
  });
  it.each([null, 'FIXTURE-UNKNOWN', 'FIXTURE-NO-DIAGRAM'])('removes the entire fixed evidence journey for an unpaired selection: %s', (record) => {
    const preview = fixture();
    const sample = { ...preview.run.signal!.recordFacts[0], id: 'kds_fixture_NO_DIAGRAM_FACT', recordId: 'FIXTURE-NO-DIAGRAM', selectionReason: 'scope_sample' as const };
    preview.run.signal!.recordFacts.push(sample);
    vi.stubGlobal('window', { location: { search: record ? new URLSearchParams({ record }).toString() : '' } });
    const saved = JSON.stringify(preview);
    const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, { preview, question: 'next', onQuestion: () => undefined, replay: false, onReplay: () => undefined }));
    for (const target of ['signal-approved-drawings', 'signal-approved-sources', 'signal-approved-next', 'signal-conditions']) {
      expect(html).not.toContain(`id="${target}"`); expect(html).not.toContain(`href="#${target}"`);
    }
    expect(html).not.toContain('<img'); expect(html).not.toContain('signal-question-option');
    expect(html).not.toContain(preview.observations[0].text);
    for (const fact of preview.run.signal!.officialFacts) expect(html).not.toContain(fact.quote);
    expect(html).toContain('id="signal-approved-scope"'); expect(html).toContain('id="signal-approved-history"');
    expect(html).toContain('V2・V4はFAILのまま');
    expect(html).toContain('選択中の意匠を単独で分析した履歴ではありません');
    if (record === sample.recordId) expect(html).toContain('図面と画像観察は未収録です');
    expect(JSON.stringify(preview)).toBe(saved);
  });
  it.each([0, 1])('labels the selected drawing and the other design before showing saved comparison %i', (index) => {
    const preview = fixture(), media = preview.run.signal!.media;
    vi.stubGlobal('window', { location: { search: new URLSearchParams({ record: media[index].recordId }).toString() } });
    const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, { preview, question: null, onQuestion: () => undefined, replay: false, onReplay: () => undefined }));
    expect(html).toContain(`選択意匠の図面：${media[index].label}`);
    expect(html).toContain(`比較相手：${media[1 - index].label}`);
    expect(html).toContain('比較相手は別の意匠です');
    expect(html).toContain('選択意匠・比較相手との製品対応は未確認です');
    expect(html).toContain('id="signal-approved-drawings"');
    expect(html).toContain('id="signal-approved-sources"');
  });
  it('does not call two drawings of the same record different designs', () => {
    const preview = fixture(), media = preview.run.signal!.media;
    media[1].recordId = media[0].recordId;
    const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, { preview, question: null, onQuestion: () => undefined, replay: false, onReplay: () => undefined }));
    expect(html).toContain('A/Bは同じ意匠の保存図面です');
    expect(html).not.toContain('比較相手は別の意匠です');
  });
});

describe('read-only preview reload and navigation', () => {
  beforeEach(() => {
    hooks.states = []; hooks.effects = [];
    const location = { href: 'http://127.0.0.1:4189/?signalsDemo=approved', search: '?signalsDemo=approved' };
    vi.stubGlobal('window', { location, history: { replaceState: vi.fn((_state, _title, value: URL) => { location.href = value.toString(); location.search = value.search; }) } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
  it('keeps the viewing question separate through visible selection, saved history, return and URL reload', async () => {
    const preview = fixture();
    preview.run.signal!.visualObservations[0].observation = 'kds_fixture_ARCHIVED_RESULT';
    const saved = JSON.stringify(preview);
    const versions = structuredClone(preview.run.versions);
    const load = vi.fn(async () => preview);
    tree(load); hooks.effects[0](); await settle();
    let view = content(tree(load));
    expect(view.props.replay).toBe(false); expect(view.props.question).toBeNull();

    const main = approvedTree(view);
    const question = find(main, (item) => item.type === 'button' && item.props.className === 'signal-question-option'
      && item.props['aria-label'] === '公式引用が支えるのは？')!;
    const target = { tagName: 'SECTION', parentElement: null as unknown, hasAttribute: () => true, focus: vi.fn(), scrollIntoView: vi.fn() };
    const root = { contains: (value: unknown) => value === target, ownerDocument: { getElementById: vi.fn((id: string) => id === 'signal-approved-sources' ? target : null) } };
    target.parentElement = root;
    (question.props.onClick as (event: unknown) => void)({ currentTarget: { closest: () => root } });
    view = content(tree(load));
    expect(view.props.question).toBe('support'); expect(view.props.replay).toBe(false);
    expect(root.ownerDocument.getElementById).toHaveBeenCalledWith('signal-approved-sources');
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });

    const openHistory = () => {
      const history = find(approvedTree(content(tree(load))), (item) => item.type === SignalHistory)!;
      expect(history.props.runs).toEqual([preview.run]);
      const historyButton = find(SignalHistory(history.props as Parameters<typeof SignalHistory>[0]), (item) => item.type === 'button')!;
      (historyButton.props.onClick as () => void)();
    };
    const assertArchived = (archived: ReactElement<Record<string, unknown>>) => {
      expect(archived.props.replay).toBe(true);
      const html = renderToStaticMarkup(createElement(ApprovedEvidenceContent, archived.props as Parameters<typeof ApprovedEvidenceContent>[0]));
      expect(html).toContain('実行時の問い：未記録'); expect(html).toContain('V2 FAIL / V4 FAIL');
      expect(html).toContain('kds_fixture_ARCHIVED_RESULT'); expect(html).toContain(versions.prompt); expect(html).toContain(versions.model);
      expect(html).not.toContain('公式引用が支えるのは？');
      expect(preview.run.input).not.toHaveProperty('analysisQuestion');
      expect(preview.run.versions).toEqual(versions);
      for (const source of preview.run.signal!.sources) {
        expect(source.publishedAt).toBeNull(); expect(source.updatedAt).toBeNull(); expect(source.releaseAt).toBeNull();
      }
      expect(JSON.stringify(preview)).toBe(saved);
    };
    openHistory(); view = content(tree(load)); assertArchived(view);
    expect(view.props.question).toBe('support'); expect(window.location.search).toContain(`run=${preview.run.id}`);
    const close = find(approvedTree(view), (item) => item.type === 'button' && item.props.children === '保存例を閉じて資料から確認した事実へ戻る')!;
    (close.props.onClick as () => void)();
    view = content(tree(load));
    expect(view.props.replay).toBe(false); expect(view.props.question).toBe('support');
    expect(window.location.search).not.toContain('run='); expect(load).toHaveBeenCalledTimes(1);

    openHistory();
    const refresh = find(tree(load), (item) => item.type === 'button' && item.props.children === '保存資料を読み直す')!;
    (refresh.props.onClick as () => void)();
    const loading = tree(load);
    expect(content(loading)).toBeUndefined(); expect(renderToStaticMarkup(loading)).toContain('保存資料を読んでいます');
    expect(hooks.states[2]).toBeNull(); expect(hooks.states[3]).toBe(false);
    hooks.effects[0](); await settle();
    view = content(tree(load)); assertArchived(view);
    expect(view.props.question).toBeNull(); expect(window.location.search).toContain(`run=${preview.run.id}`);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('restores only the selected saved example from the URL and returns without another load', async () => {
    const preview = fixture(); window.location.search += `&run=${preview.run.id}`;
    const load = vi.fn(async () => preview);
    tree(load); hooks.effects[0](); await settle();
    let view = content(tree(load)); expect(view.props.replay).toBe(true);
    (view.props.onQuestion as (value: string) => void)('support');
    (view.props.onReplay as (value: boolean) => void)(false);
    view = content(tree(load)); expect(view.props.replay).toBe(false); expect(view.props.question).toBe('support');
    expect(window.location.search).not.toContain('run='); expect(load).toHaveBeenCalledTimes(1);
    (view.props.onReplay as (value: boolean) => void)(true);
    expect(window.location.search).toContain(`run=${preview.run.id}`); expect(load).toHaveBeenCalledTimes(1);
    (view.props.onReplay as (value: boolean) => void)(false);
    view = content(tree(load)); expect(view.props.question).toBe('support');
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('clears evidence and viewing question during reload and keeps them cleared on failure', async () => {
    const preview = fixture(); const load = vi.fn().mockResolvedValueOnce(preview).mockRejectedValueOnce(new Error('unavailable'));
    tree(load); hooks.effects[0](); await settle();
    const view = content(tree(load)); (view.props.onQuestion as (value: string) => void)('next'); (view.props.onReplay as (value: boolean) => void)(true);
    const refresh = find(tree(load), (item) => item.type === 'button' && item.props.children === '保存資料を読み直す')!;
    (refresh.props.onClick as () => void)();
    const loading = tree(load); expect(content(loading)).toBeUndefined(); expect(renderToStaticMarkup(loading)).toContain('保存資料を読んでいます');
    hooks.effects[0](); await settle();
    const failed = tree(load); expect(content(failed)).toBeUndefined(); expect(renderToStaticMarkup(failed)).toContain('保存資料を確認できません');
    expect(hooks.states[2]).toBeNull(); expect(hooks.states[3]).toBe(false); expect(load).toHaveBeenCalledTimes(2);
  });
  it('ignores an old load finishing after the effect was cancelled', async () => {
    let resolve!: (value: ApprovedPreview) => void;
    const load = vi.fn(() => new Promise<ApprovedPreview>((done) => { resolve = done; }));
    tree(load); const cleanup = hooks.effects[0](); if (typeof cleanup === 'function') cleanup();
    resolve(fixture()); await settle();
    expect(content(tree(load))).toBeUndefined(); expect(hooks.states[0]).toEqual({ status: 'loading' });
  });
});
