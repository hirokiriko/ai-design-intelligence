import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalObservationPanel } from './SignalObservationPanel';
import { compareSavedSnapshots, loadSavedObservations, type SavedObservationBundle, type ComparisonResult } from './saved-observations';

const hooks = vi.hoisted(() => ({ active: false, index: 0, refIndex: 0, states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as (() => void | (() => void))[] }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState: (initial: unknown) => { if (!hooks.active) return actual.useState(initial); const i = hooks.index++; if (!(i in hooks.states)) hooks.states[i] = initial; return [hooks.states[i], (next: unknown) => { hooks.states[i] = typeof next === 'function' ? next(hooks.states[i]) : next; }]; },
    useRef: (initial: unknown) => hooks.active ? hooks.refs[hooks.refIndex++] ??= { current: initial } : actual.useRef(initial),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => { if (hooks.active) hooks.effects.push(effect); else actual.useEffect(effect, deps); },
  };
});
vi.mock('./saved-observations', async (original) => ({ ...await original<typeof import('./saved-observations')>(), loadSavedObservations: vi.fn(), compareSavedSnapshots: vi.fn() }));

const hash = '0'.repeat(64), candidate = { id: 'kds_fixture_candidate', title: 'FIXTURE-保存記事', url: 'https://fixture.example/article', publishedAt: null };
const article = { candidateId: candidate.id, title: candidate.title, url: candidate.url, retrievedAt: '2026-01-01T10:00:00Z', rawHash: hash, excerpt: 'FIXTURE-保存した短い引用', excerptHash: hash, body: null, bodyHash: null, bodyComplete: false, status: 'ok' as const };
const before = { id: 'kds_fixture_before', observedAt: '2026-01-01T10:00:01Z', conditionsHash: hash, conditionsVerified: 'reconstructed' as const, scopeLabel: 'FIXTURE-登録入口の選択候補', sourceUrl: 'https://fixture.example/list', extractionVersion: 'FIXTURE-extractor', complete: true, eligibleCount: 2, omittedCount: 1, candidates: [candidate], articles: [article] };
const after = { ...before, id: 'kds_fixture_after', observedAt: '2026-01-02T10:00:01Z', articles: [{ ...article, retrievedAt: '2026-01-02T10:00:00Z' }] };
const bundle: SavedObservationBundle = { version: 1, entityId: 'kds_fixture_entity', categoryId: 'FIXTURE-CATEGORY', companyName: 'FIXTURE-Company', categoryLabel: 'FIXTURE-分野', comparisons: [{ id: 'kds_fixture_pair', label: 'FIXTURE-過去の取得', before, after }] };
const result = { comparable: true, reason: null, scopeComplete: false, conditionsVerified: 'reconstructed', before, after, candidates: { added: [], removed: [], changed: [], unchanged: [candidate] }, articles: [{ candidateId: candidate.id, before: article, after: after.articles[0], bodyChange: 'unknown', excerptChange: 'unchanged', rawChange: 'changed' }] } as ComparisonResult;
function tree() { hooks.active = true; hooks.index = 0; hooks.refIndex = 0; hooks.effects = []; try { return SignalObservationPanel({ entityId: bundle.entityId, categoryId: bundle.categoryId }); } finally { hooks.active = false; } }
type Control = ReactElement<{ children?: ReactNode; id?: string; onClick: () => void }>;
function find(node: ReactNode, match: (item: Control) => boolean): Control | undefined { for (const item of Children.toArray(node)) { if (!isValidElement<Control['props']>(item)) continue; if (match(item)) return item; const found = find(item.props.children, match); if (found) return found; } }
const html = (node: ReactNode) => renderToStaticMarkup(node);
beforeEach(() => { hooks.states = []; hooks.refs = []; hooks.effects = []; vi.mocked(loadSavedObservations).mockReset(); vi.mocked(compareSavedSnapshots).mockReset(); });

describe('saved observation navigation', () => {
  it('limits a zero delta to the stored candidates and keeps omitted records and missing bodies visible', () => {
    hooks.states[0] = { status: 'ready', bundle, results: [result] };
    const view = html(tree());
    expect(view).toContain('確認した保存1候補に変化なし'); expect(view).toContain('保存対象外 1 → 1件は未比較');
    expect(view).toContain('記事全文：未判定'); expect(view).toContain('dateTime="2026-01-02T10:00:01Z"'); expect(view).toContain('公開日不明');
    expect(view).not.toContain('FIXTURE-保存した短い引用'); expect(view).not.toContain('signal-observation-detail');
  });
  it('opens one evidence pair and returns focus without fetching sources', () => {
    hooks.states[0] = { status: 'ready', bundle, results: [result] };
    find(tree(), (item) => item.props.id === `signal-observation-open-${candidate.id}`)!.props.onClick();
    const detail = tree(), view = html(detail);
    expect(view).toContain('記事全文の変化は未判定'); expect(view).toContain('全文は未保存・未確認');
    expect(view).toContain('保存引用は同じ'); expect(view).toContain('HTML全体には差'); expect(view).toContain(article.excerpt);
    expect(view).not.toContain('次に見る候補');
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() }, querySelector = vi.fn(() => target); hooks.refs[0].current = { querySelector }; hooks.effects[1]();
    expect(querySelector).toHaveBeenLastCalledWith('#signal-observation-detail');
    find(detail, (item) => item.props.children === '← 確認候補へ戻る')!.props.onClick(); tree(); hooks.effects[1]();
    expect(querySelector).toHaveBeenLastCalledWith(`#signal-observation-open-${candidate.id}`); expect(loadSavedObservations).not.toHaveBeenCalled();
  });
  it('never claims zero changes for incomparable observations', () => {
    hooks.states[0] = { status: 'ready', bundle, results: [{ ...result, comparable: false, reason: 'conditions_mismatch', articles: [] }] };
    const view = html(tree()); expect(view).toContain('この2時点は比較できません'); expect(view).not.toContain('候補に変化なし');
    expect(view).toContain('条件または抽出版が異なる'); expect(view).not.toContain('本文は未取得');
  });
  it('prioritizes a changed article body even when the candidate list metadata is unchanged', () => {
    hooks.states[0] = { status: 'ready', bundle, results: [{ ...result, articles: [{ ...result.articles[0], bodyChange: 'changed' }] }] };
    const view = html(tree()); expect(view).toContain('確認した1記事の抽出本文に差があります'); expect(view).not.toContain('候補に変化なし');
    expect(view).not.toContain('aria-hidden="true">✓');
  });
  it('loads validated observations once and cancels a discarded setup', async () => {
    vi.mocked(loadSavedObservations).mockResolvedValue(bundle); vi.mocked(compareSavedSnapshots).mockResolvedValue(result);
    tree(); const setup = hooks.effects[0], stop = setup(); if (typeof stop === 'function') stop(); setup();
    await vi.waitFor(() => expect((hooks.states[0] as { status: string }).status).toBe('ready'));
    expect(loadSavedObservations).toHaveBeenCalledOnce(); expect(compareSavedSnapshots).toHaveBeenCalledOnce();
  });
  it('shows unavailable instead of zero for an invalid or failed saved response', async () => {
    vi.mocked(loadSavedObservations).mockRejectedValue(new Error('FIXTURE-invalid'));
    tree(); hooks.effects[0](); await vi.waitFor(() => expect(hooks.states[0]).toEqual({ status: 'error' }));
    const view = html(tree()); expect(view).toContain('比較できる取得記録を読み込めません'); expect(view).not.toContain('変化なし');
  });
});
