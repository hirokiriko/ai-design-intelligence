import { describe, expect, it } from 'vitest';
import { loadHosoeAnalysisPackJson } from './HosoeAnalysisPackDataSource';

const candidateMode = ['dTermWIncluded', 'Candidate'].join('');
const strictMode = ['strict', 'PrefixW'].join('');
const softBankGroup = ['Soft', 'Bank'].join('');
const targetGroups = ['Apple', 'NTT DOCOMO', 'LINE Yahoo候補', softBankGroup, 'PayPay', 'Google'];

function makeRecord(index: number, companyGroup: string, confirmed: boolean) {
  const serial = String(index + 1).padStart(3, '0');
  return {
    internalId: `FICTIONAL-RECORD-${serial}`,
    matchedCompanyGroup: companyGroup,
    applicationNumber: `SAMPLE-EXPERT-APP-${serial}`,
    applicationDate: '2025-05-01',
    internationalApplicationDate: null,
    dateUsedForFilter: '2025-05-01',
    dateUsedType: 'applicationDate',
    registrationNumber: `SAMPLE-EXPERT-REG-${serial}`,
    registrationDate: '2026-05-01',
    gazetteDate: confirmed ? '2026-06-09' : '2026-06-08',
    designClass: confirmed ? 'N310W' : 'N311W',
    designClassNormalized: confirmed ? 'N310W' : 'N311W',
    articleName: confirmed ? '架空操作用画像' : '架空情報表示画像',
    sourceUpdateDate: null,
    applicants: confirmed ? ['架空端末デザイン株式会社'] : [],
    rightHolders: confirmed ? ['架空端末ホールディングス株式会社'] : ['架空通信デザイン株式会社'],
    matchedRole: confirmed ? 'both' : 'rightHolder',
    matchedName: ['架空照合名株式会社'],
    matchedAlias: [confirmed ? '架空端末A' : '架空通信B'],
    wFilterMode: candidateMode,
    classificationNote: '分類文字列内にWを含むDタームW候補です。',
    vTermReviewStatus: confirmed ? 'confirmed' : 'sourceGazetteUnavailable',
    vTerms: confirmed ? ['VAA', 'VNA'] : [],
    vTermReviewNote: confirmed
      ? '架空公報データで確認済み。'
      : '公報データ未接続のため画像共通DタームのV系分類は未確認。値は推測していない。',
    sourceFileHint: ['hidden-source-hint.xml'],
  };
}

const fixtureRecords = [
  ...Array.from({ length: 15 }, (_, index) => makeRecord(index, targetGroups[0], true)),
  ...Array.from({ length: 5 }, (_, index) => makeRecord(index + 15, targetGroups[1], false)),
];

const fixturePack = {
  meta: {
    title: '専門家レビュー用：架空スマホ関連企業の画像意匠',
    version: 'v3-audited-fixture',
    createdAt: '2026-07-13T00:00:00.000Z',
    candidateRecordCount: 20,
    excludedRecordCount: 1,
    excludedRecords: [
      {
        id: 'FICTIONAL-EXCLUDED-001',
        reason: '架空別会社, Inc. 内の LY が LY Corporation に部分一致した誤抽出',
      },
    ],
    vTermStatus: { confirmed: 15, sourceGazetteUnavailable: 5 },
    filters: {
      dateFrom: '2020-04-01',
      dateFieldPolicy: 'applicationDate or internationalApplicationDate',
      targetCompanies: targetGroups,
    },
  },
  source: { sourceRecordCount: 21, auditedRecordCount: 20 },
  dataAvailability: {
    isComprehensiveForSince20200401: false,
    note: '架空の月次プレビューデータ。全量ではありません。',
  },
  filterDiagnostics: {
    [['strict', 'PrefixWDateAndCompanyMatchedCount'].join('')]: 0,
    [['dTermWIncluded', 'CandidateDateAndCompanyMatchedCount'].join('')]: 20,
    excludedByAuditCount: 1,
  },
  aggregations: {
    companyCounts: targetGroups.flatMap((companyGroup, index) => [
      { companyGroup, wFilterMode: strictMode, recordCount: 0 },
      { companyGroup, wFilterMode: candidateMode, recordCount: index === 0 ? 15 : index === 1 ? 5 : 0 },
    ]),
    byMatchedRole: [
      { companyGroup: targetGroups[0], wFilterMode: candidateMode, matchedRole: 'both', count: 15 },
      { companyGroup: targetGroups[1], wFilterMode: candidateMode, matchedRole: 'rightHolder', count: 5 },
    ],
    yearlyTrend: [
      { companyGroup: targetGroups[0], year: '2025', count: 15 },
      { companyGroup: targetGroups[1], year: '2025', count: 5 },
    ],
    byDesignClass: [
      { companyGroup: targetGroups[0], designClass: 'N310W', count: 15 },
      { companyGroup: targetGroups[1], designClass: 'N311W', count: 5 },
    ],
    byArticleName: [
      { companyGroup: targetGroups[0], articleName: '架空操作用画像', count: 15 },
      { companyGroup: targetGroups[1], articleName: '架空情報表示画像', count: 5 },
    ],
  },
  records: fixtureRecords,
  aliasReview: {
    excludedRecords: [
      {
        id: 'FICTIONAL-EXCLUDED-001',
        reason: '架空別会社, Inc. 内の LY が LY Corporation に部分一致した誤抽出',
      },
    ],
  },
  warnings: [],
};

describe('loadHosoeAnalysisPackJson', () => {
  it('loads a fictional v3 audited pack, its exclusion audit, and all 20 records', () => {
    const result = loadHosoeAnalysisPackJson(fixturePack, 'sample-expert-analysis-pack.json');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pack.title).toBe('専門家レビュー用:架空スマホ関連企業の画像意匠');
    expect(result.pack.version).toBe('v3-audited-fixture');
    expect(result.pack.strictPrefixWCount).toBe(0);
    expect(result.pack.dTermWIncludedCandidateCount).toBe(20);
    expect(result.pack.records).toHaveLength(20);
    expect(result.pack.audit).toMatchObject({
      initialAutomaticCount: 21,
      auditedCount: 20,
      excludedCount: 1,
    });
    expect(result.pack.audit.excludedRecords[0]).toEqual({
      id: 'FICTIONAL-EXCLUDED-001',
      originalName: '架空別会社, Inc.',
      reason: '短い別名 LY が、別会社名 架空別会社 の文字列内に部分一致したため',
    });
    expect(result.pack.vTermSummary).toEqual({
      confirmedCount: 15,
      unconfirmedCount: 5,
      unconfirmedCompanyGroups: ['NTT DOCOMO'],
      unconfirmedGazetteDates: ['2026-06-08'],
    });
    expect(result.pack.records[0]).toMatchObject({
      vTermReviewStatus: 'confirmed',
      vTerms: ['VAA', 'VNA'],
      sourceUpdateDate: undefined,
      internationalApplicationDate: undefined,
    });
    expect(result.pack.records[0].classificationNote).toContain('日本意匠分類にWを含む画像意匠候補');
    expect(result.pack.records[0].classificationNote).not.toContain('DタームW候補');
    expect(result.pack.records[0]).not.toHaveProperty('sourceFileHint');
    expect(result.summaryText).not.toContain(['strict', 'PrefixW'].join(''));
  });

  it('calculates the six-company split and preserves cautious zero wording', () => {
    const result = loadHosoeAnalysisPackJson(fixturePack, 'sample-expert-analysis-pack.json');

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pack.companySummaries).toHaveLength(6);
    expect(result.pack.companySummaries.find((summary) => summary.companyGroup === 'Apple')).toMatchObject({
      dTermWIncludedCandidateCount: 15,
      applicantHitCount: 15,
      rightHolderHitCount: 15,
    });
    expect(result.pack.companySummaries.find((summary) => summary.companyGroup === 'NTT DOCOMO')).toMatchObject({
      dTermWIncludedCandidateCount: 5,
      applicantHitCount: 0,
      rightHolderHitCount: 5,
    });
    expect(result.pack.companySummaries.filter((summary) => summary.dTermWIncludedCandidateCount === 0)).toHaveLength(4);
    expect(result.pack.companySummaries.find((summary) => summary.companyGroup === softBankGroup)?.note).toBe(
      '手元データ範囲・現在の分類・名寄せ条件では未検出',
    );
  });
});
