import { describe, expect, it } from 'vitest';
import { investigationsForSelection, observationReferences, savedObservationExcerpt } from './focus-display';

const observations = Object.freeze([
  Object.freeze({ id: 'kds_fixture_edge', part: 'FIXTURE-外周' }),
  Object.freeze({ id: 'kds_fixture_edge.inner', part: 'FIXTURE-内側' }),
  Object.freeze({ id: 'kds_fixture_edge:lower', part: 'FIXTURE-下端' }),
]);

describe('saved observation excerpts', () => {
  it('preserves both descriptions and qualifications without inventing a comparison', () => {
    const text = 'A：FIXTURE-外周の一部は不明（破線）。B：FIXTURE-外周の一部は不明（実線）。描画上の比較：不明。物理変更は確定しません。';
    expect(savedObservationExcerpt(text)).toEqual({ kind: 'pair', a: { text: 'FIXTURE-外周の一部は不明（破線）', truncated: false }, b: { text: 'FIXTURE-外周の一部は不明（実線）', truncated: false } });
  });

  it('keeps an unrecognized or one-sided format as a literal excerpt', () => {
    for (const text of ['FIXTURE-Aのみ確認。Bは未取得。', 'A：FIXTURE-外側。B：FIXTURE-内側。追加条件は不明。']) {
      expect(savedObservationExcerpt(text)).toEqual({ kind: 'text', excerpt: { text, truncated: false } });
    }
  });

  it('marks shortened Unicode excerpts and retains a separate B description', () => {
    const text = `A：FIXTURE-${'🔎'.repeat(100)}。B：FIXTURE-Bは判別不能。`;
    const value = savedObservationExcerpt(text);
    expect(value.kind).toBe('pair');
    if (value.kind !== 'pair') throw new Error('FIXTURE-pair expected');
    expect(value.a.truncated).toBe(true);
    expect(Array.from(value.a.text)).toHaveLength(90);
    expect(value.a.text).not.toMatch(/[\uD800-\uDBFF]$/u);
    expect(value.b).toEqual({ text: 'FIXTURE-Bは判別不能', truncated: false });
  });
});

describe('known observation references', () => {
  it('matches the longest exact IDs and Japanese suffixes without prefix aliases', () => {
    const value = observationReferences('kds_fixture_edge.innerとkds_fixture_edge:lowerを照合し、kds_fixture_edgeの原図へ戻る。', observations);
    expect(value.filter(item => item.kind === 'observation').map(item => item.id)).toEqual(['kds_fixture_edge.inner', 'kds_fixture_edge:lower', 'kds_fixture_edge']);
    expect(value.filter(item => item.kind === 'observation').map(item => item.label)).toEqual(['着目点 2：FIXTURE-内側', '着目点 3：FIXTURE-下端', '着目点 1：FIXTURE-外周']);
  });

  it('does not resolve unknown IDs, substring collisions or regex-like ID prefixes', () => {
    const text = 'kds_fixture_edgeX kds_fixture_edge.inner.more kds_fixture_edge:lower-extra kds_fixture_edgeXinner kds_fixture_unknown';
    expect(observationReferences(text, observations)).toEqual([{ kind: 'text', text }]);
  });

  it('preserves every original character outside known references', () => {
    const text = '「kds_fixture_edge」、(kds_fixture_edge.inner)とkds_fixture_edge。';
    const segments = observationReferences(text, observations);
    expect(segments.map(item => item.kind === 'text' ? item.text : item.id).join('')).toBe(text);
    expect(observationReferences(text, [])).toEqual([{ kind: 'text', text }]);
  });

  it('requires explicit separators around Unicode IDs instead of guessing prose boundaries', () => {
    const unicode = [{ id: 'FIXTURE-観察-1', part: 'FIXTURE-輪郭' }];
    const text = '対象：FIXTURE-観察-1。別FIXTURE-観察-1やFIXTURE-観察-1の延長は未対応。';
    const segments = observationReferences(text, unicode);
    expect(segments.filter(item => item.kind === 'observation').map(item => item.id)).toEqual(['FIXTURE-観察-1']);
    expect(segments.map(item => item.kind === 'text' ? item.text : item.id).join('')).toBe(text);
    const checks = investigationsForSelection(['対象：別FIXTURE-観察-1。FIXTURE-原図を確認'], unicode, unicode[0].id);
    expect(checks.selected).toEqual([]);
    expect(checks.other).toHaveLength(1);
  });

  it('shows multi-reference checks for either selection but keeps unbound checks at run scope', () => {
    const texts = Object.freeze(['kds_fixture_edgeとkds_fixture_edge.innerのFIXTURE-資料を確認', 'kds_fixture_edge:lowerのFIXTURE-末端を確認', 'FIXTURE-実行全体の資料を確認', 'kds_fixture_unknownのFIXTURE-資料を確認']);
    const before = JSON.stringify({ texts, observations });
    const first = investigationsForSelection(texts, observations, observations[0].id);
    const second = investigationsForSelection(texts, observations, observations[1].id);
    const lower = investigationsForSelection(texts, observations, observations[2].id);
    expect(first.selected.map(item => item.index)).toEqual([0]);
    expect(second.selected.map(item => item.index)).toEqual([0]);
    expect(lower.selected.map(item => item.index)).toEqual([1]);
    expect(lower.other.map(item => item.index)).toEqual([0, 2, 3]);
    expect(investigationsForSelection(texts, observations, 'kds_fixture_absent').selected).toEqual([]);
    expect(JSON.stringify({ texts, observations })).toBe(before);
  });
});
