import { Children, cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComparisonMedia, Signal, SignalV2 } from './contract';
import { evidenceId } from './labels';
import { selectSignalEvidence, SignalEvidenceDetails } from './SignalEvidenceDetails';
import { fictionalRunV2 } from './fixtures';
import { SignalResult } from './SignalResult';

// 架空の保存結果だけで参照対応と表示を検証する。実AIの品質評価ではない。
function fictionalSignal(): SignalV2 {
  const media: ComparisonMedia = {
    id: 'FIXTURE-MEDIA-A', recordId: 'FIXTURE-RECORD-A', label: '架空の円形部・図面A', role: 'comparisonA',
    mimeType: 'image/png', width: 320, height: 240, sourceLabel: '自作の架空図面', permission: '回帰検証用',
    gazetteDate: null, applicationDate: null, view: '正面', comparisonStatus: 'scale_unknown',
  };
  const quote = '円形の操作部を採用。';
  const prefix = '架空の説明：';
  const start = Array.from(prefix).length;
  const source: SignalV2['sources'][number] = {
    id: 'FIXTURE-SOURCE-RELATED', url: 'https://fixture.example.test/news/shape', title: '架空の形状のお知らせ',
    publishedAt: null, updatedAt: '2026-07-03', releaseAt: '2026-08-01', retrievedAt: '2026-07-04T00:00:00Z',
    excerpt: prefix + quote, excerptStart: 0, contentHash: '0'.repeat(64), retrospective: false,
    extractionVersion: 'kds_fixture_extractor', bodyHash: '0'.repeat(64), extractedChars: start + Array.from(quote).length,
    modelVisibleChars: start + Array.from(quote).length, truncated: false,
  };
  return {
    status: 'insufficient', counts: { before: 1, after: 2, newlyObserved: 1, excludedBefore: 0, excludedAfter: 0, comparable: true },
    coverage: { before: '架空範囲A', after: '架空範囲B' }, limitations: ['同一製品かは不明です。'],
    designFacts: [{ id: 'FIXTURE-DESIGN-FACT', text: '架空の物品名は操作器です。', recordIds: ['FIXTURE-RECORD-B'], field: 'articleName' }],
    visualObservations: [
      { id: 'FIXTURE-OBSERVATION-LOCAL', part: '外周の局所形状', observation: '外周の短い線を確認。内側の円は判別できません。', status: 'unknown', mediaIds: ['FIXTURE-MEDIA-A', 'FIXTURE-MEDIA-B'] },
      { id: 'FIXTURE-OBSERVATION-OTHER', part: '無関係な部位', observation: '別の観察本文です。', status: 'no_change', mediaIds: ['FIXTURE-MEDIA-A', 'FIXTURE-MEDIA-B'] },
    ],
    officialFacts: [
      { id: 'FIXTURE-OFFICIAL-RELATED', text: '架空公式資料は円形部を記載しています。', sourceId: source.id, quote, start, end: start + Array.from(quote).length },
      { id: 'FIXTURE-OFFICIAL-OTHER', text: '架空公式資料の反証記載です。', sourceId: 'FIXTURE-SOURCE-OTHER', quote: 'これは別の器具です。', start: 0, end: Array.from('これは別の器具です。').length },
    ],
    hypotheses: [], questionsForHuman: ['内側の円がわかる拡大図を確認してください。'],
    media: [media, { ...media, id: 'FIXTURE-MEDIA-B', recordId: 'FIXTURE-RECORD-B', role: 'comparisonB', label: '架空の円形部・図面B' }],
    sources: [source, { ...source, id: 'FIXTURE-SOURCE-OTHER', title: '架空の別の資料', url: 'https://fixture.example.test/news/other', excerpt: 'これは別の器具です。' }],
    toolEvents: [], stopReason: '架空の検証を終了。', recordFacts: [],
    discovery: { state: 'not_started', scannedLinks: 0, eligibleCandidates: 0, omittedCandidates: 0, limitations: [], candidates: [] },
    relationships: [{ id: 'FIXTURE-RELATION', relation: 'candidate', summary: '架空の検討候補です。', supportingEvidenceIds: ['FIXTURE-OBSERVATION-LOCAL', 'FIXTURE-OFFICIAL-RELATED'], opposingEvidenceIds: ['FIXTURE-OFFICIAL-OTHER'], missingEvidence: ['商品型番と意匠の対応資料。'] }],
  };
}

const hooks = vi.hoisted(() => ({ active: false, index: 0, refIndex: 0, values: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[] }));
const synchronousFlush = vi.hoisted(() => vi.fn((callback: () => void) => callback()));
vi.mock('react-dom', async (importOriginal) => ({ ...await importOriginal<typeof import('react-dom')>(), flushSync: synchronousFlush }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useState: ((initial: unknown) => {
    if (!hooks.active) return actual.useState(initial);
    const index = hooks.index++;
    if (index >= hooks.values.length) hooks.values[index] = typeof initial === 'function' ? initial() : initial;
    return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === 'function' ? next(hooks.values[index]) : next; }];
  }) as typeof actual.useState,
  useRef: ((initial: unknown) => {
    if (!hooks.active) return actual.useRef(initial);
    return hooks.refs[hooks.refIndex++] ??= { current: initial };
  }) as typeof actual.useRef,
  useEffect: (effect: () => void | (() => void), dependencies?: readonly unknown[]) => {
    if (!hooks.active) return actual.useEffect(effect, dependencies);
    hooks.effects.push(effect);
  } };
});

type ViewProps = { children?: ReactNode; src?: string; onError?: () => void; onToggle?: (event: { currentTarget: { open: boolean } }) => void };
function expand(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement<ViewProps>(child)) return child;
    if (typeof child.type === 'function') return expand((child.type as (props: ViewProps) => ReactNode)(child.props));
    return cloneElement(child, undefined, expand(child.props.children));
  });
}
function view(signal: SignalV2, ids: string[], factsOnly = false): ReactNode {
  hooks.index = 0; hooks.refIndex = 0; hooks.effects = []; hooks.active = true;
  try { return expand(createElement(SignalEvidenceDetails, { signal, ids, factsOnly })); }
  finally { hooks.active = false; }
}
function find(node: ReactNode, match: (element: ReactElement<ViewProps>) => boolean): ReactElement<ViewProps> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<ViewProps>(child)) continue;
    if (match(child)) return child;
    const nested = find(child.props.children, match);
    if (nested) return nested;
  }
}
const html = (signal: Signal, ids: string[], factsOnly = false) => renderToStaticMarkup(createElement(SignalEvidenceDetails, { signal, ids, factsOnly }));

beforeEach(() => { hooks.active = false; hooks.index = 0; hooks.refIndex = 0; hooks.values = []; hooks.refs = []; hooks.effects = []; synchronousFlush.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('inline evidence from saved fictional results', () => {
  it('selects exact IDs in saved reference order, deduplicates and leaves partial matches unknown', () => {
    const signal = fictionalSignal();
    const before = JSON.stringify(signal);
    const selected = selectSignalEvidence(signal, ['FIXTURE-OFFICIAL-RELATED', 'FIXTURE-OBSERVATION-LOCAL', 'FIXTURE-OFFICIAL-RELATED', 'FIXTURE-OBSERVATION']);
    expect(selected.map((entry) => [entry.kind, entry.id])).toEqual([
      ['official', 'FIXTURE-OFFICIAL-RELATED'], ['observation', 'FIXTURE-OBSERVATION-LOCAL'], ['unknown', 'FIXTURE-OBSERVATION'],
    ]);
    expect(JSON.stringify(signal)).toBe(before);
  });

  it('renders local observation and its own quote without including unrelated observations or quotes', () => {
    const signal = fictionalSignal();
    const before = JSON.stringify(signal);
    const output = html(signal, ['FIXTURE-OBSERVATION-LOCAL', 'FIXTURE-OFFICIAL-RELATED', 'FIXTURE-DESIGN-FACT']);
    for (const text of ['外周の局所形状', '外周の短い線を確認。内側の円は判別できません。', '判断不能', '図面からのAI観察候補', '公式資料に記載された事実', '意匠データの書誌事項', '<blockquote>円形の操作部を採用。</blockquote>']) expect(output).toContain(text);
    expect(output).not.toContain('別の観察本文');
    expect(output).not.toContain('これは別の器具');
    expect(output).not.toContain('<img');
    expect(output).not.toContain('id="signal-evidence-');
    expect(output).toContain(`href="#${evidenceId('FIXTURE-OFFICIAL-RELATED')}"`);
    expect(JSON.stringify(signal)).toBe(before);
  });

  it('keeps supporting and opposing reference selections separate', () => {
    const signal = fictionalSignal();
    const relation = signal.relationships[0];
    const support = html(signal, relation.supportingEvidenceIds);
    const opposition = html(signal, relation.opposingEvidenceIds);
    expect(support).toContain('円形の操作部を採用。');
    expect(support).not.toContain('これは別の器具');
    expect(opposition).toContain('これは別の器具です。');
    expect(opposition).not.toContain('外周の短い線');
    expect(opposition).not.toContain('円形の操作部を採用。');
  });

  it('uses observation media IDs without adding another side from the available media list', () => {
    const signal = fictionalSignal();
    signal.visualObservations[0].mediaIds = ['FIXTURE-MEDIA-B'];
    const output = html(signal, ['FIXTURE-OBSERVATION-LOCAL']);
    expect(output).toContain('比較B · 架空の円形部・図面B');
    expect(output).not.toContain('比較A · 架空の円形部・図面A');
    expect(output).toContain('商品の新旧世代や発売順を示しません');
    expect(output).toContain('観察位置の座標は保存されていません');
  });

  it('retains unknown announcement date beside distinct update and release dates and saved quote offsets', () => {
    const signal = fictionalSignal();
    const fact = signal.officialFacts[0];
    const output = html(signal, [fact.id]);
    expect(output).toContain('発表日：不明');
    expect(output).toContain('更新日：2026-07-03 · 発売日：2026-08-01');
    expect(output).toContain(`保存された引用位置：${fact.start}〜${fact.end}`);
    expect(output).toContain('架空の形状のお知らせ');
    expect(output).toContain('同じ製品を指すこと');
    expect(signal.sources[0].publishedAt).toBeNull();
  });

  it('highlights the exact codepoint range in a legacy excerpt with emoji and a nonzero excerpt start', () => {
    const signal: Signal = fictionalSignal();
    const original = signal.sources[0];
    const prefix = '🧭前の文脈。';
    const quote = '枠は円形です。';
    const suffix = '🧪後の説明では機能を示していません。';
    signal.sources = [{ id: original.id, url: original.url, title: original.title, publishedAt: null,
      retrievedAt: original.retrievedAt, excerpt: prefix + quote + suffix, excerptStart: 120,
      contentHash: original.contentHash, retrospective: false }];
    const fact = signal.officialFacts[0];
    fact.quote = quote; fact.start = 120 + Array.from(prefix).length; fact.end = fact.start + Array.from(quote).length;
    const before = JSON.stringify(signal);
    const output = html(signal, [fact.id]);
    expect(output).toContain(`<blockquote>${prefix}<mark>${quote}</mark>${suffix}</blockquote>`);
    expect(output).toContain(`表示範囲：120〜${120 + Array.from(prefix + quote + suffix).length}`);
    expect(output).toContain('公開日：不明');
    expect(JSON.stringify(signal)).toBe(before);
  });

  it('uses each saved fact range when multiple facts share one source without adding duplicate targets', () => {
    const signal = fictionalSignal();
    const source = signal.sources[0];
    const first = signal.officialFacts[0];
    const separator = '🧩別の記載。';
    const secondQuote = '下部に四角い枠を描きました。';
    source.excerpt += separator + secondQuote;
    source.extractedChars = source.modelVisibleChars = Array.from(source.excerpt).length;
    const secondStart = Array.from(source.excerpt).length - Array.from(secondQuote).length;
    signal.officialFacts.push({ id: 'FIXTURE-OFFICIAL-SAME-SOURCE', sourceId: source.id,
      text: '架空の記載は下部の枠を説明します。', quote: secondQuote, start: secondStart,
      end: secondStart + Array.from(secondQuote).length });
    const before = JSON.stringify(signal);
    const output = html(signal, [first.id, 'FIXTURE-OFFICIAL-SAME-SOURCE']);
    expect(output).toContain(`<mark>${first.quote}</mark>`);
    expect(output).toContain(`<mark>${secondQuote}</mark>`);
    expect(output.match(/<mark>/g)).toHaveLength(2);
    expect(output).not.toContain('これは別の器具');
    expect(output).not.toContain('id="signal-evidence-');
    expect(JSON.stringify(signal)).toBe(before);
  });

  it('bounds surrounding context without moving the saved quote range to another matching phrase', () => {
    const signal = fictionalSignal();
    const source = signal.sources[0];
    const fact = signal.officialFacts[0];
    source.excerpt = fact.quote + '前'.repeat(200) + fact.quote + '後'.repeat(200);
    fact.start = Array.from(fact.quote).length + 200; fact.end = fact.start + Array.from(fact.quote).length;
    source.extractedChars = source.modelVisibleChars = Array.from(source.excerpt).length;
    const output = html(signal, [fact.id]);
    expect(output).toContain(`<blockquote>…${'前'.repeat(80)}<mark>${fact.quote}</mark>${'後'.repeat(80)}…</blockquote>`);
    expect(output).toContain(`表示範囲：${fact.start - 80}〜${fact.end + 80}`);
  });

  it('marks saved context beyond the model-visible excerpt as not presented to the AI', () => {
    const signal = fictionalSignal();
    const source = signal.sources[0];
    const fact = signal.officialFacts[0];
    const after = '追加の保存抜粋は別の枠についての説明です。';
    source.excerpt += after;
    source.extractedChars = Array.from(source.excerpt).length;
    source.truncated = true;
    const output = html(signal, [fact.id]);
    expect(output).toContain(`<mark>${fact.quote}</mark>${after}`);
    expect(output).toContain(`当時AIに提示した範囲は保存抜粋の先頭${source.modelVisibleChars}文字`);
    expect(output).toContain('当時AIに提示されなかった範囲を含みます');
    expect(output).toContain('発表日：不明');
    expect(output).toContain('更新日：2026-07-03 · 発売日：2026-08-01');
  });

  it.each(['negative', 'fractional', 'outside', 'mismatched'] as const)('does not infer context from an invalid %s quote range', (cause) => {
    const signal = fictionalSignal();
    const fact = signal.officialFacts[0];
    if (cause === 'negative') fact.start = -1;
    if (cause === 'fractional') fact.start += 0.5;
    if (cause === 'outside') fact.end = Array.from(signal.sources[0].excerpt).length + 1;
    if (cause === 'mismatched') fact.quote = '保存抜粋にない説明。';
    const before = JSON.stringify(signal);
    const output = html(signal, [fact.id]);
    expect(output).toContain('保存抜粋と引用位置の一致を確認できません');
    expect(output).not.toContain('<mark>');
    expect(JSON.stringify(signal)).toBe(before);
  });

  it('identifies direct media/source references as materials with unconfirmed claim correspondence', () => {
    const output = html(fictionalSignal(), ['FIXTURE-MEDIA-B', 'FIXTURE-SOURCE-RELATED']);
    expect(output).toContain('図面資料のみの参照');
    expect(output).toContain('公式資料のみの参照');
    expect(output).toContain('この主張への対応は未確認');
    expect(output).not.toContain('<blockquote');
    expect(output).not.toContain('円形の操作部を採用。');
    expect(output).not.toContain('href="https:');
  });

  it('states missing IDs, missing source and missing observation media explicitly without repairing the result', () => {
    const signal = fictionalSignal();
    signal.officialFacts[0].sourceId = 'FIXTURE-MISSING-SOURCE';
    signal.visualObservations[0].mediaIds = ['FIXTURE-MISSING-MEDIA'];
    const before = JSON.stringify(signal);
    const output = html(signal, ['FIXTURE-MISSING-EVIDENCE', 'FIXTURE-OFFICIAL-RELATED', 'FIXTURE-OBSERVATION-LOCAL']);
    expect(output).toContain('根拠の参照不明');
    expect(output).toContain('出典は保存結果から確認できません');
    expect(output).toContain('対応図面を保存結果から確認できません。形状は不明');
    expect(JSON.stringify(signal)).toBe(before);
    expect(html(signal, [])).toContain('この主張の根拠は登録されていません');
  });

  it('suppresses images, observation text and official body/quotes in facts-only mode even with stored references', () => {
    const signal = fictionalSignal();
    const output = html(signal, ['FIXTURE-OBSERVATION-LOCAL', 'FIXTURE-OFFICIAL-RELATED', 'FIXTURE-MEDIA-B', 'FIXTURE-DESIGN-FACT'], true);
    expect(output).not.toContain('<img');
    expect(output).not.toContain('<blockquote');
    expect(output).not.toContain('外周の短い線');
    expect(output).not.toContain('架空公式資料は円形部');
    expect(output).not.toContain('円形の操作部を採用');
    expect(output).not.toContain('<mark>');
    expect(output).not.toContain('同じ出典の保存抜粋と前後の文脈');
    expect(output).toContain('架空の物品名は操作器です');
    expect(output).toContain('本文・引用の分析は未実施');
    expect(output).toContain('発表日：不明');
  });

  it('mounts same-origin images only while details are open and keeps failed image unknown on close/reopen', () => {
    const signal = fictionalSignal();
    const before = JSON.stringify(signal);
    const ids = ['FIXTURE-OBSERVATION-LOCAL'];
    let tree = view(signal, ids);
    expect(find(tree, (element) => element.type === 'img')).toBeUndefined();
    find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: true } });
    tree = view(signal, ids);
    const imageA = find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A');
    expect(imageA).toBeDefined();
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-B')).toBeDefined();
    imageA!.props.onError!();
    tree = view(signal, ids);
    expect(renderToStaticMarkup(tree)).toContain('形状は不明のまま');
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A')).toBeUndefined();
    find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: false } });
    tree = view(signal, ids);
    expect(find(tree, (element) => element.type === 'img')).toBeUndefined();
    find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: true } });
    tree = view(signal, ids);
    expect(renderToStaticMarkup(tree)).toContain('変化なしと判定したりはしません');
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A')).toBeUndefined();
    expect(JSON.stringify(signal)).toBe(before);
  });

  it('keeps facts-only mode image-free after toggling and marks details for the existing print workflow', () => {
    const signal = fictionalSignal();
    const ids = ['FIXTURE-OBSERVATION-LOCAL', 'FIXTURE-MEDIA-B'];
    let tree = view(signal, ids, true);
    find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: true } });
    tree = view(signal, ids, true);
    expect(find(tree, (element) => element.type === 'img')).toBeUndefined();
    expect(renderToStaticMarkup(tree)).toContain('data-print-evidence="true"');
  });

  it.each([false, true])('mounts print images synchronously before a toggle and restores the previous open state (%s)', (alreadyOpen) => {
    const fixtureWindow = new EventTarget();
    vi.stubGlobal('window', fixtureWindow);
    const signal = fictionalSignal();
    const ids = ['FIXTURE-OBSERVATION-LOCAL'];
    let tree = view(signal, ids);
    const cleanup = hooks.effects[0]();
    if (alreadyOpen) {
      find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: true } });
      tree = view(signal, ids);
      expect(find(tree, (element) => element.type === 'img')).toBeDefined();
    }
    fixtureWindow.dispatchEvent(new Event('beforeprint'));
    expect(synchronousFlush).toHaveBeenCalledTimes(1);
    // beforeprint直後、toggleの通知前に画像が描画対象となっている。
    tree = view(signal, ids);
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A')).toBeDefined();
    find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: true } });
    fixtureWindow.dispatchEvent(new Event('afterprint'));
    expect(synchronousFlush).toHaveBeenCalledTimes(2);
    tree = view(signal, ids);
    expect(Boolean(find(tree, (element) => element.type === 'img'))).toBe(alreadyOpen);
    if (typeof cleanup === 'function') cleanup();
    fixtureWindow.dispatchEvent(new Event('beforeprint'));
    expect(synchronousFlush).toHaveBeenCalledTimes(2);
  });

  it('keeps failed images unknown during print and never retries them automatically', () => {
    const fixtureWindow = new EventTarget();
    vi.stubGlobal('window', fixtureWindow);
    const signal = fictionalSignal();
    const ids = ['FIXTURE-OBSERVATION-LOCAL'];
    let tree = view(signal, ids);
    const cleanup = hooks.effects[0]();
    find(tree, (element) => element.type === 'details')!.props.onToggle!({ currentTarget: { open: true } });
    tree = view(signal, ids);
    find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A')!.props.onError!();
    fixtureWindow.dispatchEvent(new Event('beforeprint'));
    tree = view(signal, ids);
    expect(renderToStaticMarkup(tree)).toContain('形状は不明のまま');
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A')).toBeUndefined();
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-B')).toBeDefined();
    fixtureWindow.dispatchEvent(new Event('afterprint'));
    tree = view(signal, ids);
    expect(find(tree, (element) => element.type === 'img' && element.props.src === '/api/v1/media/FIXTURE-MEDIA-A')).toBeUndefined();
    if (typeof cleanup === 'function') cleanup();
  });

  it('preserves facts-only image and quote suppression through beforeprint/afterprint', () => {
    const fixtureWindow = new EventTarget();
    vi.stubGlobal('window', fixtureWindow);
    const signal = fictionalSignal();
    const ids = ['FIXTURE-OBSERVATION-LOCAL', 'FIXTURE-OFFICIAL-RELATED'];
    view(signal, ids, true);
    const cleanup = hooks.effects[0]();
    fixtureWindow.dispatchEvent(new Event('beforeprint'));
    let tree = view(signal, ids, true);
    expect(find(tree, (element) => element.type === 'img')).toBeUndefined();
    expect(renderToStaticMarkup(tree)).not.toContain('<blockquote');
    fixtureWindow.dispatchEvent(new Event('afterprint'));
    tree = view(signal, ids, true);
    expect(find(tree, (element) => element.type === 'img')).toBeUndefined();
    if (typeof cleanup === 'function') cleanup();
  });

  it('wires each hypothesis/support/opposition to its own evidence in actual SignalResult without duplicate IDs', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal = fictionalSignal();
    run.signal.hypotheses = [{ id: 'FIXTURE-HYPOTHESIS-BOOK', text: '架空の書誌事項を使う検討材料。', evidenceIds: ['FIXTURE-DESIGN-FACT'], limitations: [] }];
    run.input.context.knownProducts = [];
    const saved = JSON.stringify(run);
    const output = renderToStaticMarkup(createElement(SignalResult, { run }));
    const allInline = [...output.matchAll(/<details class="signal-details signal-evidence-detail"[^>]*>([\s\S]*?)<\/details>/g)].map((match) => match[1]);
    expect(allInline).toHaveLength(5);
    const overviewObservation = allInline.find((item) => item.includes('この観察と図面をここで確かめる'));
    const overviewOfficial = allInline.find((item) => item.includes('この記載の引用・出典をここで確かめる'));
    expect(overviewObservation).toContain('外周の短い線');
    expect(overviewObservation).not.toContain('円形の操作部を採用');
    expect(overviewOfficial).toContain('円形の操作部を採用');
    expect(overviewOfficial).not.toContain('外周の短い線');
    const inline = allInline.filter((item) => !item.includes('この観察と図面をここで確かめる') && !item.includes('この記載の引用・出典をここで確かめる'));
    expect(inline).toHaveLength(3);
    expect(inline[0]).toContain('架空の物品名は操作器です');
    expect(inline[0]).not.toContain('円形の操作部を採用');
    expect(inline[1]).toContain('支持する根拠をここで確認');
    expect(inline[1]).toContain('外周の短い線');
    expect(inline[1]).toContain('円形の操作部を採用');
    expect(inline[1]).not.toContain('これは別の器具');
    expect(inline[2]).toContain('反証の根拠をここで確認');
    expect(inline[2]).toContain('これは別の器具です');
    expect(inline[2]).not.toContain('外周の短い線');
    const domIds = [...output.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(domIds).size).toBe(domIds.length);
    expect(JSON.stringify(run)).toBe(saved);
    // 防御的なprops伝搬の検証。実際のfacts-only契約では観察・公式事実を保存しない。
    run.versions.model = 'facts-only-deterministic';
    const factsOnlyOutput = renderToStaticMarkup(createElement(SignalResult, { run }));
    const factsOnlyInline = [...factsOnlyOutput.matchAll(/<details class="signal-details signal-evidence-detail"[^>]*>([\s\S]*?)<\/details>/g)].map((match) => match[1]);
    expect(factsOnlyInline).toHaveLength(3);
    for (const item of factsOnlyInline) {
      expect(item).not.toContain('<img'); expect(item).not.toContain('<blockquote');
      expect(item).not.toContain('外周の短い線'); expect(item).not.toContain('円形の操作部を採用');
    }
  });
});
