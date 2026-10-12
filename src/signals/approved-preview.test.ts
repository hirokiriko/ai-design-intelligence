import { describe, expect, it, vi } from 'vitest';
import { ContractError, type RunV23 } from './contract';
import { fictionalRunV22 } from './fixtures-v22';
import { ApprovedPreviewError, decodeApprovedPreview, loadApprovedPreview, type ApprovedPreview } from './approved-preview';

// 既存の架空fixtureのみ。実資料、実URL、実run IDはテストへ搬入しない。
function fixturePreview(): ApprovedPreview {
  const prior = structuredClone(fictionalRunV22);
  const run: RunV23 = { ...prior, schemaVersion: '2.3.0',
    input: { ...prior.input, context: { ...prior.input.context, dataMode: 'approved_public' } },
    versions: { ...prior.versions, schema: '2.3.0' } };
  if (!run.signal || !run.input.comparisonPair) throw new Error('Fictional comparison evidence is required');
  for (const source of run.signal.sources) {
    source.publishedAt = null; source.updatedAt = '2026-09-18'; source.releaseAt = '2026-09-17';
  }
  for (const item of [...run.signal.media, ...run.input.comparisonPair.media]) {
    item.gazetteDate = null; item.applicationDate = null;
  }
  return { version: 1, run, quality: { v2: 'FAIL', v4: 'FAIL', humanAcceptance: 'NOT_PERFORMED' },
    observations: [{ id: 'observation-a', text: '架空図面の内側と外側を別々に観察する検証です。', mediaIds: run.signal.media.map(({ id }) => id) }],
    media: run.input.comparisonPair.media.map((item, index) => ({ id: item.id, file: index === 0 ? 'a.jpg' : 'b.jpg',
      sha256: String(index + 1).repeat(64), width: item.width, height: item.height })) as ApprovedPreview['media'],
    provenance: { savedRunSha256: '3'.repeat(64), qualityReviewSha256: '4'.repeat(64) } };
}

describe('read-only approved saved-result preview boundary', () => {
  it('keeps the original DTO, usage, unknown dates and failed quality without rewriting', () => {
    const input = fixturePreview();
    const before = structuredClone(input);
    const loaded = decodeApprovedPreview(input);
    expect(loaded).toEqual(before);
    expect(loaded.run).toBe(input.run);
    expect(loaded.run.signal?.sources.every((source) => source.publishedAt === null && source.updatedAt !== null && source.releaseAt !== null)).toBe(true);
    expect(loaded.run.signal?.media.every((media) => media.gazetteDate === null && media.applicationDate === null)).toBe(true);
    expect(loaded.quality).toEqual({ v2: 'FAIL', v4: 'FAIL', humanAcceptance: 'NOT_PERFORMED' });
    expect(input).toEqual(before);
  });

  it('validates quote offsets as Unicode codepoints rather than UTF-16 indices', () => {
    const input = fixturePreview();
    const fact = input.run.signal!.officialFacts[0];
    const source = input.run.signal!.sources.find((item) => item.id === fact.sourceId)!;
    source.excerpt = `😀${fact.quote}検証用末尾`;
    source.extractedChars = source.modelVisibleChars = Array.from(source.excerpt).length;
    source.truncated = false;
    fact.start = 1; fact.end = 1 + Array.from(fact.quote).length;
    expect(decodeApprovedPreview(input).run.signal!.officialFacts[0].quote).toBe(fact.quote);
    fact.start = 2; fact.end += 1;
    expect(() => decodeApprovedPreview(input)).toThrow(ContractError);
  });

  it.each(['quote', 'source', 'offset', 'visible-range'])('rejects a mismatched %s instead of repairing its saved claim', (mutation) => {
    const input = fixturePreview();
    const fact = input.run.signal!.officialFacts[0];
    if (mutation === 'quote') fact.quote = '架空の本文に存在しない引用';
    if (mutation === 'source') fact.sourceId = 'kds_fixture_missing_source';
    if (mutation === 'offset') fact.start += 1;
    if (mutation === 'visible-range') fact.end += 1;
    expect(() => decodeApprovedPreview(input)).toThrow(ContractError);
  });

  it.each(['mode', 'version', 'running', 'empty-signal', 'no-pair'])('rejects a %s result outside the saved approved comparison scope', (mutation) => {
    const input = fixturePreview();
    if (mutation === 'mode') input.run.input.context.dataMode = 'fictional';
    if (mutation === 'version') { Object.assign(input.run, { schemaVersion: '2.2.0' }); input.run.versions.schema = '2.2.0'; }
    if (mutation === 'running') { input.run.status = 'running'; input.run.completedAt = null; }
    if (mutation === 'empty-signal') { input.run.status = 'failed'; input.run.signal = null; }
    if (mutation === 'no-pair') input.run.input.comparisonPair = null;
    expect(() => decodeApprovedPreview(input)).toThrow(ApprovedPreviewError);
  });

  it.each(['v2', 'v4', 'humanAcceptance'])('rejects a changed %s evaluation', (field) => {
    const input = fixturePreview();
    Object.assign(input.quality, { [field]: field === 'humanAcceptance' ? 'PERFORMED' : 'PASS' });
    expect(() => decodeApprovedPreview(input)).toThrow(ApprovedPreviewError);
  });

  it.each(['missing', 'duplicate', 'other-id', 'file', 'width', 'height', 'hash'])('rejects %s image metadata', (mutation) => {
    const input = fixturePreview();
    if (mutation === 'missing') input.media.pop();
    if (mutation === 'duplicate') input.media[1] = structuredClone(input.media[0]);
    if (mutation === 'other-id') input.media[0].id = 'kds_fixture_other_media';
    if (mutation === 'file') Object.assign(input.media[0], { file: '../a.jpg' });
    if (mutation === 'width') input.media[0].width += 1;
    if (mutation === 'height') input.media[0].height = 1.5;
    if (mutation === 'hash') input.media[0].sha256 = 'invalid';
    expect(() => decodeApprovedPreview(input)).toThrow(ApprovedPreviewError);
  });

  it.each(['unbound-media', 'duplicate-id', 'duplicate-media', 'empty-text', 'extra-field'])('rejects %s manual observations', (mutation) => {
    const input = fixturePreview();
    if (mutation === 'unbound-media') input.observations[0].mediaIds = ['kds_fixture_other_media'];
    if (mutation === 'duplicate-id') input.observations.push(structuredClone(input.observations[0]));
    if (mutation === 'duplicate-media') input.observations[0].mediaIds[1] = input.observations[0].mediaIds[0];
    if (mutation === 'empty-text') input.observations[0].text = ' ';
    if (mutation === 'extra-field') Object.assign(input.observations[0], { hypothesis: '架空の未記録推測' });
    expect(() => decodeApprovedPreview(input)).toThrow(ApprovedPreviewError);
  });

  it.each(['savedRunSha256', 'qualityReviewSha256'])('requires a valid %s provenance digest', (field) => {
    const input = fixturePreview();
    Object.assign(input.provenance, { [field]: 'a'.repeat(63) });
    expect(() => decodeApprovedPreview(input)).toThrow(ApprovedPreviewError);
  });

  it('rejects extra preview properties without modifying the run', () => {
    const input = fixturePreview();
    expect(() => decodeApprovedPreview({ ...input, storage: 'not-permitted' })).toThrow(ApprovedPreviewError);
  });

  it('loads exactly one fixed same-origin GET without credentials, caching, retries or analysis requests', async () => {
    const input = fixturePreview();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(input), { status: 200 }));
    const controller = new AbortController();
    expect(await loadApprovedPreview(fetcher, controller.signal)).toEqual(input);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/__signals-local-preview/approved/preview.json', {
      method: 'GET', credentials: 'omit', cache: 'no-store', mode: 'same-origin', redirect: 'error', signal: controller.signal,
    });
  });

  it('does not retry a rejected load or fall back to the live API', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(loadApprovedPreview(fetcher)).rejects.toThrow(ApprovedPreviewError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps cancellation and transport failures without starting another request', async () => {
    const aborted = new DOMException('Fictional cancellation', 'AbortError');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(aborted);
    await expect(loadApprovedPreview(fetcher)).rejects.toBe(aborted);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
