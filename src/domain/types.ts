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
  includeUnresolvedApplicants?: boolean;
}

export interface DesignRecord {
  id: string;
  sourceUpdateDate?: string;
  gazetteDrawingKeys?: GazetteDrawingKeys | null;
  registrationNumber?: string;
  applicationNumber?: string;
  applicationDate?: string;
  registrationDate?: string;
  gazetteNumber?: string;
  gazetteDate: string;
  applicant: string;
  applicants?: string[];
  applicantsDisplay?: string;
  applicantsNormalized?: string[];
  unresolvedApplicants?: string[];
  rightHolders?: string[];
  unresolvedRightHolders?: string[];
  creators?: string[];
  agents?: string[];
  priorityClaims?: string[];
  rawKeys?: string[];
  sourceFiles?: string[];
  businessDomain: string;
  designKind: DesignKind;
  designKindInferred?: boolean;
  articleName: string;
  designClass: string;
  classLabel?: string;
  keywords: string[];
  designFeatures: string[];
  designDescription?: string;
  articleDescription?: string;
  summary?: string;
  imageRef?: string;
  sourceLabel: string;
  sourceDataset?: string;
  isSample: boolean;
}

export interface GazetteDrawingKeys {
  source: string;
  issueDate?: string | null;
  issueNumber?: string | null;
  matchedBy?: string | null;
  gazetteDateFromXml?: string | null;
  gazetteDateMismatch?: boolean;
  gazetteNumber?: string | null;
  publicationDocumentId?: string | null;
  hasDrawingRefs?: boolean;
  drawingRefCount?: number;
  drawingRefs?: GazetteDrawingRef[];
  sourceXmlFile?: string | null;
  note?: string;
}

export interface GazetteDrawingRef {
  label?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  order?: number | null;
  isRepresentativeCandidate?: boolean;
  sourceXmlFile?: string | null;
}

export interface DemoShowcaseRecord {
  id: string;
  articleName: string;
  partyLabel?: string;
  registrationNumber?: string;
  applicationNumber?: string;
  gazetteDate?: string;
  designClass?: string;
  drawingRefCount: number;
  drawingLabels: string[];
  sourceXmlFile?: string | null;
  whyDemoFriendly?: string;
}

export interface InsightMetric {
  label: string;
  value: number;
  unit?: string;
  comparison?: string;
}

export interface AnalysisInsight {
  title: string;
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
