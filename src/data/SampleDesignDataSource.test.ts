import { describe, expect, it } from 'vitest';
import { ALL_DESIGN_KINDS } from '../domain/labels';
import { DEMO_PRESETS } from '../domain/presets';
import { getPeriodStart, SampleDesignDataSource, validateDesignDataset } from './SampleDesignDataSource';
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
    expect(records.every((record) => record.id.startsWith('SAMPLE-DESIGN-'))).toBe(true);
    expect(records.every((record) => record.registrationNumber?.startsWith('SAMPLE-REG-'))).toBe(true);
    expect(records.every((record) => record.applicationNumber?.startsWith('SAMPLE-APP-'))).toBe(true);
    expect(records.every((record) => record.gazetteNumber?.startsWith('SAMPLE-GAZETTE-'))).toBe(true);
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

  it('keeps sample dates and identifiers internally consistent', () => {
    const source = new SampleDesignDataSource();
    const records = source.getAllRecords();

    expect(validateDesignDataset({ dataAsOf: source.getDataAsOf(), records })).toEqual([]);
    expect(records.every((record) => record.gazetteDate <= source.getDataAsOf())).toBe(true);
    expect(new Set(records.map((record) => record.id)).size).toBe(records.length);
    expect(new Set(records.map((record) => record.registrationNumber)).size).toBe(records.length);
  });

  it('calculates inclusive one-year and two-year calendar boundaries', () => {
    expect(getPeriodStart('2026-06-15', 'last_1y').toISOString().slice(0, 10)).toBe('2025-06-15');
    expect(getPeriodStart('2024-02-29', 'last_1y').toISOString().slice(0, 10)).toBe('2023-02-28');
    expect(getPeriodStart('2024-02-29', 'last_2y').toISOString().slice(0, 10)).toBe('2022-02-28');
  });

  it('returns at least one record for every demo preset', async () => {
    const source = new SampleDesignDataSource();

    for (const preset of DEMO_PRESETS) {
      const records = await source.query(preset.request);
      const periodStart = getPeriodStart(source.getDataAsOf(), preset.request.period).toISOString().slice(0, 10);

      expect(records.length, preset.label).toBeGreaterThan(0);
      expect(records.every((record) => record.isSample), preset.label).toBe(true);
      expect(records.every((record) => record.gazetteDate >= periodStart), preset.label).toBe(true);
      expect(records.every((record) => record.gazetteDate <= source.getDataAsOf()), preset.label).toBe(true);
      expect(records.every((record) => preset.request.designKinds.includes(record.designKind)), preset.label).toBe(true);
    }
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
      scope: { mode: 'companies', companies: ['デモ住設株式会社'] },
      designKinds: ['image'],
      productDomain: '家電',
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.applicant === 'デモ住設株式会社')).toBe(true);
    expect(records.every((record) => record.designKind === 'image')).toBe(true);
    expect(records.some((record) => record.businessDomain.includes('家電'))).toBe(true);
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
  });
});
