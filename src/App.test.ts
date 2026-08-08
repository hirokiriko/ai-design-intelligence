import { describe, expect, it } from 'vitest';
import { validateRequest } from './domain/validation';
import type { AnalysisRequest } from './domain/types';

const validRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  period: 'last_1y',
  designKinds: ['article'],
  purposes: ['market_trend'],
  departments: ['product_planning'],
};

describe('validateRequest', () => {
  it('requires companies when company scope is selected', () => {
    const errors = validateRequest({ ...validRequest, scope: { mode: 'companies', companies: [] } });

    expect(errors.companies).toBeDefined();
  });

  it('requires design kinds and purposes while allowing automatic departments', () => {
    const errors = validateRequest({
      ...validRequest,
      designKinds: [],
      purposes: [],
      departments: [],
    });

    expect(errors.designKinds).toBeDefined();
    expect(errors.purposes).toBeDefined();
    expect(errors.departments).toBeUndefined();
  });

  it('requires a focus area for the industry scope', () => {
    const errors = validateRequest({ ...validRequest, scope: { mode: 'industry', industry: '' }, productDomain: '' });

    expect(errors.productDomain).toBeDefined();
  });
});
