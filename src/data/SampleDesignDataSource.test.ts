import { describe, expect, it } from 'vitest';
import { ALL_DESIGN_KINDS } from '../domain/labels';
import { getPeriodStart, SampleDesignDataSource, validateDesignDataset } from './SampleDesignDataSource';
import type { AnalysisRequest } from '../domain/types';
import { normalizeLocalCompanyKey } from '../analysis/projectLegacyDesignRecord';

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
    const viewRecords = source.getViewRecords();

    expect(source.getDataAsOf()).toBe('2026-06-15');
    expect(records.length).toBeGreaterThanOrEqual(50);
    expect(records.length).toBeLessThanOrEqual(100);
    expect(records.every((record) => record.isSample)).toBe(true);
    expect(records.every((record) => record.sourceLabel === '公開デモ用サンプルデータ')).toBe(true);
    expect(records.every((record) => record.businessDomain && record.keywords.length > 0 && record.designFeatures.length > 0)).toBe(true);
    expect(new Set(records.map((record) => record.designKind))).toEqual(new Set(['article', 'image', 'interior']));
    expect(records.some((record) => record.gazetteDrawingKeys?.hasDrawingRefs)).toBe(true);
    expect(records.reduce((sum, record) => sum + (record.gazetteDrawingKeys?.drawingRefs?.length ?? 0), 0)).toBeGreaterThan(0);
    expect(viewRecords).toHaveLength(records.length);
    expect(records.every((record) => record.origin === 'sample')).toBe(true);
    expect(records.every((record) => record.companyMemberships.length === 1)).toBe(true);
    expect(records.every((record) => record.classificationMemberships.length === 1)).toBe(true);
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

  it('keeps sample dates and identifiers internally consistent', () => {
    const source = new SampleDesignDataSource();
    const records = source.getViewRecords();

    expect(validateDesignDataset({ dataAsOf: source.getDataAsOf(), records })).toEqual([]);
    expect(records.every((record) => record.gazetteDate <= source.getDataAsOf())).toBe(true);
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
  });

  it('rejects sample dates after dataAsOf', () => {
    const source = new SampleDesignDataSource();
    const template = source.getViewRecords()[0];
    const futureRecord = {
      ...template,
      id: 'SAMPLE-DESIGN-FUTURE-FIXTURE',
      registrationNumber: 'SAMPLE-REG-FUTURE-FIXTURE',
      gazetteDate: '2026-06-16',
    };

    expect(validateDesignDataset({ dataAsOf: source.getDataAsOf(), records: [futureRecord] })).toContain(
      'dataAsOfより後の公報発行日があります: SAMPLE-DESIGN-FUTURE-FIXTURE',
    );
  });

  it('calculates inclusive one-year and two-year calendar boundaries in UTC', () => {
    expect(getPeriodStart('2026-06-15', 'last_1y').toISOString().slice(0, 10)).toBe('2025-06-15');
    expect(getPeriodStart('2024-02-29', 'last_1y').toISOString().slice(0, 10)).toBe('2023-02-28');
    expect(getPeriodStart('2024-02-29', 'last_2y').toISOString().slice(0, 10)).toBe('2022-02-28');
  });

  it('makes the one-year and two-year demo periods visibly different', async () => {
    const source = new SampleDesignDataSource();
    const oneYearRecords = await source.query({ ...baseRequest, period: 'last_1y' });
    const twoYearRecords = await source.query({ ...baseRequest, period: 'last_2y' });

    expect(oneYearRecords.length).toBeGreaterThan(0);
    expect(twoYearRecords.length).toBeGreaterThan(oneYearRecords.length);
    expect(oneYearRecords.every((record) => twoYearRecords.some((candidate) => candidate.id === record.id))).toBe(true);
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
      scope: {
        mode: 'companies',
        companySelectors: [
          {
            origin: 'sample',
            role: 'applicant',
            localKey: normalizeLocalCompanyKey('デモ住設株式会社'),
            displayLabel: 'デモ住設株式会社',
          },
        ],
      },
      designKinds: ['image'],
      productDomain: '家電',
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.applicant === 'デモ住設株式会社')).toBe(true);
    expect(records.every((record) => record.designKind === 'image')).toBe(true);
    expect(records.some((record) => record.businessDomain.includes('家電'))).toBe(true);
  });

  it('does not match a legacy selector that happens to use the same local key', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query({
      ...baseRequest,
      scope: {
        mode: 'companies',
        companySelectors: [
          {
            origin: 'legacy',
            role: 'applicant',
            localKey: normalizeLocalCompanyKey('デモ住設株式会社'),
            displayLabel: 'デモ住設株式会社',
          },
        ],
      },
    });

    expect(records).toEqual([]);
  });

  it('filters an industry request by its selected focus area', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query({
      ...baseRequest,
      scope: { mode: 'industry', industry: '住宅設備' },
      productDomain: '住宅設備',
      period: 'last_2y',
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.businessDomain.includes('住宅設備'))).toBe(true);
    expect(records.every((record) => record.gazetteDate <= source.getDataAsOf())).toBe(true);
  });
});
