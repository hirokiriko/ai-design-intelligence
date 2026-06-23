import type { AnalysisRequest, AnalysisResult, DesignRecord } from '../domain/types';

export interface AnalysisEngine {
  analyze(req: AnalysisRequest, records: DesignRecord[], dataAsOf: string): Promise<AnalysisResult>;
}
