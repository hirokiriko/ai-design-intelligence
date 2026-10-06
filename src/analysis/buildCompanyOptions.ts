import {
  companySelectorFromMembership,
  companySelectorKey,
  type AnalysisReadyDesignRecord,
  type CompanySelector,
} from '../domain/analysisRecords';

export function buildCompanyOptions(records: AnalysisReadyDesignRecord[]): CompanySelector[] {
  const options = new Map<string, { selector: CompanySelector; count: number }>();
  for (const record of records) {
    const seen = new Set<string>();
    for (const membership of record.companyMemberships) {
      if (membership.role !== 'applicant') continue;
      if (membership.origin !== 'backend' && !membership.isPrimaryApplicant) continue;
      const selector = companySelectorFromMembership(membership);
      const key = companySelectorKey(selector);
      if (seen.has(key)) continue;
      seen.add(key);
      const current = options.get(key);
      options.set(key, { selector: current?.selector ?? selector, count: (current?.count ?? 0) + 1 });
    }
  }

  return [...options.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.selector.displayLabel.localeCompare(right.selector.displayLabel, 'ja') ||
        companySelectorKey(left.selector).localeCompare(companySelectorKey(right.selector)),
    )
    .map(({ selector }) => selector);
}
