import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalFocusJourney } from './SignalFocusJourney';
import { fictionalRunV2 } from './fixtures';
import { decodeRun } from './contract';
import questionFixture from './backend-run-v2.5.fixture.json';
import evidencePlanFixture from './backend-question-evidence-plan.fixture.json';
import type { RunReviewState } from './run-review';
import { SignalConfirmationGuide } from './SignalConfirmationGuide';
import { confirmationGuide } from './confirmation-guide';

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
type Control = ReactElement<{ children?: ReactNode; id?: string; onClick: (event?: { currentTarget: { dataset: { observationId: string } } }) => void; className?: string; 'aria-current'?: string; 'data-observation-id'?: string; open?: boolean }>;
function find(node: ReactNode, match: (child: Control) => boolean): Control | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Control['props']>(child)) continue;
    if (match(child)) return child;
    const found = find(child.props.children, match); if (found) return found;
  }
}
function tree(run: Parameters<typeof SignalFocusJourney>[0]['run'] = fictionalRunV2, reviewState?: RunReviewState) {
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
    expect(html(find(node, (item) => item.props.id === 'signal-focus-detail'))).not.toContain(first.observation);
    const candidate = { focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal('document', { getElementById: vi.fn(() => candidate) });
    find(node, (item) => item.props.className?.includes('signal-focus-back') ?? false)!.props.onClick();
    tree(run); hooks.effects[0]();
    expect(candidate.focus).toHaveBeenCalled();
    expect(new URL(href).searchParams.has('focus')).toBe(false);
    expect(JSON.stringify(run)).toBe(before);
  });

  it('distinguishes saved target counts from AI observations, without claiming no physical change', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.counts = { before: 3, after: 3, newlyObserved: 0, excludedBefore: 1, excludedAfter: 5, comparable: true };
    const before = JSON.stringify(run);
    const node = tree(run);
    const counts = html(find(node, item => item.props.className === 'signal-focus-saved-counts'));
    expect(counts).toContain('保存集合の対象 3 → 3件');
    expect(counts).toContain('新たに対象となった資料 0件');
    expect(counts).not.toContain('変化なし');
    expect(html(node)).toContain('前回監視からの新着ではありません');
    expect(JSON.stringify(run)).toBe(before);
    run.signal!.counts.comparable = false;
    const unavailable = html(find(tree(run), item => item.props.className === 'signal-focus-saved-counts'));
    expect(unavailable).toContain('保存集合の対象 3 → 3件');
    expect(unavailable).toContain('新規対象数は比較不可');
    expect(unavailable).not.toContain('新たに対象となった資料 0件');
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
    expect(rendered).toContain('実行全体の参考引用 · 選択箇所との対応はここでは未判定');
    expect(rendered).toContain('保存AIによる記載要約');
    expect(rendered).not.toContain('支持する根拠として保存');
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

  it('shows different saved A/B excerpts for candidates sharing the same status and general part', () => {
    const run = structuredClone(fictionalRunV2), first = run.signal!.visualObservations[0];
    first.id = 'kds_fixture_outer'; first.part = 'FIXTURE-境界';
    first.observation = 'A：FIXTURE-外側の輪郭（破線）。B：FIXTURE-外側の輪郭（実線）。描画上の比較：差異あり。';
    run.signal!.visualObservations.push({ ...first, id: 'kds_fixture_inner', observation: 'A：FIXTURE-内側の輪郭（実線）。B：FIXTURE-内側の輪郭（実線）。描画上の比較：不明。' });
    const before = JSON.stringify(run), node = tree(run);
    const outer = html(find(node, item => item.props.id === 'kds_fixture_journey-candidate-kds_fixture_outer'));
    const inner = html(find(node, item => item.props.id === 'kds_fixture_journey-candidate-kds_fixture_inner'));
    expect(outer).toContain('FIXTURE-外側の輪郭（破線）');
    expect(outer).toContain('FIXTURE-外側の輪郭（実線）');
    expect(inner).toContain('FIXTURE-内側の輪郭（実線）');
    expect(inner).not.toContain('FIXTURE-外側');
    expect(outer).toContain('保存AI観察の抜粋');
    expect(outer).not.toContain('AIが描画の違いを候補に挙げています');
    expect(JSON.stringify(run)).toBe(before);
  });

  function investigationRun() {
    const run = structuredClone(fictionalRunV2), original = run.signal!.visualObservations[0];
    run.signal!.visualObservations = [
      { ...original, id: 'kds_fixture_outer', part: 'FIXTURE-外側', observation: 'FIXTURE-外側の保存観察' },
      { ...original, id: 'kds_fixture_inner', part: 'FIXTURE-内側', observation: 'FIXTURE-内側の保存観察' },
    ];
    run.signal!.questionsForHuman = [
      'kds_fixture_outerのFIXTURE-外側資料を照合する',
      'kds_fixture_innerのFIXTURE-内側資料を照合する',
      'kds_fixture_outerとkds_fixture_innerのFIXTURE-共通資料を照合する',
      'FIXTURE-全体の追加資料を確認する',
      'kds_fixture_unknownのFIXTURE-参照未確認資料',
    ];
    run.signal!.relationships = [{ id: 'kds_fixture_unbound_relation', relation: 'unknown', summary: 'FIXTURE-対応未確認', supportingEvidenceIds: [], opposingEvidenceIds: [], missingEvidence: ['FIXTURE-実行全体の不足資料'] }];
    return run;
  }

  it('keeps selected investigations primary, preserving other and unbound text in a closed run-wide disclosure', () => {
    const run = investigationRun(), before = JSON.stringify(run);
    hooks.states[1] = 'next';
    const node = tree(run);
    const primary = html(find(node, item => item.props.className === 'signal-focus-investigations signal-focus-next-list'));
    expect(primary).toContain('FIXTURE-外側資料');
    expect(primary).toContain('FIXTURE-共通資料');
    expect(primary).not.toContain('FIXTURE-内側資料');
    const other = find(node, item => item.props.className === 'signal-focus-run-investigations')!;
    expect(other.props.open).toBeUndefined();
    expect(html(other)).toContain('FIXTURE-内側資料');
    expect(html(other)).toContain('FIXTURE-全体の追加資料');
    expect(html(other)).toContain('kds_fixture_unknown');
    expect(html(other)).toContain('FIXTURE-実行全体の不足資料');
    expect(find(other, item => item.props['data-observation-id'] === 'kds_fixture_unknown')).toBeUndefined();
    expect(JSON.stringify(run)).toBe(before);
  });

  it('opens only a known referenced candidate, clears the old investigation view and restores back focus', () => {
    const run = investigationRun(), before = JSON.stringify(run);
    href += '&focus=kds_fixture_outer'; hooks.states[1] = 'next';
    let node = tree(run);
    const primary = find(node, item => item.props.className === 'signal-focus-investigations signal-focus-next-list')!;
    const reference = find(primary, item => item.props['data-observation-id'] === 'kds_fixture_inner')!;
    expect(html(reference)).toContain('着目点 2：FIXTURE-内側');
    reference.props.onClick({ currentTarget: { dataset: { observationId: reference.props['data-observation-id']! } } });
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() };
    hooks.refs[0].current = target;
    node = tree(run); hooks.effects[0]();
    expect(target.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(new URL(href).searchParams.get('focus')).toBe('kds_fixture_inner');
    const detail = find(node, item => item.props.id === 'signal-focus-detail')!;
    expect(html(detail)).toContain('FIXTURE-内側の保存観察');
    expect(html(detail)).not.toContain('FIXTURE-外側の保存観察');
    expect(html(detail)).not.toContain('signal-focus-next-list');
    find(node, item => item.type === 'button' && html(item).includes('次の調査を決める'))!.props.onClick();
    node = tree(run);
    const nextPrimary = html(find(node, item => item.props.className === 'signal-focus-investigations signal-focus-next-list'));
    expect(nextPrimary).toContain('FIXTURE-内側資料');
    expect(nextPrimary).toContain('FIXTURE-共通資料');
    expect(nextPrimary).not.toContain('FIXTURE-外側資料');
    const candidate = { focus: vi.fn(), scrollIntoView: vi.fn() };
    vi.stubGlobal('document', { getElementById: vi.fn(() => candidate) });
    find(node, item => item.props.className?.includes('signal-focus-back') ?? false)!.props.onClick();
    tree(run); hooks.effects[0]();
    expect(document.getElementById).toHaveBeenCalledWith('kds_fixture_journey-candidate-kds_fixture_inner');
    expect(candidate.focus).toHaveBeenCalled();
    expect(new URL(href).searchParams.has('focus')).toBe(false);
    expect(JSON.stringify(run)).toBe(before);
  });

  it('does not invent selected investigations for old unbound text, or humanize quotation text', () => {
    const run = investigationRun();
    run.signal!.questionsForHuman = ['FIXTURE-全体だけの調査'];
    hooks.states[1] = 'next';
    const node = tree(run);
    expect(find(node, item => item.props.className === 'signal-focus-investigations signal-focus-next-list')).toBeUndefined();
    expect(html(node)).toContain('この着目点を明示する調査事項は保存されていません');
    const fact = run.signal!.officialFacts[0]; fact.quote = 'FIXTURE-原文のkds_fixture_outerは変えない';
    run.signal!.relationships[0].supportingEvidenceIds = ['kds_fixture_outer', fact.id];
    hooks.states[1] = 'source';
    const quote = find(tree(run), item => item.type === 'blockquote')!;
    expect(quote.props.children).toBe(fact.quote);
  });

  it('uses the saved version 2.5 question nextChecks without changing the DTO or falling back to old questions', () => {
    const run = decodeRun(structuredClone(questionFixture));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('FIXTURE-question run expected');
    const observation = run.signal.visualObservations[0];
    run.signal.questionAnswer.nextChecks = [`${observation.id}のFIXTURE-選択した問いの資料を確認`];
    run.signal.questionsForHuman = ['FIXTURE-旧問いの代替は禁止'];
    const before = JSON.stringify(run); hooks.states[1] = 'next';
    const primary = html(find(tree(run), item => item.props.className === 'signal-focus-investigations signal-focus-next-list'));
    expect(primary).toContain('FIXTURE-選択した問いの資料');
    expect(primary).not.toContain('FIXTURE-旧問いの代替は禁止');
    expect(JSON.stringify(run)).toBe(before);
  });

  it('scopes the actual Backend projected investigation by ID even when observation labels are identical', () => {
    const run = decodeRun(structuredClone(questionFixture));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('FIXTURE-question run expected');
    const original = run.signal.visualObservations[0];
    const target = evidencePlanFixture.context.visualObservations[0];
    run.signal.visualObservations = [
      { ...original, ...target },
      { ...original, id: 'FIXTURE-CONTOUR-OTHER', part: target.part },
    ];
    run.signal.questionAnswer.nextChecks = [...evidencePlanFixture.projectedAnswer.nextChecks];
    const before = JSON.stringify(run); hooks.states[1] = 'next';
    const primary = find(tree(run), item => item.props.className === 'signal-focus-investigations signal-focus-next-list')!;
    expect(html(primary)).toContain('架空の対応製品図と部品表');
    expect(html(primary)).toContain('確認できない場合：同一部位との対応と機能の帰属を保留する');
    expect(find(primary, item => item.props['data-observation-id'] === 'FIXTURE-CONTOUR')).toBeDefined();
    expect(find(primary, item => item.props['data-observation-id'] === 'FIXTURE-CONTOUR-OTHER')).toBeUndefined();
    const saved = find(primary, item => item.props.className === 'signal-focus-original-text')!;
    expect(find(saved, item => item.type === 'p')!.props.children).toBe(evidencePlanFixture.projectedAnswer.nextChecks[0]);
    hooks.states[0] = 'FIXTURE-CONTOUR-OTHER';
    const other = tree(run);
    expect(find(other, item => item.props.className === 'signal-focus-investigations signal-focus-next-list')).toBeUndefined();
    expect(html(find(other, item => item.props.className === 'signal-focus-run-investigations'))).toContain('架空の対応製品図と部品表');
    expect(JSON.stringify(run)).toBe(before);
  });
  it('keeps fixed questions separate from source-only AI plans and quality holds for arbitrary saved observations', () => {
    const run = decodeRun(structuredClone(questionFixture));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('FIXTURE-question run expected');
    const signal = run.signal, original = signal.visualObservations[0];
    signal.visualObservations = ['外郭', '同心円', '円形と長円形', '実線と破線の混在', '別の形'].map((text, index) => ({ ...original, id: `kds_fixture_guide_${index}`, observation: `A：FIXTURE-${text}。B：FIXTURE-${text}。描画上の比較：不明。` }));
    signal.questionAnswer.nextChecks = [`対象：${signal.sources[0].id}。FIXTURE-公式の記載を照合する`];
    const reviewState: RunReviewState = { status: 'ready', review: { runId: run.id, schemaVersion: run.schemaVersion, promptVersion: run.versions.prompt, modelId: run.versions.model, reviewReference: 'FIXTURE-review', reviewedAt: null, failedChecks: ['V1', 'V3', 'V4'], ownerAcceptance: 'NOT_PERFORMED' } };
    const before = JSON.stringify({ run, reviewState });
    for (const observation of signal.visualObservations) {
      hooks.states[0] = observation.id; hooks.states[1] = 'next';
      const node = tree(run, reviewState), rendered = html(node);
      expect(rendered).toContain(`data-observation-id="${observation.id}"`);
      expect(rendered).toContain('固定の確認ガイド · 保存AIの回答ではありません');
      expect(rendered).toContain('品質未達：V1 / V3 / V4');
      expect(rendered).toContain('次の調査・示唆も品質未達');
      expect(find(node, item => item.props.className === 'signal-focus-investigations signal-focus-next-list')).toBeUndefined();
      const other = find(node, item => item.props.className === 'signal-focus-run-investigations')!;
      expect(html(other)).toContain('資料1：');
      expect(find(find(other, item => item.props.className === 'signal-focus-original-text'), item => item.type === 'p')!.props.children).toBe(signal.questionAnswer.nextChecks[0]);
    }
    expect(JSON.stringify({ run, reviewState })).toBe(before);
  });

  it('shows saved unbound quotes and distinct unknown dates with their V3 hold, safely as text', () => {
    const run = decodeRun(structuredClone(questionFixture));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('FIXTURE-question run expected');
    const signal = run.signal;
    signal.relationships = [];
    const source = signal.sources[0]; source.publishedAt = null; source.updatedAt = null; source.releaseAt = null; source.retrospective = false;
    source.title = 'FIXTURE-<br>保存資料';
    signal.officialFacts = [{ ...signal.officialFacts[0], id: 'kds_fixture_quote', sourceId: source.id, quote: 'FIXTURE-<script>引用</script>', text: 'FIXTURE-保存AI要約' }];
    const before = JSON.stringify(run);
    const reviewState: RunReviewState = { status: 'ready', review: { runId: run.id, schemaVersion: run.schemaVersion, promptVersion: run.versions.prompt, modelId: run.versions.model, reviewReference: 'FIXTURE-review', reviewedAt: null, failedChecks: ['V3'], ownerAcceptance: 'NOT_PERFORMED' } };
    hooks.states[1] = 'source';
    const rendered = html(tree(run, reviewState));
    expect(rendered).toContain('FIXTURE-&lt;script&gt;引用&lt;/script&gt;');
    expect(rendered).not.toContain('<script>引用</script>');
    expect(rendered).toContain('FIXTURE- 保存資料');
    expect(rendered).toContain('発表日は不明です。取得日時から発表時期を推測できません');
    expect(rendered).toContain('<dt>発売日</dt><dd>不明</dd>');
    expect(rendered).toContain('<dt>取得日時</dt>');
    expect(rendered).toContain('引用と日付条件の評価は品質未達');
    expect(rendered).toContain('照合する箇所（保存AI記述）');
    expect(rendered).toContain(signal.visualObservations[0].part);
    expect(rendered).toContain('ここに示した保存記述が指す箇所との対応が明記されていますか');
    expect(rendered).not.toContain('支持する根拠として保存');
    expect(JSON.stringify(run)).toBe(before);
  });

  it('offers explicit guide actions without writing or invoking analysis', () => {
    const onDrawing = vi.fn(), onSources = vi.fn();
    const guide = confirmationGuide({ id: 'kds_fixture_guide', part: 'FIXTURE-対象', observation: 'FIXTURE-原文', status: 'unknown', mediaIds: [] }, []);
    const node = SignalConfirmationGuide({ guide, onDrawing, onSources });
    find(node, item => item.type === 'button' && item.props.children === 'この箇所の原図を確認する')!.props.onClick();
    find(node, item => item.type === 'button' && item.props.children === '保存引用と日付を確認する')!.props.onClick();
    expect(onDrawing).toHaveBeenCalledOnce(); expect(onSources).toHaveBeenCalledOnce();
    expect(html(node)).toContain('比較A/Bの参照図面が揃っていません');
    expect(html(node)).toContain('FIXTURE-原文');
  });
});
