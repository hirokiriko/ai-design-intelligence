import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalEditorialEntry } from './SignalEditorialEntry';
import { loadEditorialComparison, type EditorialComparison } from './editorial-comparison';

const hooks = vi.hoisted(() => ({ state: undefined as unknown, refs: [] as { current: unknown }[], index: 0, effects: [] as (() => void | (() => void))[] }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return { ...actual,
    useState: (initial: unknown) => [hooks.state ??= initial, (value: unknown) => { hooks.state = value; }],
    useRef: (initial: unknown) => hooks.refs[hooks.index++] ??= { current: initial },
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
  };
});
vi.mock('./editorial-comparison', async (original) => ({ ...await original<typeof import('./editorial-comparison')>(), loadEditorialComparison: vi.fn() }));

const comparison: EditorialComparison = {
  version: 1, companyName: 'FIXTURE-Company', title: '架空の寸法比較',
  products: [{ label: 'FIXTURE-Alpha' }, { label: 'FIXTURE-Beta' }],
  differences: [{ label: '寸法', values: ['10 mm', '12 mm'], sourceIds: ['kds_fixture_source'] }],
  condition: '架空の仕様条件', whyItMatters: '寸法を設置条件と比べる', nextQuestion: '設置条件に合うか',
  announcement: { publishedAt: '2024-02-29', releaseWindow: '春予定', sourceId: 'kds_fixture_source' },
  manufacturerClaim: { text: '架空の説明', sourceId: 'kds_fixture_source' }, limitations: ['架空の資料'],
  sources: [{ id: 'kds_fixture_source', label: '架空の仕様', url: 'https://example.test/fixture', notes: '架空の記録' }],
};
function tree(autoLoad = true) {
  hooks.index = 0; hooks.effects = [];
  return SignalEditorialEntry({ companyName: comparison.companyName, autoLoad, summaryOnly: true });
}
function button(node: ReactNode): ReactElement<{ onClick: () => void }> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; onClick: () => void }>(child)) continue;
    if (child.type === 'button') return child;
    const found = button(child.props.children); if (found) return found;
  }
}
beforeEach(() => { hooks.state = undefined; hooks.refs = []; hooks.effects = []; vi.mocked(loadEditorialComparison).mockReset(); });
afterEach(() => { (hooks.refs[0]?.current as AbortController | null)?.abort(); });

describe('local summary entry lifecycle', () => {
  it('autoloads once without moving focus or scrolling and preserves the supplied summary', async () => {
    const before = structuredClone(comparison);
    vi.mocked(loadEditorialComparison).mockResolvedValue(comparison);
    tree(); const start = hooks.effects[1]; start(); start();
    await Promise.resolve();
    expect(loadEditorialComparison).toHaveBeenCalledTimes(1);
    expect(loadEditorialComparison).toHaveBeenCalledWith(comparison.companyName, fetch, expect.any(AbortSignal));
    await vi.waitFor(() => expect(hooks.state).toEqual({ status: 'ready', comparison }));
    const target = { focus: vi.fn(), scrollIntoView: vi.fn() }, querySelector = vi.fn(() => target);
    hooks.refs[1].current = { querySelector };
    tree(); hooks.effects[0]();
    expect(querySelector).not.toHaveBeenCalled(); expect(target.focus).not.toHaveBeenCalled();
    expect(target.scrollIntoView).not.toHaveBeenCalled(); expect(comparison).toEqual(before);
  });

  it('does not fetch before explicit opening in the existing non-automatic entry', () => {
    tree(false); hooks.effects[1]();
    expect(loadEditorialComparison).not.toHaveBeenCalled();
  });

  it('aborts an unmounted request and allows a fresh effect setup without accepting the stale response', async () => {
    let resolveOld!: (value: EditorialComparison) => void;
    vi.mocked(loadEditorialComparison).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(comparison);
    tree(); const start = hooks.effects[1]; const cleanup = start();
    await Promise.resolve();
    const firstSignal = vi.mocked(loadEditorialComparison).mock.calls[0][2]!;
    if (typeof cleanup !== 'function') throw new Error('Missing cleanup');
    cleanup(); expect(firstSignal.aborted).toBe(true); start();
    await vi.waitFor(() => expect(hooks.state).toEqual({ status: 'ready', comparison }));
    resolveOld({ ...comparison, title: 'FIXTURE-stale' }); await Promise.resolve();
    expect(hooks.state).toEqual({ status: 'ready', comparison });
    expect(loadEditorialComparison).toHaveBeenCalledTimes(2);
  });

  it('stays failed without an automatic retry, then recovers through the visible retry action', async () => {
    vi.mocked(loadEditorialComparison).mockRejectedValueOnce(new Error('FIXTURE-read-error')).mockResolvedValueOnce(comparison);
    tree(); hooks.effects[1]();
    await vi.waitFor(() => expect(hooks.state).toEqual({ status: 'error' }));
    const failed = tree(); hooks.effects[1]();
    expect(loadEditorialComparison).toHaveBeenCalledTimes(1);
    const retry = button(failed); expect(retry).toBeDefined(); retry!.props.onClick();
    await vi.waitFor(() => expect(hooks.state).toEqual({ status: 'ready', comparison }));
    expect(loadEditorialComparison).toHaveBeenCalledTimes(2);
  });
});
