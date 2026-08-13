import { describe, expect, it } from 'vitest';
import { RuleBasedAnalysisEngine } from './RuleBasedAnalysisEngine';
import { SampleDesignDataSource } from '../data/SampleDesignDataSource';
import {
  companySelectorKey,
  type AnalysisReadyDesignRecord,
  type CompanySelector,
  type ClassificationMembership,
} from '../domain/analysisRecords';
import type {
  AnalysisInsight,
  AnalysisRequest,
  CompanyAnalysis,
  DesignRecord,
  MarketAnalysis,
} from '../domain/types';
import {
  normalizeLocalCompanyKey,
  projectLocalJpoDesignRecord,
  projectSampleDesignRecord,
  type ProjectedLegacyDesignRecord,
} from './projectLegacyDesignRecord';

const request: AnalysisRequest = {
  scope: {
    mode: 'companies',
    companySelectors: [
      sampleSelector('サンプル電機株式会社'),
      sampleSelector('デモ住設株式会社'),
    ],
  },
  period: 'last_1y',
  designKinds: ['article', 'image', 'interior'],
  purposes: ['dx_dev', 'portfolio', 'filing_strategy'],
  departments: ['product_planning', 'design', 'ip'],
};

describe('RuleBasedAnalysisEngine', () => {
  it('generates rule-based analysis with evidence, metrics, confidence, and stable company keys', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(request);
    const result = await new RuleBasedAnalysisEngine().analyze(request, records, source.getDataAsOf());

    expect(result.generatedBy).toBe('rules');
    expect(result.dataAsOf).toBe('2026-06-15');
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0].companyKey).toBe(
      companySelectorKey(request.scope.mode === 'companies' ? request.scope.companySelectors[0] : sampleSelector('unused')),
    );

    const insights = result.companies.flatMap((company) => collectCompanyInsights(company));
    expect(insights.length).toBeGreaterThan(20);
    expect(insights.every((insight) => typeof insight.text === 'string' && insight.text.length > 0)).toBe(true);
    expect(insights.every((insight) => insight.metric.label.length > 0)).toBe(true);
    expect(insights.every((insight) => ['low', 'medium', 'high'].includes(insight.confidence))).toBe(true);
    expect(insights.some((insight) => insight.evidenceIds.length > 0)).toBe(true);
    expect(result.companies[0].designTrend.domains.text).toContain('家電・映像機器');
  });

  it('creates market view for all class analysis', async () => {
    const source = new SampleDesignDataSource();
    const allClassRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };
    const records = await source.query(allClassRequest);
    const result = await new RuleBasedAnalysisEngine().analyze(allClassRequest, records, source.getDataAsOf());

    expect(result.market).toBeDefined();
    expect(collectMarketInsights(result.market!).every((insight) => insight.evidenceIds.length > 0)).toBe(true);
    expect(result.market?.trends.metric.value).toBe(records.length);
  });

  it('keeps legacy aliases searchable without counting them as separate market applicants', async () => {
    const record = projectLocalJpoDesignRecord({
      id: 'fixture-legacy-primary-applicant',
      gazetteDate: '2026-06-20',
      applicant: '架空代表出願人',
      applicants: ['架空検索別名'],
      applicantsDisplay: '架空表示別名',
      applicantsNormalized: ['架空正規化別名'],
      unresolvedApplicants: ['FIXTURE-UNRESOLVED-APPLICANT'],
      rightHolders: ['架空権利者'],
      unresolvedRightHolders: ['FIXTURE-UNRESOLVED-RIGHT-HOLDER'],
      businessDomain: '架空領域',
      designKind: 'article',
      articleName: '架空物品',
      designClass: 'FIXTURE-CLASS',
      keywords: ['架空'],
      designFeatures: ['特徴'],
      sourceLabel: 'fixture',
      isSample: false,
    });
    const allClassRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };

    const marketResult = await new RuleBasedAnalysisEngine().analyze(allClassRequest, [record], '2026-06-24');

    expect(marketResult.market?.companyMoves.metric.value).toBe(1);
    expect(marketResult.market?.companyMoves.text).toContain('架空代表出願人');
    expect(marketResult.market?.companyMoves.text).not.toContain('架空検索別名');
    expect(marketResult.market?.companyMoves.text).not.toContain('架空権利者');

    const aliasSelector: CompanySelector = {
      origin: 'legacy',
      role: 'applicant',
      localKey: normalizeLocalCompanyKey('架空検索別名'),
      displayLabel: '架空検索別名',
    };
    const aliasRequest: AnalysisRequest = {
      ...request,
      scope: { mode: 'companies', companySelectors: [aliasSelector] },
    };
    const aliasResult = await new RuleBasedAnalysisEngine().analyze(aliasRequest, [record], '2026-06-24');
    expect(aliasResult.companies[0].designTrend.domains.metric.value).toBe(1);
  });

  it('matches backend companies by exact role/entity membership without duplicating records', async () => {
    const selector: CompanySelector = {
      origin: 'backend',
      role: 'applicant',
      resolvedEntityId: 'kds_fixture_entity_alpha',
      displayLabel: '架空企業アルファ',
    };
    const classA: ClassificationMembership = {
      scheme: 'FIXTURE-SCHEME',
      code: 'A-01',
      label: '架空分類A',
      isPrimary: true,
    };
    const classB: ClassificationMembership = {
      scheme: 'FIXTURE-SCHEME',
      code: 'B-01',
      label: '架空分類B',
      isPrimary: false,
    };
    const records: AnalysisReadyDesignRecord[] = [
      makeBackendRecord('kds_fixture_record_alpha', selector, [classA, { ...classA }, classB]),
      makeBackendRecord('kds_fixture_record_beta', selector, [classB], {
        articleName: null,
        description: null,
        articleDescription: null,
        keywords: undefined,
        designFeatures: undefined,
      }),
    ];
    const companyRequest: AnalysisRequest = {
      ...request,
      scope: { mode: 'companies', companySelectors: [selector] },
    };

    const result = await new RuleBasedAnalysisEngine().analyze(companyRequest, records, '2026-08-09');
    const company = result.companies[0];

    expect(company.companyKey).toBe(companySelectorKey(selector));
    expect(company.company).toBe('架空企業アルファ');
    expect(company.designTrend.domains.metric.value).toBe(2);
    expect(company.designTrend.domains.evidenceIds).toEqual([
      'kds_fixture_record_alpha',
      'kds_fixture_record_beta',
    ]);
    expect(new Set(company.designTrend.domains.evidenceIds).size).toBe(2);
    expect(company.designTrend.domains.text.indexOf('架空分類B')).toBeLessThan(
      company.designTrend.domains.text.indexOf('架空分類A'),
    );

    const marketRequest: AnalysisRequest = { ...companyRequest, scope: { mode: 'all_classes' } };
    const marketResult = await new RuleBasedAnalysisEngine().analyze(marketRequest, records, '2026-08-09');
    expect(marketResult.market?.trends.metric.value).toBe(2);
    expect(marketResult.market?.companyMoves.metric.value).toBe(1);
    expect(marketResult.market?.trends.evidenceIds).toEqual([
      'kds_fixture_record_alpha',
      'kds_fixture_record_beta',
    ]);
    expect(JSON.stringify(marketResult)).not.toContain('サンプル');
  });

  it('uses source-neutral wording when a backend selector has no matching records', async () => {
    const selector: CompanySelector = {
      origin: 'backend',
      role: 'applicant',
      resolvedEntityId: 'kds_fixture_entity_empty',
      displayLabel: '架空企業ゼロ',
    };
    const emptyRequest: AnalysisRequest = {
      ...request,
      scope: { mode: 'companies', companySelectors: [selector] },
    };

    const result = await new RuleBasedAnalysisEngine().analyze(emptyRequest, [], '2026-08-09');

    expect(result.companies[0].designTrend.domains.text).toBe('架空企業ゼロの該当意匠はありません。');
    expect(JSON.stringify(result)).not.toContain('サンプル');
  });

  it('does not match the same backend entity under a different role', async () => {
    const applicantSelector: CompanySelector = {
      origin: 'backend',
      role: 'applicant',
      resolvedEntityId: 'kds_fixture_entity_alpha',
      displayLabel: '架空企業アルファ（出願人）',
    };
    const rightHolderSelector: CompanySelector = {
      ...applicantSelector,
      role: 'right_holder',
      displayLabel: '架空企業アルファ（権利者）',
    };
    const classification: ClassificationMembership = {
      scheme: 'FIXTURE-SCHEME',
      code: 'A-01',
      label: '架空分類A',
      isPrimary: true,
    };
    const records = [makeBackendRecord('kds_fixture_role_record', applicantSelector, [classification])];
    const roleRequest: AnalysisRequest = {
      ...request,
      scope: { mode: 'companies', companySelectors: [rightHolderSelector] },
    };

    const result = await new RuleBasedAnalysisEngine().analyze(roleRequest, records, '2026-08-09');

    expect(result.companies[0].designTrend.domains.metric.value).toBe(0);
    expect(result.companies[0].designTrend.domains.evidenceIds).toEqual([]);
  });

  it('filters generic English words from design direction keywords', async () => {
    const records = [
      makeRecord('english-1', { keywords: ['in', 'outermost', 'camera'], designFeatures: ['show', 'screen'] }),
      makeRecord('english-2', { keywords: ['and', 'interface', 'display'], designFeatures: ['perspective', 'camera'] }),
      makeRecord('english-3', { keywords: ['screen', 'interface'], designFeatures: ['of', 'display'] }),
    ];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空UI株式会社'), records, '2026-06-24');
    const insight = result.companies[0].designTrend.designDirection;

    expect(insight.metric.value).toBeGreaterThanOrEqual(3);
    expect(insight.evidenceIds.length).toBeGreaterThan(0);
    expect(insight.text).toContain('camera');
    expect(insight.text).not.toContain('outermost');
    expect(insight.text).not.toContain('show');
    expect(insight.text).not.toMatch(/(^|[、\s])and($|[、\s])/i);
  });

  it('suppresses design direction when only stop words remain', async () => {
    const records = [
      makeRecord('stop-only-1', { keywords: ['in', 'on', 'show'], designFeatures: ['outermost', 'and'] }),
      makeRecord('stop-only-2', { keywords: ['of', 'for', 'the'], designFeatures: ['view', 'figure'] }),
    ];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空UI株式会社'), records, '2026-06-24');
    const insight = result.companies[0].designTrend.designDirection;

    expect(insight.metric.value).toBe(0);
    expect(insight.evidenceIds).toHaveLength(0);
    expect(insight.confidence).toBe('low');
    expect(insight.text).toContain('参考表示を控えています');
  });

  it('does not attach record evidence to whitespace insight', async () => {
    const records = [makeRecord('white-1', { businessDomain: '冷蔵庫' })];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空UI株式会社'), records, '2026-06-24');
    const insight = result.companies[0].portfolio.whitespace;

    expect(insight.metric.value).toBe(0);
    expect(insight.evidenceIds).toHaveLength(0);
    expect(insight.confidence).toBe('low');
    expect(insight.text).toContain('既存record.idで裏付けられない');
  });

  it('keeps confidence below high for small evidence sets', async () => {
    const records = Array.from({ length: 6 }, (_, index) => makeRecord(`small-${index + 1}`));

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空UI株式会社'), records, '2026-06-24');

    expect(result.companies[0].designTrend.domains.confidence).not.toBe('high');
  });

  it('avoids strong increase or reinforcement wording', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(request);
    const result = await new RuleBasedAnalysisEngine().analyze(request, records, source.getDataAsOf());
    const text = result.companies.flatMap((company) => collectCompanyInsights(company)).map((insight) => insight.text).join('\n');

    const strongPhrases = ['増加' + 'しています', '強化' + 'しています', '注力' + 'しています'];
    strongPhrases.forEach((phrase) => expect(text).not.toContain(phrase));
  });
});

function sampleSelector(company: string): CompanySelector {
  return {
    origin: 'sample',
    role: 'applicant',
    localKey: normalizeLocalCompanyKey(company),
    displayLabel: company,
  };
}

function singleCompanyRequest(company: string): AnalysisRequest {
  return { ...request, scope: { mode: 'companies', companySelectors: [sampleSelector(company)] } };
}

function makeRecord(id: string, overrides: Partial<DesignRecord> = {}): ProjectedLegacyDesignRecord {
  return projectSampleDesignRecord({
    id,
    gazetteDate: '2026-06-20',
    applicant: '架空UI株式会社',
    businessDomain: 'Graphical user interface',
    designKind: 'image',
    articleName: 'Graphical user interface',
    designClass: 'S-N3-10W',
    keywords: ['screen', 'interface', 'display'],
    designFeatures: ['camera', 'icon', 'control'],
    sourceLabel: 'fixture',
    isSample: true,
    ...overrides,
  });
}

function makeBackendRecord(
  id: string,
  selector: Extract<CompanySelector, { origin: 'backend' }>,
  classifications: ClassificationMembership[],
  overrides: Partial<AnalysisReadyDesignRecord> = {},
): AnalysisReadyDesignRecord {
  return {
    origin: 'backend',
    id,
    applicationNumber: null,
    registrationNumber: null,
    gazetteDate: '2026-08-01',
    articleName: '架空操作画面',
    description: '通知ダッシュボード',
    articleDescription: null,
    designKind: 'image',
    keywords: ['通知', 'ダッシュボード'],
    designFeatures: ['カード'],
    companyMemberships: [{ ...selector }, { ...selector }],
    classificationMemberships: classifications,
    primaryClassification: classifications.find((classification) => classification.isPrimary) ?? null,
    ...overrides,
  } as AnalysisReadyDesignRecord;
}

function collectCompanyInsights(company: CompanyAnalysis): AnalysisInsight[] {
  return [
    ...Object.values(company.designTrend),
    ...Object.values(company.dxDevTrend),
    ...Object.values(company.designChange),
    ...Object.values(company.portfolio),
    ...Object.values(company.ipStrategy),
  ];
}

function collectMarketInsights(market: MarketAnalysis): AnalysisInsight[] {
  return [market.trends, market.emergingDomains, market.companyMoves];
}
