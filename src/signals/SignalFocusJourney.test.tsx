import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalFocusJourney } from './SignalFocusJourney';
import { fictionalRunV2 } from './fixtures';
import type { RunV2 } from './contract';
import type { RunReviewState } from './run-review';

const hooks = vi.hoisted(() => ({ active: false, index: 0, refIndex: 0, states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[] }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useId: () => hooks.active ? 'kds_fixture_journey' : actual.useId(),
    useState: (initial: unknown) => {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.states)) hooks.states[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next; }];
    },
    useRef: (initial: unknown) => hooks.active ? hooks.refs[hooks.refIndex++] ??= { current: initial } : actual.useRef(initial),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (hooks.active) hooks.effects.push(effect); else actual.useEffect(effect, deps); },
  };
});
type Control = ReactElement<{ children?: ReactNode; id?: string; onClick: () => void; className?: string; 'aria-current'?: string }>;
function find(node: ReactNode, match: (child: Control) => boolean): Control | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Control['props']>(child)) continue;
    if (match(child)) return child;
    const found = find(child.props.children, match); if (found) return found;
  }
}
function tree(run: RunV2 = fictionalRunV2, reviewState?: RunReviewState) {
  hooks.index = 0; hooks.refIndex = 0; hooks.effects = []; hooks.active = true;
  try { return SignalFocusJourney({ run, reviewState, scopes: [{ id: run.watchId, label: 'FIXTURE-保存条件' }], onScopeChange: vi.fn() }); }
  finally { hooks.active = false; }
}
const html = (node: ReactNode) => renderToStaticMarkup(node);
let href = 'https://example.test/?run=kds_fixture_saved';
beforeEach(() => {
  hooks.states = []; hooks.refs = []; hooks.effects = [];
  href = 'https://example.test/?run=kds_fixture_saved';
  vi.stubGlobal('window', { location: { get href() { return href; } }, history: { replaceState: vi.fn((_data, _title, url: URL) => { href = url.href; }) } });
});
afterEach(() => vi.unstubAllGlobals());

describe('selected saved observation journey', () => {
  it('starts with real saved parts and media, not a marketing hero or a fabricated new event', () => {
    const rendered = html(tree());
    expect(rendered).toContain('まず、どこを見る？');
    expect(rendered).toContain(fictionalRunV2.signal!.visualObservations[0].part);
    expect(rendered).toContain('/api/v1/media/');
    expect(rendered).toContain('前回監視からの新着ではありません');
    expect(rendered).toContain('架空資料の保存例');
    expect(rendered).not.toContain('id="signal-result"');
    expect(rendered).not.toContain('同一製品として確認済み');
  });

  it('changes only selected evidence, saves the selection in the run URL and restores the candidate focus', () => {
    const run = structuredClone(fictionalRunV2), first = run.signal!.visualObservations[0];
    run.signal!.visualObservations.push({ ...first, id: 'kds_fixture_second_observation', part: 'FIXTURE-独立した着目箇所', observation: 'FIXTURE-二つ目の記述' });
    const before = JSON.stringify(run);
    let node = tree(run);
    find(node, (item) => item.props.id === 'kds_fixture_journey-candidate-kds_fixture_second_observation')!.props.onClick();
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() };
    hooks.refs[0].current = target;
    node = tree(run); hooks.effects[0]();
    expect(target.focus).toHaveBeenCalled();
    expect(new URL(href).searchParams.get('focus')).toBe('kds_fixture_second_observation');
    expect(new URL(href).searchParams.get('run')).toBe('kds_fixture_saved');
    expect(html(node)).toContain('FIXTURE-二つ目の記述');
    expect(html(node)).not.toContain(first.observation);
    const candidate = { focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal('document', { getElementById: vi.fn(() => candidate) });
    find(node, (item) => item.props.className?.includes('signal-focus-back') ?? false)!.props.onClick();
    tree(run); hooks.effects[0]();
    expect(candidate.focus).toHaveBeenCalled();
    expect(new URL(href).searchParams.has('focus')).toBe(false);
    expect(JSON.stringify(run)).toBe(before);
  });

  it('restores only a focus belonging to the selected run, and ignores unrelated IDs', () => {
    const id = fictionalRunV2.signal!.visualObservations[0].id;
    href += '&focus=' + encodeURIComponent(id);
    expect(html(tree())).toContain('data-open="true"');
    hooks.states = []; href = 'https://example.test/?focus=kds_fixture_not_in_run';
    expect(html(tree())).toContain('data-open="false"');
  });

  it('does not promote reference excerpts or unrelated official facts into evidence for the selected part', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.relationships = [];
    run.signal!.officialFacts = [{ id: 'kds_fixture_unrelated_fact', text: 'FIXTURE-無関係の採用不可事実', sourceId: run.signal!.sources[0].id, quote: 'FIXTURE-引用', start: 0, end: 12 }];
    hooks.states[1] = 'source';
    const rendered = html(tree(run));
    expect(rendered).toContain('この着目点を裏付ける公式引用と対応評価は保存されていません');
    expect(rendered).toContain('同じ実行で取得した参考資料');
    expect(rendered).not.toContain('FIXTURE-無関係の採用不可事実');
  });

  it('keeps missing dates and next investigations explicit', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.sources.forEach((source) => { source.publishedAt = null; });
    hooks.states[1] = 'source';
    expect(html(tree(run))).toContain('発表日 不明');
    run.signal!.questionsForHuman = []; hooks.states[1] = 'next';
    expect(html(tree(run))).toContain('具体的な次の調査は保存されていません');
  });

  it('binds quality holds to this exact run and preserves them across stages', () => {
    const run = fictionalRunV2;
    const reviewState: RunReviewState = { status: 'ready', review: { runId: run.id, schemaVersion: run.schemaVersion, promptVersion: run.versions.prompt, modelId: run.versions.model, reviewReference: 'FIXTURE-review', reviewedAt: null, failedChecks: ['V2', 'V4'], ownerAcceptance: 'NOT_PERFORMED' } };
    expect(html(tree(run, reviewState))).toContain('このrunの図面観察は品質未達');
    hooks.states[1] = 'next';
    expect(html(tree(run, reviewState))).toContain('次の調査・示唆も品質未達');
    reviewState.review!.runId = 'kds_fixture_other_run';
    expect(html(tree(run, reviewState))).not.toContain('次の調査・示唆も品質未達');
  });

  it('announces incomplete runs and unregistered quality before opening the archive', () => {
    const run = structuredClone(fictionalRunV2);
    run.status = 'partial';
    const rendered = html(tree(run));
    expect(rendered).toContain('保存された途中資料です');
    expect(rendered).toContain('このrunに紐づく品質評価は未登録または取得できません');
    expect(rendered).not.toContain('id="signal-result"');
  });

  it('moves keyboard focus after the previous stage control disappears', () => {
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const node = tree();
    hooks.refs[0].current = target;
    find(node, (item) => item.type === 'button' && item.props.children === '公式記載と関係を確かめる →')!.props.onClick();
    tree(); hooks.effects[0]();
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('keeps supporting and opposing quotations distinct', () => {
    const run = structuredClone(fictionalRunV2), signal = run.signal!, visual = signal.visualObservations[0];
    const fact = signal.officialFacts[0];
    signal.officialFacts = [{ ...fact, id: 'kds_fixture_support', text: 'FIXTURE-支持する記載' }, { ...fact, id: 'kds_fixture_opposition', text: 'FIXTURE-反証する記載' }];
    signal.relationships = [{ id: 'kds_fixture_relationship', relation: 'unrelated_or_conflicting', summary: 'FIXTURE-一致しない可能性', supportingEvidenceIds: [visual.id, 'kds_fixture_support'], opposingEvidenceIds: ['kds_fixture_opposition'], missingEvidence: [] }];
    hooks.states[1] = 'source';
    const rendered = html(tree(run));
    expect(rendered).toContain('支持する根拠として保存');
    expect(rendered).toContain('反証・食い違いの根拠として保存');
    expect(rendered).toContain('FIXTURE-反証する記載');
  });
});
