import { describe, expect, it } from 'vitest';
import { RuleBasedAnalysisEngine } from './RuleBasedAnalysisEngine';
import { SampleDesignDataSource } from '../data/SampleDesignDataSource';
import type { AnalysisInsight, AnalysisRequest, CompanyAnalysis, MarketAnalysis } from '../domain/types';

const request: AnalysisRequest = {
  scope: { mode: 'companies', companies: ['企業A', '企業B'] },
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
});

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
