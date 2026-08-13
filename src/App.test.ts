import { describe, expect, it } from 'vitest';
import { buildCompanyOptions } from './analysis/buildCompanyOptions';
import { projectLocalJpoDesignRecord } from './analysis/projectLegacyDesignRecord';
import { validateRequest } from './domain/validation';
import type { AnalysisRequest, DesignRecord } from './domain/types';

const validRequest: AnalysisRequest = {
  scope: { mode: 'all_classes' },
  period: 'last_1y',
  designKinds: ['article'],
  purposes: ['market_trend'],
  departments: ['product_planning'],
};

describe('validateRequest', () => {
  it('requires companies when company scope is selected', () => {
    const errors = validateRequest({ ...validRequest, scope: { mode: 'companies', companySelectors: [] } });

    expect(errors.companies).toBeDefined();
  });

  it('requires design kinds, purposes, and departments', () => {
    const errors = validateRequest({
      ...validRequest,
      designKinds: [],
      purposes: [],
      departments: [],
    });

    expect(errors.designKinds).toBeDefined();
    expect(errors.purposes).toBeDefined();
    expect(errors.departments).toBeDefined();
  });
});

describe('buildCompanyOptions', () => {
  it('offers only the primary applicant for legacy records while retaining search memberships', () => {
    const legacyRecord: DesignRecord = {
      id: 'fixture-legacy-company-options',
      gazetteDate: '2026-08-01',
      applicant: '架空一次出願人株式会社',
      applicantsDisplay: '架空一次出願人株式会社（表示別名）',
      applicants: ['架空一次出願人株式会社', '架空出願人別表記'],
      applicantsNormalized: ['架空出願人正規化名'],
      rightHolders: ['架空権利者株式会社'],
      unresolvedApplicants: ['FIXTURE-UNRESOLVED-APPLICANT'],
      unresolvedRightHolders: ['FIXTURE-UNRESOLVED-RIGHT-HOLDER'],
      businessDomain: '架空領域',
      designKind: 'article',
      articleName: '架空製品',
      designClass: 'FIXTURE-CLASS',
      keywords: ['架空'],
      designFeatures: ['架空特徴'],
      sourceLabel: '完全架空テスト',
      isSample: false,
    };
    const projected = projectLocalJpoDesignRecord(legacyRecord);

    expect(projected.companyMemberships.map((membership) => membership.displayLabel)).toEqual(
      expect.arrayContaining([
        '架空一次出願人株式会社（表示別名）',
        '架空出願人別表記',
        '架空出願人正規化名',
        '架空権利者株式会社',
        '未解決コード: FIXTURE-UNRESOLVED-APPLICANT',
        '未解決コード: FIXTURE-UNRESOLVED-RIGHT-HOLDER',
      ]),
    );
    expect(buildCompanyOptions([projected])).toEqual([
      {
        origin: 'legacy',
        role: 'applicant',
        localKey: '架空一次出願人株式会社',
        displayLabel: '架空一次出願人株式会社',
      },
    ]);
  });
});
