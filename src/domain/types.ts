export type DesignKind = 'article' | 'image' | 'interior';
export type Period = 'last_1y' | 'last_2y';

export type AnalysisPurpose =
  | 'market_trend'
  | 'company_trend'
  | 'competitor_design'
  | 'dx_dev'
  | 'design_change'
  | 'ui_design'
  | 'portfolio'
  | 'filing_strategy';

export type Department =
  | 'mgmt_planning'
  | 'product_planning'
  | 'tech_planning'
  | 'rnd'
  | 'design'
  | 'ip';

export interface SampleDesignDataset {
  dataAsOf: string;
  records: DesignRecord[];
}

export interface AnalysisRequest {
  scope:
    | { mode: 'all_classes' }
    | { mode: 'companies'; companies: string[] };
  productDomain?: string;
  period: Period;
  designKinds: DesignKind[];
  purposes: AnalysisPurpose[];
  departments: Department[];
}

export interface DesignRecord {
  id: string;
  registrationNumber?: string;
  applicationNumber?: string;
  gazetteNumber?: string;
  gazetteDate: string;
  applicant: string;
  businessDomain: string;
  designKind: DesignKind;
  articleName: string;
  designClass: string;
  classLabel?: string;
  keywords: string[];
  designFeatures: string[];
  summary?: string;
  imageRef?: string;
  sourceLabel: string;
  isSample: true;
}

export interface InsightMetric {
  label: string;
  value: number;
  unit?: string;
  comparison?: string;
}

export interface AnalysisInsight {
  text: string;
  evidenceIds: string[];
  metric: InsightMetric;
  confidence: 'low' | 'medium' | 'high';
}

export interface CompanyAnalysis {
  company: string;
  designTrend: {
    domains: AnalysisInsight;
    shapeChange: AnalysisInsight;
    designDirection: AnalysisInsight;
  };
  dxDevTrend: {
    imageDesignGrowth: AnalysisInsight;
    digitalService: AnalysisInsight;
    aiIotTrend: AnalysisInsight;
  };
  designChange: {
    sizeTrend: AnalysisInsight;
    thinning: AnalysisInsight;
    usability: AnalysisInsight;
    uiChange: AnalysisInsight;
  };
  portfolio: {
    focusAreas: AnalysisInsight;
    strengthening: AnalysisInsight;
    whitespace: AnalysisInsight;
  };
  ipStrategy: {
    designProtectionAreas: AnalysisInsight;
    designFilingDirection: AnalysisInsight;
    patentReference: AnalysisInsight;
    trademarkReference: AnalysisInsight;
    copyrightReference: AnalysisInsight;
  };
}

export interface MarketAnalysis {
  trends: AnalysisInsight;
  emergingDomains: AnalysisInsight;
  companyMoves: AnalysisInsight;
}

export interface AnalysisResult {
  request: AnalysisRequest;
  dataAsOf: string;
  market?: MarketAnalysis;
  companies: CompanyAnalysis[];
  generatedBy: 'rules' | 'llm';
  disclaimer: string;
}

export interface ValidationErrors {
  companies?: string;
  designKinds?: string;
  purposes?: string;
  departments?: string;
}
