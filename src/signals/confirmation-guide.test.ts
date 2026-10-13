import { describe, expect, it } from 'vitest';
import { confirmationGuide, publicationCondition } from './confirmation-guide';
import { fictionalRunV2 } from './fixtures';
import { investigationsForSelection } from './focus-display';

const media = fictionalRunV2.signal!.media.map((item, index) => Object.freeze({ ...item, id: `kds_fixture_media_${index}`, recordId: `kds_fixture_record_${index}` }));
function observation(a: string, b = a) {
  return Object.freeze({ id: 'kds_fixture_observation', part: 'FIXTURE-保存された呼称', observation: `A：${a}。B：${b}。描画上の比較：不明。`, status: 'unknown' as const, mediaIds: Object.freeze(media.map(item => item.id)) });
}

describe('nonpersistent confirmation procedures', () => {
  it.each([
    ['FIXTURE-外郭（破線）', 'FIXTURE-外郭（実線）', 'outline', '区間'],
    ['FIXTURE-同心円の輪郭（破線）', 'FIXTURE-同心円の輪郭（実線）', 'concentric', '連続・断続'],
    ['FIXTURE-円形と長円形（破線）', 'FIXTURE-円形と長円形（実線）', 'separate_shapes', '一つずつ'],
    ['FIXTURE-端の実線と破線の混在', 'FIXTURE-端の実線', 'mixed_lines', '要素・区間'],
  ])('uses only the literal A/B words for %s', (a, b, kind, question) => {
    const saved = observation(a, b), before = JSON.stringify(saved);
    const guide = confirmationGuide(saved, media);
    expect(guide).toMatchObject({ origin: 'fixed-confirmation-guide', observationId: saved.id, target: saved.part, kind, literal: { kind: 'pair', a, b } });
    expect(guide.question).toContain(question);
    expect(guide.question).toMatch(/？$/u);
    for (const trigger of guide.triggers) expect(trigger.side === 'A' ? a : b).toContain(trigger.text);
    expect(guide.ifConfirmed).not.toContain('確認済みです');
    expect(JSON.stringify(saved)).toBe(before);
  });

  it('does not add an ellipse, quantity or operation when the literal only has round and elongated contours', () => {
    const guide = confirmationGuide(observation('FIXTURE-円形と長円形'), media);
    expect(guide.kind).toBe('separate_shapes');
    expect(guide.title + guide.question).not.toMatch(/楕円|\d|操作/u);
    expect(guide.triggers.map(item => item.text)).toEqual(['円形', '長円形', '円形', '長円形']);
  });

  it.each([
    ['FIXTURE-外郭ではない', 'FIXTURE-外郭'],
    ['FIXTURE-外郭ではなく内部の線', 'FIXTURE-外郭ではなく内部の線'],
    ['FIXTURE-同心円ではありません', 'FIXTURE-同心円ではありません'],
    ['FIXTURE-同心円は見えず', 'FIXTURE-同心円は見えず'],
    ['FIXTURE-外郭は確認できません', 'FIXTURE-外郭は確認できません'],
    ['FIXTURE-同心円は存在しません', 'FIXTURE-同心円は存在しません'],
    ['FIXTURE-外郭のような形', 'FIXTURE-外郭のような形'],
    ['FIXTURE-同心円が無い', 'FIXTURE-同心円が無い'],
    ['FIXTURE-同心円が認められず', 'FIXTURE-同心円が認められず'],
    ['FIXTURE-同心円は判別できず不明', 'FIXTURE-同心円'],
    ['FIXTURE-外郭かもしれない', 'FIXTURE-外郭'],
    ['FIXTURE-外郭', 'FIXTURE-別の形'],
    ['FIXTURE-長円形', 'FIXTURE-長円形'],
    ['FIXTURE-外郭と同心円', 'FIXTURE-外郭と同心円'],
    ['FIXTURE-外郭の実線と破線が混在', 'FIXTURE-外郭の実線'],
  ])('falls back for uncertain, one-sided or competing template words: %s', (a, b) => {
    expect(confirmationGuide(observation(a, b), media)).toMatchObject({ kind: 'general', triggers: [] });
  });

  it('does not classify by ID, part, status or the comparison conclusion', () => {
    const saved = { ...observation('FIXTURE-別の形'), id: 'FIXTURE-concentric', part: 'FIXTURE-同心円', status: 'no_change' as const, observation: 'A：FIXTURE-形。B：FIXTURE-形。描画上の比較：外郭と同心円。' };
    expect(confirmationGuide(saved, media).kind).toBe('general');
  });

  it('requires one exact A/B media pair before selecting a geometric procedure', () => {
    const saved = observation('FIXTURE-外郭');
    for (const refs of [[], [media[0].id], [media[0].id, media[0].id], ['kds_fixture_unknown', media[1].id]]) {
      expect(confirmationGuide({ ...saved, mediaIds: refs }, media)).toMatchObject({ kind: 'general', pairedMedia: false });
    }
    expect(confirmationGuide(saved, media.map(item => ({ ...item, role: 'comparisonA' as const })))).toMatchObject({ kind: 'general', pairedMedia: false });
  });

  it('preserves unrecognized, missing and long Unicode text in full', () => {
    for (const text of ['', 'FIXTURE-同心円。Aのみ。', 'A：FIXTURE-外郭。B：FIXTURE-外郭。別条件。', `FIXTURE-${'🔎'.repeat(200)}`]) {
      expect(confirmationGuide({ ...observation(''), observation: text }, media)).toMatchObject({ kind: 'general', literal: { kind: 'text', text } });
    }
  });

  it('does not turn a source-only saved investigation into an observation plan', () => {
    const saved = observation('FIXTURE-外郭');
    const plans = Object.freeze(['対象：kds_fixture_source。FIXTURE-保存引用を確認']);
    confirmationGuide(saved, media);
    expect(investigationsForSelection(plans, [saved], saved.id)).toMatchObject({ selected: [], other: [{ text: plans[0] }] });
  });
});

describe('publication date comparison without substituted dates', () => {
  it('keeps an absent publication date unknown', () => {
    expect(publicationCondition(null, '2026-01-01', '2026-02-01')).toContain('発表日は不明');
  });
  it.each([
    ['2026-02-30', '2026-01-01', '2026-03-01'], ['2026-02-01', '2026-02-30', '2026-03-01'],
    ['2026-02-01T00:00:00Z', '2026-01-01', '2026-03-01'], ['2026-02-01', '2026-01-01T00:00:00Z', '2026-03-01'],
    ['2026-02-01', '2026-03-01', '2026-01-01'], ['2026-02-01', '', '2026-03-01'],
  ])('does not compare invalid or unequal date precision: %s', (date, before, after) => {
    expect(publicationCondition(date, before, after)).toContain('判定できません');
  });
  it('distinguishes before, after and inclusive same-day bounds without a product claim', () => {
    expect(publicationCondition('2025-12-31', '2026-01-01', '2026-02-01')).toContain('基準日より前');
    expect(publicationCondition('2026-03-01', '2026-01-01', '2026-02-01')).toContain('基準日より後');
    for (const date of ['2026-01-01', '2026-02-01']) expect(publicationCondition(date, '2026-01-01', '2026-02-01')).toContain('対応を証明するものではありません');
    expect(publicationCondition('2024-02-29', '2024-02-29', '2024-02-29')).toContain('範囲内');
  });
});
