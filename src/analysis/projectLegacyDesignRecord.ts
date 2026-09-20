import {
  classificationMembershipKey,
  type AnalysisReadyDesignRecord,
  type ClassificationMembership,
  type LocalCompanyMembership,
} from '../domain/analysisRecords';
import type { DesignRecord } from '../domain/types';

type NullableProjectionKeys =
  | 'applicationNumber'
  | 'applicationDate'
  | 'registrationNumber'
  | 'registrationDate'
  | 'articleDescription';

export type ProjectedLegacyDesignRecord = Omit<DesignRecord, NullableProjectionKeys> &
  AnalysisReadyDesignRecord;

export function projectSampleDesignRecord(record: DesignRecord): ProjectedLegacyDesignRecord {
  return projectLegacyDesignRecord(record, 'sample');
}

export function projectLocalJpoDesignRecord(record: DesignRecord): ProjectedLegacyDesignRecord {
  return projectLegacyDesignRecord(record, 'legacy');
}

export function projectLegacyDesignRecord(
  record: DesignRecord,
  origin: 'sample' | 'legacy',
): ProjectedLegacyDesignRecord {
  const classification: ClassificationMembership = {
    scheme: origin === 'sample' ? 'sample-design-class' : 'legacy-design-class',
    code: record.designClass,
    label: record.classLabel ?? null,
    isPrimary: true,
  };

  return {
    ...record,
    origin,
    applicationNumber: record.applicationNumber ?? null,
    applicationDate: record.applicationDate ?? null,
    registrationNumber: record.registrationNumber ?? null,
    registrationDate: record.registrationDate ?? null,
    articleName: record.articleName,
    description: record.designDescription ?? record.summary ?? null,
    articleDescription: record.articleDescription ?? null,
    companyMemberships: buildLocalCompanyMemberships(record, origin),
    classificationMemberships: [classification],
    primaryClassification: classification,
  };
}

export function normalizeLocalCompanyKey(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

function buildLocalCompanyMemberships(
  record: DesignRecord,
  origin: 'sample' | 'legacy',
): LocalCompanyMembership[] {
  const primaryApplicantKey = normalizeLocalCompanyKey(record.applicant);
  const labels =
    origin === 'sample'
      ? [record.applicant]
      : [
          record.applicant,
          record.applicantsDisplay,
          ...(record.applicants ?? []),
          ...(record.applicantsNormalized ?? []),
          ...(record.rightHolders ?? []),
          ...(record.unresolvedApplicants ?? []).map((code) => `未解決コード: ${code}`),
          ...(record.unresolvedRightHolders ?? []).map((code) => `未解決コード: ${code}`),
        ];
  const memberships = new Map<string, LocalCompanyMembership>();

  for (const displayLabel of labels) {
    const normalizedLabel = displayLabel?.trim();
    if (!normalizedLabel) continue;
    const membership: LocalCompanyMembership = {
      origin,
      role: 'applicant',
      localKey: normalizeLocalCompanyKey(normalizedLabel),
      displayLabel: normalizedLabel,
      isPrimaryApplicant: normalizeLocalCompanyKey(normalizedLabel) === primaryApplicantKey,
    };
    const key = JSON.stringify([membership.origin, membership.role, membership.localKey]);
    if (!memberships.has(key)) memberships.set(key, membership);
  }

  return [...memberships.values()];
}

export function dedupeClassificationMemberships(
  memberships: ClassificationMembership[],
): ClassificationMembership[] {
  const unique = new Map<string, ClassificationMembership>();
  for (const membership of memberships) {
    const key = classificationMembershipKey(membership);
    if (!unique.has(key)) unique.set(key, membership);
  }
  return [...unique.values()];
}
