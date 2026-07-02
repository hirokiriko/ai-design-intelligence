import { describe, expect, it } from 'vitest';
import { ALL_DESIGN_KINDS } from '../domain/labels';
import { SampleDesignDataSource } from './SampleDesignDataSource';
import type { AnalysisRequest } from '../domain/types';

const baseRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  period: 'last_1y',
  designKinds: [...ALL_DESIGN_KINDS],
  purposes: ['market_trend'],
  departments: ['product_planning'],
};

describe('SampleDesignDataSource', () => {
  it('contains dataAsOf and 50 to 100 public sample records only', () => {
    const source = new SampleDesignDataSource();
    const records = source.getAllRecords();

    expect(source.getDataAsOf()).toBe('2026-06-15');
    expect(records.length).toBeGreaterThanOrEqual(50);
    expect(records.length).toBeLessThanOrEqual(100);
    expect(records.every((record) => record.isSample)).toBe(true);
    expect(records.every((record) => record.sourceLabel === '公開デモ用サンプルデータ')).toBe(true);
    expect(records.every((record) => record.businessDomain && record.keywords.length > 0 && record.designFeatures.length > 0)).toBe(true);
    expect(new Set(records.map((record) => record.designKind))).toEqual(new Set(['article', 'image', 'interior']));
    expect(records.some((record) => record.gazetteDrawingKeys?.hasDrawingRefs)).toBe(true);
    expect(records.reduce((sum, record) => sum + (record.gazetteDrawingKeys?.drawingRefs?.length ?? 0), 0)).toBeGreaterThan(0);
  });

  it('does not include real company names or real-number-style identifiers in bundled samples', () => {
    const source = new SampleDesignDataSource();
    const text = JSON.stringify(source.getAllRecords());
    const forbiddenCompanies = [
      ['Pana', 'sonic'].join(''),
      ['Phil', 'ips'].join(''),
      ['J', 'VC'].join(''),
      ['Shark', 'Ninja'].join(''),
      ['Hua', 'wei'].join(''),
      ['Mi', 'dea'].join(''),
      ['So', 'ny'].join(''),
      ['Sam', 'sung'].join(''),
      'LG',
    ];

    forbiddenCompanies.forEach((company) => expect(text).not.toMatch(new RegExp(company, 'i')));
    expect(text).not.toMatch(/\b\d{7,}\b/);
    expect(text).not.toMatch(new RegExp(['JP', 'DAD|JP', 'WAD|JP', 'DRD|JP', 'WRD|JP', 'DAC|JP', 'WAC|JP', 'D_'].join('')));
    expect(text).not.toMatch(/[A-Za-z]:\\/);
    expect(text).not.toMatch(/https?:\/\//i);
    expect(text).not.toMatch(new RegExp(['base', '64'].join(''), 'i'));
  });

  it('filters last_1y from dataAsOf rather than the current date', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(baseRequest);

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => new Date(record.gazetteDate) >= new Date('2025-06-15'))).toBe(true);
    expect(records.every((record) => record.id.startsWith('SAMPLE-DESIGN-'))).toBe(true);
  });

  it('filters by company, design kind, and product domain', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query({
      ...baseRequest,
      scope: { mode: 'companies', companies: ['デモ住設株式会社'] },
      designKinds: ['image'],
      productDomain: '家電',
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.applicant === 'デモ住設株式会社')).toBe(true);
    expect(records.every((record) => record.designKind === 'image')).toBe(true);
    expect(records.some((record) => record.businessDomain.includes('家電'))).toBe(true);
  });
});
