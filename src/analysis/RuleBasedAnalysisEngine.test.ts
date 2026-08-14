import { describe, expect, it } from 'vitest';
import { RuleBasedAnalysisEngine } from './RuleBasedAnalysisEngine';
import { SampleDesignDataSource } from '../data/SampleDesignDataSource';
import type { AnalysisInsight, AnalysisRequest, CompanyAnalysis, DesignRecord, MarketAnalysis } from '../domain/types';

const request: AnalysisRequest = {
  scope: { mode: 'companies', companies: ['サンプル電機株式会社', 'デモ住設株式会社'] },
  period: 'last_1y',
  designKinds: ['article', 'image', 'interior'],
  purposes: ['dx_dev', 'portfolio', 'filing_strategy'],
  departments: ['product_planning', 'design', 'ip'],
};

describe('RuleBasedAnalysisEngine', () => {
  it('generates rule-based analysis with evidence, metrics, and confidence', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(request);
    const result = await new RuleBasedAnalysisEngine().analyze(request, records, source.getDataAsOf());

    expect(result.generatedBy).toBe('rules');
    expect(result.dataAsOf).toBe('2026-06-15');
    expect(result.companies).toHaveLength(2);

    const insights = result.companies.flatMap((company) => collectCompanyInsights(company));
    expect(insights.length).toBeGreaterThan(20);
    expect(insights.every((insight) => typeof insight.text === 'string' && insight.text.length > 0)).toBe(true);
    expect(insights.every((insight) => insight.metric.label.length > 0)).toBe(true);
    expect(insights.every((insight) => ['low', 'medium', 'high'].includes(insight.confidence))).toBe(true);
    expect(insights.some((insight) => insight.evidenceIds.length > 0)).toBe(true);
    const recordIds = new Set(records.map((record) => record.id));
    expect(insights.flatMap((insight) => insight.evidenceIds).every((id) => recordIds.has(id))).toBe(true);
  });

  it('creates market view for all class analysis', async () => {
    const source = new SampleDesignDataSource();
    const allClassRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };
    const records = await source.query(allClassRequest);
    const result = await new RuleBasedAnalysisEngine().analyze(allClassRequest, records, source.getDataAsOf());

    expect(result.market).toBeDefined();
    expect(collectMarketInsights(result.market!).every((insight) => insight.evidenceIds.length > 0)).toBe(true);
    expect(result.market!.companyMoves.text).toContain('今回の対象データの対象');
    expect(result.market!.companyMoves.text).not.toContain('サンプル内');
  });

  it('creates a market view for an industry request while keeping company scope company-only', async () => {
    const source = new SampleDesignDataSource();
    const industryRequest: AnalysisRequest = {
      ...request,
      scope: { mode: 'industry', industry: '住宅設備' },
      productDomain: '住宅設備',
    };
    const industryRecords = await source.query(industryRequest);
    const industryResult = await new RuleBasedAnalysisEngine().analyze(
      industryRequest,
      industryRecords,
      source.getDataAsOf(),
    );
    const companyRecords = await source.query(request);
    const companyResult = await new RuleBasedAnalysisEngine().analyze(
      request,
      companyRecords,
      source.getDataAsOf(),
    );

    expect(industryRecords.length).toBeGreaterThan(0);
    expect(industryResult.request.scope).toEqual({ mode: 'industry', industry: '住宅設備' });
    expect(industryResult.market).toBeDefined();
    expect(industryResult.companies.length).toBeGreaterThan(0);
    expect(companyResult.market).toBeUndefined();
    expect(companyResult.companies.map((company) => company.company)).toEqual(request.scope.mode === 'companies' ? request.scope.companies : []);
  });

  it('uses existing unique record IDs and keeps count metrics aligned with their evidence', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(request);
    const result = await new RuleBasedAnalysisEngine().analyze(request, records, source.getDataAsOf());
    const recordIds = new Set(records.map((record) => record.id));
    const insights = result.companies.flatMap((company) => collectCompanyInsights(company));

    for (const insight of insights) {
      expect(new Set(insight.evidenceIds).size).toBe(insight.evidenceIds.length);
      expect(insight.evidenceIds.every((id) => recordIds.has(id))).toBe(true);
      if (insight.metric.unit === '件') {
        expect(insight.metric.value, insight.metric.label).toBe(insight.evidenceIds.length);
      }
    }
  });

  it('uses the same matched record set for the UI change metric and evidence', async () => {
    const records = [
      makeRecord('ui-match', { keywords: ['通知'], designFeatures: ['カード'] }),
      makeRecord('ui-non-match', { keywords: ['装飾'], designFeatures: ['配色'] }),
    ];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空テック株式会社'), records, '2026-06-24');
    const insight = result.companies[0].designChange.uiChange;

    expect(insight.metric.value).toBe(1);
    expect(insight.evidenceIds).toEqual(['ui-match']);
  });

  it('omits department-specific guidance when no output department is selected', async () => {
    const records = [makeRecord('no-department')];
    const noDepartmentRequest: AnalysisRequest = {
      ...singleCompanyRequest('架空テック株式会社'),
      departments: [],
    };

    const result = await new RuleBasedAnalysisEngine().analyze(noDepartmentRequest, records, '2026-06-24');
    const insight = result.companies[0].portfolio.focusAreas;

    expect(insight.text).toBe('集中領域の参考候補はGraphical user interfaceです。');
    expect(insight.text).not.toContain('向けには');
  });

  it('grounds company moves in record counts for one company in one domain', async () => {
    const records = [
      makeRecord('single-company-1', { articleName: '操作画面' }),
      makeRecord('single-company-2', { articleName: '設定画面' }),
      makeRecord('single-company-3', { articleName: '通知画面' }),
    ];
    const marketRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };

    const result = await new RuleBasedAnalysisEngine().analyze(marketRequest, records, '2026-06-24');
    const insight = result.market!.companyMoves;

    expect(insight.text).toContain('今回の対象データでは');
    expect(insight.text).not.toContain('サンプル内');
    expect(insight.text).toContain('架空テック株式会社 3件');
    expect(insight.text).not.toContain('複数領域');
    expect(insight.metric).toEqual({ label: '対象意匠数', value: 3, unit: '件', comparison: '対象1社' });
    expect(insight.evidenceIds).toEqual(['single-company-1', 'single-company-2', 'single-company-3']);
    expect(insight.metric.value).toBe(insight.evidenceIds.length);
  });

  it('uses neutral company-move wording for non-sample records', async () => {
    const records = [
      makeRecord('local-company-1', { applicant: '架空テック株式会社', isSample: false }),
      makeRecord('local-company-2', { applicant: '仮想デザイン株式会社', isSample: false }),
    ];
    const marketRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };

    const result = await new RuleBasedAnalysisEngine().analyze(marketRequest, records, '2026-06-24');
    const insight = result.market!.companyMoves;

    expect(insight.text).toContain('今回の対象データの対象2社');
    expect(insight.text).not.toContain('サンプル内');
  });

  it('derives emerging product names and evidence from the same top-domain records', async () => {
    const records = [
      makeRecord('domain-a-1', { businessDomain: '領域A', articleName: '領域A商品1' }),
      makeRecord('domain-a-2', { businessDomain: '領域A', articleName: '領域A商品2' }),
      makeRecord('domain-a-3', { businessDomain: '領域A', articleName: '領域A商品3' }),
      makeRecord('domain-a-4', { businessDomain: '領域A', articleName: '領域A商品4' }),
      makeRecord('domain-b-1', { businessDomain: '領域B', articleName: '領域B商品1' }),
      makeRecord('domain-b-2', { businessDomain: '領域B', articleName: '領域B商品2' }),
      makeRecord('domain-b-3', { businessDomain: '領域B', articleName: '領域B商品3' }),
      makeRecord('domain-c-1', { businessDomain: '領域C', articleName: '領域外上位商品' }),
      makeRecord('domain-c-2', { businessDomain: '領域C', articleName: '領域外上位商品' }),
    ];
    const marketRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };

    const result = await new RuleBasedAnalysisEngine().analyze(marketRequest, records, '2026-06-24');
    const insight = result.market!.emergingDomains;

    expect(insight.text).toContain('領域A商品1');
    expect(insight.text).not.toContain('領域外上位商品');
    expect(insight.metric.value).toBe(7);
    expect(insight.evidenceIds).toEqual([
      'domain-a-1',
      'domain-a-2',
      'domain-a-3',
      'domain-a-4',
      'domain-b-1',
      'domain-b-2',
      'domain-b-3',
    ]);
    expect(insight.metric.value).toBe(insight.evidenceIds.length);
  });

  it('filters generic English words from design direction keywords', async () => {
    const records = [
      makeRecord('english-1', { keywords: ['in', 'outermost', 'camera'], designFeatures: ['show', 'screen'] }),
      makeRecord('english-2', { keywords: ['and', 'interface', 'display'], designFeatures: ['perspective', 'camera'] }),
      makeRecord('english-3', { keywords: ['screen', 'interface'], designFeatures: ['of', 'display'] }),
    ];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空テック株式会社'), records, '2026-06-24');
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

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空テック株式会社'), records, '2026-06-24');
    const insight = result.companies[0].designTrend.designDirection;

    expect(insight.metric.value).toBe(0);
    expect(insight.evidenceIds).toHaveLength(0);
    expect(insight.confidence).toBe('low');
    expect(insight.text).toContain('参考表示を控えています');
  });

  it('does not attach record evidence to whitespace insight', async () => {
    const records = [makeRecord('white-1', { businessDomain: '冷蔵庫' })];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空テック株式会社'), records, '2026-06-24');
    const insight = result.companies[0].portfolio.whitespace;

    expect(insight.metric.value).toBe(0);
    expect(insight.evidenceIds).toHaveLength(0);
    expect(insight.confidence).toBe('low');
    expect(insight.text).toContain('既存record.idで裏付けられない');
  });

  it('keeps confidence below high for small evidence sets', async () => {
    const records = Array.from({ length: 6 }, (_, index) => makeRecord(`small-${index + 1}`));

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('架空テック株式会社'), records, '2026-06-24');

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

  it('does not make prediction, strategy-identification, or legal-judgment claims', async () => {
    const source = new SampleDesignDataSource();
    const records = await source.query(request);
    const result = await new RuleBasedAnalysisEngine().analyze(request, records, source.getDataAsOf());
    const text = result.companies
      .flatMap((company) => collectCompanyInsights(company))
      .map((insight) => insight.text)
      .join('\n');

    ['特許情報より早', '将来を予測', '企業戦略を特定', '侵害判断', '登録可能性を判断', '法的に問題ありません'].forEach(
      (phrase) => expect(text).not.toContain(phrase),
    );
  });

  it('does not claim absence when no records match', async () => {
    const emptyRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };
    const result = await new RuleBasedAnalysisEngine().analyze(emptyRequest, [], '2026-06-15');
    const text = collectMarketInsights(result.market!).map((insight) => insight.text).join('\n');

    expect(text).toContain('現在のデータと条件では検出されませんでした。');
    expect(text).not.toContain('該当意匠が存在しない');
  });
});

function singleCompanyRequest(company: string): AnalysisRequest {
  return { ...request, scope: { mode: 'companies', companies: [company] } };
}

function makeRecord(id: string, overrides: Partial<DesignRecord> = {}): DesignRecord {
  return {
    id,
    gazetteDate: '2026-06-20',
    applicant: '架空テック株式会社',
    businessDomain: 'Graphical user interface',
    designKind: 'image',
    articleName: 'Graphical user interface',
    designClass: 'N3-10W',
    keywords: ['screen', 'interface', 'display'],
    designFeatures: ['camera', 'icon', 'control'],
    sourceLabel: 'fixture',
    isSample: false,
    ...overrides,
  };
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
