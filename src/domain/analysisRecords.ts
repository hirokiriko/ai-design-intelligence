import type { DesignKind } from './types';

export type AnalysisRecordOrigin = 'backend' | 'sample' | 'legacy';
export type CompanyRole = 'applicant' | 'right_holder';

export interface BackendCompanySelector {
  origin: 'backend';
  role: CompanyRole;
  resolvedEntityId: string;
  displayLabel: string;
}

export interface LocalCompanySelector {
  origin: 'sample' | 'legacy';
  role: 'applicant';
  localKey: string;
  displayLabel: string;
}

export type CompanySelector = BackendCompanySelector | LocalCompanySelector;

export type BackendCompanyMembership = BackendCompanySelector;

export interface LocalCompanyMembership extends LocalCompanySelector {
  isPrimaryApplicant: boolean;
}

export type CompanyMembership = BackendCompanyMembership | LocalCompanyMembership;

export interface ClassificationMembership {
  scheme: string;
  code: string;
  label: string | null;
  isPrimary: boolean;
}

export interface AnalysisReadyDesignRecordBase {
  id: string;
  applicationNumber: string | null;
  applicationDate?: string | null;
  registrationNumber: string | null;
  registrationDate?: string | null;
  gazetteDate: string;
  articleName: string | null;
  description?: string | null;
  articleDescription?: string | null;
  designKind: DesignKind;
  keywords?: string[];
  designFeatures?: string[];
  companyMemberships: CompanyMembership[];
  classificationMemberships: ClassificationMembership[];
  primaryClassification: ClassificationMembership | null;
}

export type AnalysisReadyDesignRecord =
  | (AnalysisReadyDesignRecordBase & {
      origin: 'backend';
      businessDomain?: never;
    })
  | (AnalysisReadyDesignRecordBase & {
      origin: 'sample' | 'legacy';
      businessDomain?: string;
    });

export function companySelectorKey(selector: CompanySelector): string {
  return selector.origin === 'backend'
    ? JSON.stringify([selector.origin, selector.role, selector.resolvedEntityId])
    : JSON.stringify([selector.origin, selector.role, selector.localKey]);
}

export function companyMembershipKey(membership: CompanyMembership): string {
  return companySelectorKey(membership);
}

export function companySelectorMatchesMembership(
  selector: CompanySelector,
  membership: CompanyMembership,
): boolean {
  if (selector.origin !== membership.origin || selector.role !== membership.role) return false;

  if (selector.origin === 'backend') {
    return membership.origin === 'backend' && selector.resolvedEntityId === membership.resolvedEntityId;
  }

  if (selector.origin === 'legacy') {
    return membership.origin === 'legacy' && membership.localKey.includes(selector.localKey);
  }

  return membership.origin === 'sample' && selector.localKey === membership.localKey;
}

export function companySelectorFromMembership(membership: CompanyMembership): CompanySelector {
  return membership.origin === 'backend'
    ? {
        origin: membership.origin,
        role: membership.role,
        resolvedEntityId: membership.resolvedEntityId,
        displayLabel: membership.displayLabel,
      }
    : {
        origin: membership.origin,
        role: membership.role,
        localKey: membership.localKey,
        displayLabel: membership.displayLabel,
      };
}

export function classificationMembershipKey(membership: ClassificationMembership): string {
  return JSON.stringify([membership.scheme, membership.code]);
}

export function customerClassificationLabel(membership: ClassificationMembership): string {
  const label = membership.label?.trim();
  if (membership.scheme === 'JPO_NATIONAL_DESIGN_CLASSIFICATION') {
    return `日本意匠分類 ${membership.code}${label ? `（${label}）` : ''}`;
  }
  if (label) return label;
  if (membership.scheme === 'sample-design-class' || membership.scheme === 'legacy-design-class') {
    return membership.code;
  }
  return `分類コード ${membership.code}`;
}
