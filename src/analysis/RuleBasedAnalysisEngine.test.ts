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
  });

  it('creates market view for all class analysis', async () => {
    const source = new SampleDesignDataSource();
    const allClassRequest: AnalysisRequest = { ...request, scope: { mode: 'all_classes' } };
    const records = await source.query(allClassRequest);
    const result = await new RuleBasedAnalysisEngine().analyze(allClassRequest, records, source.getDataAsOf());

    expect(result.market).toBeDefined();
    expect(collectMarketInsights(result.market!).every((insight) => insight.evidenceIds.length > 0)).toBe(true);
  });

  it('filters generic English words from design direction keywords', async () => {
    const records = [
      makeRecord('english-1', { keywords: ['in', 'outermost', 'camera'], designFeatures: ['show', 'screen'] }),
      makeRecord('english-2', { keywords: ['and', 'interface', 'display'], designFeatures: ['perspective', 'camera'] }),
      makeRecord('english-3', { keywords: ['screen', 'interface'], designFeatures: ['of', 'display'] }),
    ];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('Apple Inc.'), records, '2026-06-24');
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

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('Apple Inc.'), records, '2026-06-24');
    const insight = result.companies[0].designTrend.designDirection;

    expect(insight.metric.value).toBe(0);
    expect(insight.evidenceIds).toHaveLength(0);
    expect(insight.confidence).toBe('low');
    expect(insight.text).toContain('参考表示を控えています');
  });

  it('does not attach record evidence to whitespace insight', async () => {
    const records = [makeRecord('white-1', { businessDomain: '冷蔵庫' })];

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('Apple Inc.'), records, '2026-06-24');
    const insight = result.companies[0].portfolio.whitespace;

    expect(insight.metric.value).toBe(0);
    expect(insight.evidenceIds).toHaveLength(0);
    expect(insight.confidence).toBe('low');
    expect(insight.text).toContain('既存record.idで裏付けられない');
  });

  it('keeps confidence below high for small evidence sets', async () => {
    const records = Array.from({ length: 6 }, (_, index) => makeRecord(`small-${index + 1}`));

    const result = await new RuleBasedAnalysisEngine().analyze(singleCompanyRequest('Apple Inc.'), records, '2026-06-24');

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

function singleCompanyRequest(company: string): AnalysisRequest {
  return { ...request, scope: { mode: 'companies', companies: [company] } };
}

function makeRecord(id: string, overrides: Partial<DesignRecord> = {}): DesignRecord {
  return {
    id,
    gazetteDate: '2026-06-20',
    applicant: 'Apple Inc.',
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
