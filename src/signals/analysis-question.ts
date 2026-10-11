export const ANALYSIS_QUESTION_VERSION = '1.0.0';
export const ANALYSIS_QUESTIONS = {
  drawings: '図面のどこが違う？',
  support: '公式の説明は図面を裏付ける？',
  next: '次に何を確認すればよい？',
} as const;
export type AnalysisQuestionId = keyof typeof ANALYSIS_QUESTIONS;
export interface AnalysisQuestion { id: AnalysisQuestionId; version: typeof ANALYSIS_QUESTION_VERSION; text: string }

export function analysisQuestion(id: AnalysisQuestionId): AnalysisQuestion {
  return { id, version: ANALYSIS_QUESTION_VERSION, text: ANALYSIS_QUESTIONS[id] };
}
export function isAnalysisQuestion(value: unknown): value is AnalysisQuestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 3 && ['id', 'version', 'text'].every((key) => Object.prototype.hasOwnProperty.call(item, key)) && typeof item.id === 'string'
    && Object.prototype.hasOwnProperty.call(ANALYSIS_QUESTIONS, item.id)
    && item.version === ANALYSIS_QUESTION_VERSION
    && item.text === ANALYSIS_QUESTIONS[item.id as AnalysisQuestionId];
}
export function sameAnalysisQuestion(left: AnalysisQuestion | null | undefined, right: AnalysisQuestion | null | undefined): boolean {
  return left == null || right == null ? left == null && right == null
    : isAnalysisQuestion(left) && isAnalysisQuestion(right) && left.id === right.id && left.version === right.version && left.text === right.text;
}
