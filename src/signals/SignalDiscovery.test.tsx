import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalDiscovery } from './SignalDiscovery';
import { fictionalRunV2 } from './fixtures';
import { loadEditorialComparison, type EditorialComparison } from './editorial-comparison';
import type { RunV2 } from './contract';

const hooks = vi.hoisted(() => ({ active: false, index: 0, refIndex: 0, states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[] }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState: (initial: unknown) => {
      if (!hooks.active) return actual.useState(initial);
      const index = hooks.index++;
      if (!(index in hooks.states)) hooks.states[index] = initial;
      return [hooks.states[index], (next: unknown) => { hooks.states[index] = typeof next === 'function' ? next(hooks.states[index]) : next; }];
    },
    useRef: (initial: unknown) => hooks.active ? hooks.refs[hooks.refIndex++] ??= { current: initial } : actual.useRef(initial),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (hooks.active) hooks.effects.push(effect); else actual.useEffect(effect, deps); },
  };
});
vi.mock('./editorial-comparison', async (original) => ({ ...await original<typeof import('./editorial-comparison')>(), loadEditorialComparison: vi.fn() }));

const comparison: EditorialComparison = {
  version: 3, companyName: 'FIXTURE-Company', title: 'FIXTURE-寸法の違い', products: [{ label: 'FIXTURE-Alpha' }, { label: 'FIXTURE-Beta' }],
  differences: [{ label: '寸法', values: ['10 mm', '12 mm'], sourceIds: ['kds_fixture_source'] }], condition: 'FIXTURE-同条件', whyItMatters: 'FIXTURE-設置条件を確認', nextQuestion: 'FIXTURE-設置できるか',
  announcement: { publishedAt: '2024-02-29', releaseWindow: 'FIXTURE-春', sourceId: 'kds_fixture_source' }, manufacturerClaim: { text: 'FIXTURE-説明', sourceId: 'kds_fixture_source' }, limitations: ['FIXTURE-資料範囲'],
  sources: [{ id: 'kds_fixture_source', label: 'FIXTURE-仕様', url: 'https://example.test/fixture', notes: 'FIXTURE-記録' }],
  discovery: { productKind: 'FIXTURE-商品分野', selectionReason: 'FIXTURE-同条件の寸法を比較するため', comparisonBasis: 'same_capture_products', previousCaptureAt: null },
  verification: { checkedAt: '2024-03-01T01:03:00Z', quotes: [{ id: 'kds_fixture_quote', sourceId: 'kds_fixture_source', label: 'FIXTURE-仕様原文', text: 'FIXTURE-寸法', retrievedAt: '2024-03-01T01:02:00Z' }], differenceQuoteIds: [[['kds_fixture_quote'], ['kds_fixture_quote']]], conditionQuoteIds: ['kds_fixture_quote'], announcementQuoteIds: ['kds_fixture_quote'], manufacturerClaimQuoteIds: ['kds_fixture_quote'] },
};
function tree(run: RunV2 = fictionalRunV2) {
  hooks.index = 0; hooks.refIndex = 0; hooks.effects = []; hooks.active = true;
  try { return SignalDiscovery({ run }); } finally { hooks.active = false; }
}
type Control = ReactElement<{ children?: ReactNode; id?: string; onClick: () => void; onChange: (event: { target: { value: string } }) => void }>;
function find(node: ReactNode, match: (child: Control) => boolean): Control | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<Control['props']>(child)) continue;
    if (match(child)) return child;
    const found = find(child.props.children, match); if (found) return found;
  }
}
const button = (node: ReactNode, id: string) => find(node, (child) => child.props.id === id)!;
const back = (node: ReactNode) => find(node, (child) => child.type === 'button' && child.props.children === '← 注目候補の一覧へ戻る')!;
const html = (node: ReactNode) => renderToStaticMarkup(node);
beforeEach(() => { hooks.states = []; hooks.refs = []; hooks.effects = []; vi.mocked(loadEditorialComparison).mockReset(); });

describe('discovery selection over saved evidence', () => {
  it('shows reasons and the collection counts without mounting comparison or AI results', () => {
    hooks.states[0] = { status: 'ready', comparison };
    const rendered = html(tree());
    expect(rendered).toContain('見る理由'); expect(rendered).toContain('10 mm');
    expect(rendered).toContain('前回監視との差は未判定');
    expect(rendered).not.toContain('id="signal-result"'); expect(rendered).not.toContain('<table');
    expect(rendered).toContain('signal-discovery-open-gazette');
  });

  it('does not invent a shared capture for older editorial formats', () => {
    const legacy = { ...comparison, version: 1 as const, discovery: undefined, verification: undefined };
    hooks.states[0] = { status: 'ready', comparison: legacy };
    const rendered = html(tree());
    expect(rendered).toContain('取得回の対応は未記録');
    expect(rendered).not.toContain('同じ取得回の製品間比較');
  });

  it('loads once, selects one comparison, restores focus and reselects without another GET', async () => {
    const before = JSON.stringify(fictionalRunV2);
    vi.mocked(loadEditorialComparison).mockResolvedValue(comparison);
    tree(); hooks.effects[0]();
    await vi.waitFor(() => expect(hooks.states[0]).toEqual({ status: 'ready', comparison }));
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() }, querySelector = vi.fn(() => target);
    hooks.refs[0].current = { querySelector };
    const initial = tree(); hooks.effects[1](); expect(querySelector).not.toHaveBeenCalled();
    button(initial, 'signal-discovery-open-product').props.onClick();
    const selected = tree(); hooks.effects[1]();
    expect(querySelector).toHaveBeenLastCalledWith('#signal-discovery-detail');
    expect(html(selected)).toContain('<table'); expect(html(selected)).not.toContain('id="signal-result"');
    back(selected).props.onClick(); const returned = tree(); hooks.effects[1]();
    expect(querySelector).toHaveBeenLastCalledWith('#signal-discovery-open-product');
    button(returned, 'signal-discovery-open-product').props.onClick(); tree();
    expect(loadEditorialComparison).toHaveBeenCalledOnce(); expect(JSON.stringify(fictionalRunV2)).toBe(before);
  });

  it('changes field while detailed and restores an available list heading', () => {
    hooks.states[0] = { status: 'ready', comparison };
    button(tree(), 'signal-discovery-open-product').props.onClick();
    find(tree(), (child) => child.type === 'select')!.props.onChange({ target: { value: 'gazette' } });
    const rendered = html(tree());
    expect(rendered).not.toContain('<table'); expect(rendered).not.toContain('signal-discovery-open-product');
    expect(rendered).toContain('signal-discovery-open-gazette'); expect(hooks.refs[1].current).toBe('#signal-discovery-list-title');
  });

  it('keeps gazette evidence available on product failure and retries only on demand', async () => {
    vi.mocked(loadEditorialComparison).mockRejectedValueOnce(new Error('FIXTURE-error')).mockResolvedValueOnce(comparison);
    tree(); hooks.effects[0](); await vi.waitFor(() => expect(hooks.states[0]).toEqual({ status: 'error' }));
    const failed = tree(); expect(html(failed)).toContain('signal-discovery-open-gazette');
    find(failed, (child) => child.props.children === '商品資料を読み直す')!.props.onClick();
    tree(); hooks.effects[0](); await vi.waitFor(() => expect(hooks.states[0]).toEqual({ status: 'ready', comparison }));
    expect(loadEditorialComparison).toHaveBeenCalledTimes(2);
  });

  it('ignores a request that resolves after unmount', async () => {
    let resolve!: (value: EditorialComparison) => void;
    vi.mocked(loadEditorialComparison).mockReturnValue(new Promise((complete) => { resolve = complete; }));
    tree(); const stop = hooks.effects[0](); await Promise.resolve(); if (typeof stop === 'function') stop();
    resolve(comparison); await Promise.resolve(); expect(hooks.states[0]).toEqual({ status: 'loading' });
  });

  it('skips the discarded StrictMode setup before starting a request', async () => {
    vi.mocked(loadEditorialComparison).mockResolvedValue(comparison);
    tree(); const setup = hooks.effects[0]; const cleanup = setup();
    if (typeof cleanup === 'function') cleanup();
    setup(); expect(loadEditorialComparison).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(hooks.states[0]).toEqual({ status: 'ready', comparison }));
    expect(loadEditorialComparison).toHaveBeenCalledOnce();
  });

  it('opens only the selected newly observed record and never fills a missing gazette date', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.counts.comparable = true; run.signal!.counts.newlyObserved = 1;
    run.signal!.recordFacts = [{ ...run.signal!.recordFacts[0], selectionReason: 'newly_observed', gazetteDate: null }];
    hooks.states[0] = { status: 'ready', comparison };
    const initial = tree(run); expect(html(initial)).toContain('この分類の収録追加');
    button(initial, 'signal-discovery-open-record-0').props.onClick();
    const rendered = html(tree(run)); expect(rendered).toContain('選んだ一件');
    expect(rendered).not.toContain('id="signal-result"'); expect(rendered).not.toContain('<table');
    expect(rendered).toContain('出願日 / 公報日'); expect(rendered).toContain('不明');
    expect(run.signal!.recordFacts[0].gazetteDate).toBeNull();
  });

  it('does not promote record selection flags into changes when the scope cannot be compared', () => {
    const run = structuredClone(fictionalRunV2); run.signal!.counts.comparable = false;
    run.signal!.recordFacts[0].selectionReason = 'newly_observed';
    const rendered = html(tree(run)); expect(rendered).not.toContain('signal-discovery-open-record-0');
    expect(rendered).toContain('収録条件が異なり');
  });

  it('keeps an empty or failed saved run accessible without claiming no change', () => {
    const run = { ...structuredClone(fictionalRunV2), signal: null };
    const initial = tree(run); expect(html(initial)).toContain('保存結果の状態を確かめる');
    button(initial, 'signal-discovery-open-gazette').props.onClick();
    expect(html(tree(run))).toContain('id="signal-result"');
  });
});
