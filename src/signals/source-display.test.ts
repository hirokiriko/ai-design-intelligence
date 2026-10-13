import { describe, expect, it } from 'vitest';
import { sourceReferenceText } from './source-display';

describe('known source references in saved investigation display', () => {
  const sources = Object.freeze([
    Object.freeze({ id: 'kds_fixture_source', title: 'FIXTURE-<br>資料 &amp; 条件' }),
    Object.freeze({ id: 'kds_fixture_source.long', title: 'FIXTURE-詳細資料' }),
    Object.freeze({ id: 'FIXTURE-資料', title: 'FIXTURE-別資料' }),
  ]);
  it('resolves exact longest IDs to saved readable titles, preserving unknown references', () => {
    const text = '対象：kds_fixture_source.long、kds_fixture_source。FIXTURE-資料。kds_fixture_unknown';
    expect(sourceReferenceText(text, sources)).toBe('対象：資料2：FIXTURE-詳細資料、資料1：FIXTURE- 資料 & 条件。資料3：FIXTURE-別資料。kds_fixture_unknown');
    expect(text).toContain('kds_fixture_source.long');
  });
  it('does not rewrite partial or prose-embedded Unicode IDs', () => {
    const text = 'kds_fixture_sourceX kds_fixture_source.long.extra kds_fixture_source-long FIXTURE-資料の追加';
    expect(sourceReferenceText(text, sources)).toBe(text);
    expect(sourceReferenceText(text, [])).toBe(text);
  });
});
