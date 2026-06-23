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
  it('contains dataAsOf and 40 to 50 sample records', () => {
    const source = new SampleDesignDataSource();
    const records = source.getAllRecords();

    expect(source.getDataAsOf()).toBe('2026-06-15');
    expect(records.length).toBeGreaterThanOrEqual(40);
    expect(records.length).toBeLessThanOrEqual(50);
    expect(records.every((record) => record.isSample)).toBe(true);
    expect(records.every((record) => record.sourceLabel === 'デモ用意匠情報')).toBe(true);
    expect(records.every((record) => record.businessDomain && record.keywords.length > 0 && record.designFeatures.length > 0)).toBe(true);
  });

  it('filters last_1y from dataAsOf rather than the current date', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(baseRequest);

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => new Date(record.gazetteDate) >= new Date('2025-06-15'))).toBe(true);
    expect(records.some((record) => record.id === 'D-2025-019')).toBe(false);
    expect(records.some((record) => record.id === 'D-2025-020')).toBe(true);
  });

  it('filters by company, design kind, and product domain', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query({
      ...baseRequest,
      scope: { mode: 'companies', companies: ['企業A'] },
      designKinds: ['image'],
      productDomain: 'IoT',
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.applicant === '企業A')).toBe(true);
    expect(records.every((record) => record.designKind === 'image')).toBe(true);
    expect(records.some((record) => record.keywords.includes('IoT'))).toBe(true);
  });
});
