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

  it('accepts market, industry, and populated company scopes', () => {
    expect(validateRequest(validRequest)).toEqual({});
    expect(
      validateRequest({
        ...validRequest,
        scope: { mode: 'industry', industry: '住宅設備' },
        productDomain: '住宅設備',
      }),
    ).toEqual({});
    expect(
      validateRequest({
        ...validRequest,
        scope: { mode: 'companies', companies: ['架空モビリティ株式会社'] },
      }),
    ).toEqual({});
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

  it('allows analysis without an output department', () => {
    const errors = validateRequest({ ...validRequest, departments: [] });

    expect(errors).toEqual({});
  });
});
