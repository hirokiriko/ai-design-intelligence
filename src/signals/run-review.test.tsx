import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signalApi } from './api';
import { ContractError } from './contract';
import { fictionalRunV2 } from './fixtures';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';
import { SignalRunReview } from './SignalRunReview';
import { decodeRunReview, runReviewKey, type PublicRunReview } from './run-review';

const run = { ...structuredClone(fictionalRunV2), id: 'kds_fixture_review_run' };
function review(): PublicRunReview {
  return { runId: run.id, schemaVersion: run.schemaVersion, promptVersion: run.versions.prompt, modelId: run.versions.model,
    reviewReference: 'FIXTURE-review-record', reviewedAt: null, failedChecks: ['V2', 'V4'], ownerAcceptance: 'NOT_PERFORMED' };
}
function envelope(value: unknown = review()) { return { schemaVersion: '1.0.0', runId: run.id, review: value }; }
afterEach(() => vi.unstubAllGlobals());

describe('saved run review binding', () => {
  it('preserves the saved run, absent timestamp and separate unrecorded review', () => {
    const original = JSON.stringify(run);
    expect(decodeRunReview(envelope(), run)).toEqual(review());
    expect(decodeRunReview(envelope(null), run)).toBeNull();
    expect(JSON.stringify(run)).toBe(original);
    const timed = { ...review(), reviewedAt: '2026-02-28T12:34:56.123456Z' };
    expect(decodeRunReview(envelope(timed), run)).toEqual(timed);
  });
  it.each(['runId', 'schemaVersion', 'promptVersion', 'modelId'] as const)('rejects a different saved subject %s', (field) => {
    expect(() => decodeRunReview(envelope({ ...review(), [field]: 'kds_fixture_other' }), run)).toThrow(ContractError);
  });
  it.each([
    { ...review(), failedChecks: ['V2', 'V2'] }, { ...review(), failedChecks: ['V6'] },
    { ...review(), failedChecks: 'V2' }, { ...review(), ownerAcceptance: 'UNKNOWN' },
    { ...review(), reviewedAt: '2026-02-30T12:00:00Z' }, { ...review(), reviewedAt: '2026-10-10' },
    { ...review(), reviewedAt: '2026-10-10T12:00:00+00:00' }, { ...review(), reviewedAt: '2026-10-10T24:00:00Z' },
    { ...review(), reviewedAt: '2026-10-10T12:00:00.1234567Z' }, { ...review(), reviewReference: 'https://fixture.example.test/review' },
    { ...review(), extra: 'kds_fixture_extra' }, { ...review(), modelId: undefined },
  ])('rejects invalid or unexpected metadata %#', (value) => {
    expect(() => decodeRunReview(envelope(value), run)).toThrow(ContractError);
  });
  it('validates the envelope even when the review is null', () => {
    expect(() => decodeRunReview({ ...envelope(null), runId: 'kds_fixture_other' }, run)).toThrow(ContractError);
    expect(() => decodeRunReview({ ...envelope(null), schemaVersion: '2.0.0' }, run)).toThrow(ContractError);
    expect(() => decodeRunReview({ ...envelope(null), extra: true }, run)).toThrow(ContractError);
  });
});

describe('read-only review API', () => {
  it('uses exactly one GET without starting analysis or touching pending storage', async () => {
    const storage = { getItem: vi.fn(() => { throw new Error('Unexpected pending read'); }), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    const fetcher = vi.fn().mockResolvedValue(Response.json(envelope())); vi.stubGlobal('fetch', fetcher);
    expect(await signalApi.review(run)).toEqual(review());
    expect(fetcher).toHaveBeenCalledOnce();
    const [path, options] = fetcher.mock.calls[0];
    expect(path).toBe(`/api/v1/runs/${run.id}/review`);
    expect(options.method).toBeUndefined(); expect(options.body).toBeUndefined();
    expect(options.headers).toEqual({ Accept: 'application/json' }); expect(options.credentials).toBe('same-origin');
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(storage.removeItem).not.toHaveBeenCalled();
  });
  it('does not retry an older backend or interpret its 404 as a quality failure', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })); vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.review(run)).rejects.toMatchObject({ code: '404' }); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('snapshots the requested subject before waiting for the response', async () => {
    const selected = structuredClone(run);
    let finish!: (response: Response) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; })); vi.stubGlobal('fetch', fetcher);
    const pending = signalApi.review(selected);
    selected.id = 'kds_fixture_changed_while_waiting'; selected.versions.prompt = 'FIXTURE-changed-prompt';
    finish(Response.json(envelope())); expect(await pending).toEqual(review());
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v1/runs/${run.id}/review`);
  });
});

describe('quality review display', () => {
  it('shows known failures and missing owner acceptance in the ordinary result and the matching history entry', () => {
    const original = JSON.stringify(run);
    const state = { status: 'ready' as const, review: review() };
    const html = renderToStaticMarkup(createElement(SignalResult, { run, focusOnLoad: false, reviewState: state }));
    expect(html).toContain('品質未達：V2 FAIL / V4 FAIL'); expect(html).toContain('本人受入：未実施');
    expect(html).toContain('レビュー日時：未記録'); expect(html).toContain('実行時の問い：未記録');
    expect(html).toContain('処理の終了は、V1〜V5の合格や本人受入を示しません');
    const other = { ...run, id: 'kds_fixture_review_other' };
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run, other], state: 'ready', disabled: false, onSelect: () => undefined,
      reviews: { [runReviewKey(run)]: state, [runReviewKey(other)]: state } }));
    expect(history.match(/V2 FAIL/g)).toHaveLength(1); expect(history.match(/本人受入：未実施/g)).toHaveLength(1);
    expect(history).toContain('品質レビュー：確認できません'); expect(JSON.stringify(run)).toBe(original);
  });
  it('keeps empty, absent and unreadable review distinct without inferring PASS from an old schema', () => {
    const render = (state?: Parameters<typeof SignalRunReview>[0]['state']) => renderToStaticMarkup(createElement(SignalRunReview, { run, state }));
    expect(render({ status: 'ready', review: { ...review(), failedChecks: [], ownerAcceptance: 'ACCEPTED' } })).toContain('登録された未達指摘なし');
    expect(render({ status: 'ready', review: null })).toContain('品質レビュー：未記録');
    expect(render({ status: 'unavailable' })).toContain('保存結果は引き続き閲覧できます');
    expect(render()).toContain('品質レビュー：未確認');
    for (const html of [render(), render({ status: 'ready', review: null }), render({ status: 'ready', review: { ...review(), failedChecks: [] } })]) {
      expect(html).not.toContain('FAIL'); expect(html).not.toContain('PASS');
    }
  });
});
