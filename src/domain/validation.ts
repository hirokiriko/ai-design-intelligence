import type { AnalysisRequest, ValidationErrors } from './types';

export function validateRequest(request: AnalysisRequest): ValidationErrors {
  const errors: ValidationErrors = {};
  if (request.scope.mode === 'companies' && request.scope.companies.length === 0) {
    errors.companies = '企業指定分析では、少なくとも1社を追加してください。';
  }
  if (request.designKinds.length === 0) {
    errors.designKinds = '意匠種別を少なくとも1つ選択してください。';
  }
  if (request.purposes.length === 0) {
    errors.purposes = '分析目的を少なくとも1つ選択してください。';
  }
  if (request.departments.length === 0) {
    errors.departments = '出力部門を少なくとも1つ選択してください。';
  }
  return errors;
}
