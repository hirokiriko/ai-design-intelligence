import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AnalysisRequest, AnalysisResult } from '../domain/types';
import {
  LocalJpoJsonDataSource,
  convertLocalJpoRecord,
  loadLocalJpoJson,
  sanitizeAnalysisEvidenceIds,
  summarizeLocalJpoRecords,
  validateLocalJpoJson,
} from './LocalJpoJsonDataSource';

const fixture = {
  recordCount: 3,
  records: [
    {
      id: 'local-001',
      sourceDataset: 'fixture-daily',
      applicationNumber: '2025-000001',
      applicationDate: '2025-05-10',
      registrationNumber: 'D1700001',
      registrationDate: '2026-05-20',
      sourceUpdateDate: '2026-06-24',
      gazetteDate: '2026-06-01',
      designClass: 'N3-10',
      articleName: '設備管理用操作画面',
      designDescription: '遠隔監視のダッシュボードUI',
      articleDescription: '設備状態を表示する画像意匠',
      applicants: [{ name: '株式会社サンプル' }],
      applicantsDisplay: '株式会社サンプル',
      rightHolders: ['株式会社サンプル'],
      priorityClaims: ['JP-PRIORITY-1'],
      agents: ['弁理士A'],
      sourceFiles: ['fixture-a.json'],
    },
    {
      id: 'local-002',
      sourceDataset: 'fixture-daily',
      applicationNumber: '2024-000002',
      registrationNumber: 'D1600002',
      sourceUpdateDate: '2026-06-03',
      gazetteDate: '2024-05-01',
      designClass: 'C1-20',
      articleName: '収納ケース',
      designDescription: '小型で持ち運びやすいケース',
      applicants: ['株式会社旧データ'],
      sourceFiles: ['fixture-b.json'],
    },
    {
      id: 'local-003',
      sourceDataset: 'fixture-daily',
      applicationNumber: '2025-000003',
      registrationNumber: 'D1700003',
      sourceUpdateDate: '2026-06-10',
      gazetteDate: '2025-07-01',
      designClass: 'L3-1',
      articleName: '店舗内装',
      articleDescription: '案内サインを含む店舗空間',
      unresolvedApplicants: ['12345'],
      rightHolders: ['株式会社空間サンプル'],
      sourceFiles: ['fixture-c.json'],
    },
  ],
};

const baseRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  period: 'last_1y',
  designKinds: ['article', 'image', 'interior'],
  purposes: ['market_trend'],
  departments: ['product_planning'],
  includeUnresolvedApplicants: true,
};

describe('LocalJpoJsonDataSource', () => {
  it('loads integrated JSON and converts it to app DesignRecord objects', () => {
    const loaded = loadLocalJpoJson(fixture, 'fixture.json');

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.summary.totalRecords).toBe(3);
    expect(loaded.summary.fileName).toBe('fixture.json');
    expect(loaded.summary.topParties[0].label).toBe('株式会社サンプル');
  });

  it('validates records array, recordCount, required fields, and evidence id list', () => {
    const validation = validateLocalJpoJson({
      recordCount: 3,
      records: [{ id: 'missing-fields' }, { gazetteDate: '2026-01-01' }],
    });

    expect(validation.errors).toHaveLength(0);
    expect(validation.recordIds).toEqual(['missing-fields']);
    expect(validation.warnings.some((warning) => warning.includes('recordCount'))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes('gazetteDate'))).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes('idがありません'))).toBe(true);
  });

  it('maps JPO fields while preserving local-only details', () => {
    const record = convertLocalJpoRecord(fixture.records[0]);

    expect(record?.id).toBe('local-001');
    expect(record?.applicantsDisplay).toBe('株式会社サンプル');
    expect(record?.designKind).toBe('image');
    expect(record?.designKindInferred).toBe(true);
    expect(record?.sourceUpdateDate).toBe('2026-06-24');
    expect(record?.sourceFiles).toEqual(['fixture-a.json']);
    expect(record?.isSample).toBe(false);
  });

  it('filters by gazetteDate period, company, product terms, and unresolved applicant setting', async () => {
    const source = new LocalJpoJsonDataSource(fixture, 'fixture.json');
    const lastYear = await source.query(baseRequest);

    expect(lastYear.map((record) => record.id)).toEqual(['local-001', 'local-003']);

    const companyRecords = await source.query({
      ...baseRequest,
      scope: { mode: 'companies', companies: ['株式会社サンプル'] },
      productDomain: '操作画面',
    });
    expect(companyRecords.map((record) => record.id)).toEqual(['local-001']);

    const withoutUnresolved = await source.query({ ...baseRequest, includeUnresolvedApplicants: false });
    expect(withoutUnresolved.map((record) => record.id)).toEqual(['local-001']);
  });

  it('creates applicant and designClass rankings and unresolved counts', () => {
    const source = new LocalJpoJsonDataSource(fixture, 'fixture.json');
    const summary = summarizeLocalJpoRecords(source.getAllRecords(), 'fixture.json');

    expect(summary.topDesignClasses.some((item) => item.label === 'N3-10')).toBe(true);
    expect(summary.topParties.some((item) => item.label === '株式会社空間サンプル')).toBe(true);
    expect(summary.unresolvedApplicantsCount).toBe(1);
    expect(summary.priorityClaims.withClaims).toBe(1);
    expect(summary.agents.withAgents).toBe(1);
  });

  it('recognizes monthly preview filenames and sourceUpdateDate range separately from gazetteDate', () => {
    const source = new LocalJpoJsonDataSource(fixture, 'monthly-preview-fixture-202606.json');
    const summary = summarizeLocalJpoRecords(source.getAllRecords(), source.getFileName());

    expect(summary.dataPeriodKind).toBe('monthly_preview');
    expect(summary.dataPeriodDate).toBe('2026-06');
    expect(summary.sourceUpdateDateFrom).toBe('2026-06-03');
    expect(summary.sourceUpdateDateTo).toBe('2026-06-24');
    expect(summary.gazetteDateFrom).toBe('2024-05-01');
    expect(summary.gazetteDateTo).toBe('2026-06-01');
  });

  it('uses monthly preview metadata when the JSON declares its period', () => {
    const loaded = loadLocalJpoJson(
      {
        ...fixture,
        dataPeriodKind: 'monthly_preview',
        dataDate: '2026-06',
        includedWeeklyDates: ['2026-06-03', '2026-06-24'],
      },
      'fixture.json',
    );

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.summary.dataPeriodKind).toBe('monthly_preview');
    expect(loaded.summary.dataPeriodDate).toBe('2026-06');
    expect(loaded.summary.sourceUpdateDateFrom).toBe('2026-06-03');
    expect(loaded.summary.sourceUpdateDateTo).toBe('2026-06-24');
  });

  it('loads and summarizes gazetteDrawingKeys while dropping unsafe image paths and URLs', () => {
    const loaded = loadLocalJpoJson(
      {
        recordCount: 2,
        records: [
          {
            ...fixture.records[0],
            gazetteDrawingKeys: {
              source: 'registered_design_gazette',
              issueDate: '2026-06-23',
              issueNumber: '2026-114',
              matchedBy: 'registrationAndApplication',
              gazetteDateFromXml: '2026-06-23',
              gazetteDateMismatch: true,
              publicationDocumentId: 'SAMPLE-PUBLICATION-LOCAL-001',
              hasDrawingRefs: true,
              drawingRefCount: 2,
              sourceXmlFile: 'sample-publication-meta-local-001.xml',
              drawingRefs: [
                {
                  label: '画像図',
                  fileName: 'C:\\private\\images\\sample-drawing-local-001.jpg',
                  fileType: 'jpg',
                  order: 1,
                  isRepresentativeCandidate: false,
                  sourceXmlFile: 'sample-publication-meta-local-001.xml',
                },
                {
                  label: '危険な参照',
                  fileName: 'https://example.test/sample-drawing-local-002.jpg',
                  fileType: 'jpg',
                  order: 2,
                  sourceXmlFile: 'C:\\private\\sample-publication-meta-local-001.xml',
                },
              ],
            },
          },
          fixture.records[1],
        ],
      },
      'fixture-with-gazette-keys.json',
    );

    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const records = loaded.dataSource.getAllRecords();
    const recordWithKeys = records.find((record) => record.id === 'local-001');
    const recordWithoutKeys = records.find((record) => record.id === 'local-002');

    expect(recordWithKeys?.gazetteDrawingKeys?.issueNumber).toBe('2026-114');
    expect(recordWithKeys?.gazetteDrawingKeys?.drawingRefs?.[0]?.fileName).toBe('sample-drawing-local-001.jpg');
    expect(recordWithKeys?.gazetteDrawingKeys?.drawingRefs?.[1]?.fileName).toBeNull();
    expect(recordWithKeys?.gazetteDrawingKeys?.drawingRefs?.[1]?.sourceXmlFile).toBeNull();
    expect(recordWithoutKeys?.gazetteDrawingKeys).toBeNull();
    expect(loaded.summary.gazetteDrawingKeysCount).toBe(1);
    expect(loaded.summary.drawingRefsRecordCount).toBe(1);
    expect(loaded.summary.drawingRefTotalCount).toBe(2);
    expect(loaded.summary.gazetteDateMismatchCount).toBe(1);
    expect(JSON.stringify(recordWithKeys)).not.toMatch(new RegExp('https?://', 'i'));
    expect(JSON.stringify(recordWithKeys)).not.toMatch(new RegExp('[A-Za-z]:\\\\'));
  });

  it('removes evidenceIds that do not exist in loaded records', () => {
    const source = new LocalJpoJsonDataSource(fixture, 'fixture.json');
    const result: AnalysisResult = {
      request: baseRequest,
      dataAsOf: source.getDataAsOf(),
      companies: [],
      market: {
        trends: {
          title: 'fixture',
          text: 'fixture',
          metric: { label: 'fixture', value: 1 },
          confidence: 'low',
          evidenceIds: ['local-001', 'missing-id'],
        },
        emergingDomains: {
          title: 'fixture',
          text: 'fixture',
          metric: { label: 'fixture', value: 1 },
          confidence: 'low',
          evidenceIds: ['local-003'],
        },
        companyMoves: {
          title: 'fixture',
          text: 'fixture',
          metric: { label: 'fixture', value: 1 },
          confidence: 'low',
          evidenceIds: [],
        },
      },
      generatedBy: 'rules',
      disclaimer: 'fixture',
    };

    const warnings = sanitizeAnalysisEvidenceIds(result, source.getAllRecords());

    expect(warnings).toHaveLength(1);
    expect(result.market?.trends.evidenceIds).toEqual(['local-001']);
  });
});

describe('check:no-real-data', () => {
  it('detects real-data-like filenames in controlled directories', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'no-real-data-'));
    const dataDir = path.join(tempRoot, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'design-records-fixture.json'), '{}');

    const scriptPath = path.resolve(process.cwd(), 'scripts', 'check-no-real-data.mjs');

    expect(() => execFileSync(process.execPath, [scriptPath, '--root', tempRoot], { stdio: 'pipe' })).toThrow();
  });

  it('detects real-data-like content in public-build targets', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'no-real-data-content-'));
    const dataDir = path.join(tempRoot, 'src', 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'sample.json'), JSON.stringify({ sourceFile: `${['JP', 'DAD'].join('')}_fixture.xml` }));

    const scriptPath = path.resolve(process.cwd(), 'scripts', 'check-no-real-data.mjs');

    expect(() => execFileSync(process.execPath, [scriptPath, '--root', tempRoot], { stdio: 'pipe' })).toThrow();
  });
});
