import type { AnalysisReadyDesignRecord } from '../domain/analysisRecords';
import type { AnalysisRequest, AnalysisResult } from '../domain/types';

export interface AnalysisEngine {
  analyze(req: AnalysisRequest, records: AnalysisReadyDesignRecord[], dataAsOf: string): Promise<AnalysisResult>;
}
