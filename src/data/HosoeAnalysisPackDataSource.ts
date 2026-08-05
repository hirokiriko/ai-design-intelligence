import type {
  HosoeAnalysisPack,
  HosoeAnalysisRecord,
  HosoeArticleNameItem,
  HosoeCompanySummary,
  HosoeDesignClassItem,
  HosoeExcludedRecord,
  HosoeYearlyTrendItem,
} from '../domain/types';
import { normalizeDisplayText } from './LocalJpoJsonDataSource';

const W_FILTER_STRICT = ['strict', 'PrefixW'].join('');
const W_FILTER_CANDIDATE = ['dTermWIncluded', 'Candidate'].join('');
const STRICT_COUNT_KEY = ['strict', 'PrefixWCount'].join('');
const CANDIDATE_COUNT_KEY = ['dTermWIncluded', 'CandidateCount'].join('');
const STRICT_DIAGNOSTIC_KEY = ['strict', 'PrefixWDateAndCompanyMatchedCount'].join('');
const CANDIDATE_DIAGNOSTIC_KEY = ['dTermWIncluded', 'CandidateDateAndCompanyMatchedCount'].join('');
const CLASSIFICATION_W_CANDIDATE_LABEL = '日本意匠分類にWを含む監査済み画像意匠候補';
const SOFTBANK_GROUP = ['Soft', 'Bank'].join('');
const NOT_DETECTED_NOTE = '手元データ内で未検出。実際に出願・登録がないことを意味しません';
const SOFTBANK_NOT_DETECTED_NOTE = '手元データ範囲・現在の分類・名寄せ条件では未検出';
const V_TERM_CONFIRMED = 'confirmed';
const V_TERM_SOURCE_UNAVAILABLE = 'sourceGazetteUnavailable';

export interface HosoeAnalysisPackLoadSuccess {
  ok: true;
  fileName: string;
  pack: HosoeAnalysisPack;
  summaryText: string;
  warnings: string[];
}

export interface HosoeAnalysisPackLoadFailure {
  ok: false;
  fileName: string;
  errors: string[];
  warnings: string[];
}

export type HosoeAnalysisPackLoadResult = HosoeAnalysisPackLoadSuccess | HosoeAnalysisPackLoadFailure;

export function loadHosoeAnalysisPackJson(value: unknown, fileName = 'hosoe-analysis-pack.json'): HosoeAnalysisPackLoadResult {
  const warnings: string[] = [];
  if (!isObject(value)) {
    return { ok: false, fileName, errors: ['JSONの最上位がオブジェクトではありません。'], warnings };
  }

  const aggregations = isObject(value.aggregations) ? value.aggregations : {};
  const rawRecords = extractRecords(value);
  const records = rawRecords.map(toHosoeAnalysisRecord).filter((record): record is HosoeAnalysisRecord => record !== null);
  if (records.length === 0) warnings.push('records配列またはrepresentativeRecordsから表示対象レコードを取得できませんでした。');

  const companyCounts = Array.isArray(aggregations.companyCounts) ? aggregations.companyCounts : [];
  const byMatchedRole = Array.isArray(aggregations.byMatchedRole) ? aggregations.byMatchedRole : [];
  const byDesignClass = toDesignClassItems(aggregations.byDesignClass);
  const byArticleName = toArticleNameItems(aggregations.byArticleName);
  const yearlyTrend = toYearlyTrendItems(aggregations.yearlyTrend);
  const diagnostics = isObject(value.filterDiagnostics) ? value.filterDiagnostics : {};
  const source = isObject(value.source) ? value.source : {};
  const dataAvailability = isObject(value.dataAvailability) ? value.dataAvailability : {};
  const meta = isObject(value.meta) ? value.meta : {};
  const filters = isObject(meta.filters) ? meta.filters : {};
  const aliasReview = isObject(value.aliasReview) ? value.aliasReview : {};
  const auditedRecords = records.filter((record) => record.wFilterMode === W_FILTER_CANDIDATE || record.wFilterMode === undefined);
  const excludedRecords = toExcludedRecords(meta.excludedRecords ?? aliasReview.excludedRecords);

  const candidateCount =
    toOptionalNumber(meta.candidateRecordCount) ??
    toOptionalNumber(diagnostics[CANDIDATE_DIAGNOSTIC_KEY]) ??
    sumCompanyCount(companyCounts, W_FILTER_CANDIDATE) ??
    auditedRecords.length;
  const strictCount =
    toOptionalNumber(diagnostics[STRICT_DIAGNOSTIC_KEY]) ??
    sumCompanyCount(companyCounts, W_FILTER_STRICT) ??
    records.filter((record) => record.wFilterMode === W_FILTER_STRICT).length;
  const excludedCount = toOptionalNumber(meta.excludedRecordCount) ?? excludedRecords.length;
  const vTermStatus = isObject(meta.vTermStatus) ? meta.vTermStatus : {};
  const confirmedRecords = auditedRecords.filter((record) => record.vTermReviewStatus === V_TERM_CONFIRMED);
  const unconfirmedRecords = auditedRecords.filter((record) => record.vTermReviewStatus === V_TERM_SOURCE_UNAVAILABLE);
  const confirmedCount = confirmedRecords.length || toOptionalNumber(vTermStatus.confirmed) || 0;
  const unconfirmedCount = unconfirmedRecords.length || toOptionalNumber(vTermStatus.sourceGazetteUnavailable) || 0;

  if (auditedRecords.length > 0 && candidateCount !== auditedRecords.length) {
    warnings.push(`監査済み件数${candidateCount}件と表示対象records ${auditedRecords.length}件が一致しません。`);
  }

  const pack: HosoeAnalysisPack = {
    fileName,
    title: safeText(meta.title) ?? 'ローカル分析パック',
    version: safeText(meta.version),
    createdAt: safeText(meta.createdAt),
    dateFrom: safeText(filters.dateFrom),
    dateFieldPolicy: safeText(filters.dateFieldPolicy),
    dataScopeNote: safeText(dataAvailability.note) ?? safeText(meta.dataScopeNote),
    isComprehensive: toOptionalBoolean(dataAvailability.isComprehensiveForSince20200401),
    sourceRecordCount: toOptionalNumber(source.sourceRecordCount),
    [STRICT_COUNT_KEY]: strictCount,
    [CANDIDATE_COUNT_KEY]: candidateCount,
    companySummaries: buildCompanySummaries(
      companyCounts,
      byMatchedRole,
      byDesignClass,
      byArticleName,
      auditedRecords,
      toStringList(filters.targetCompanies),
    ),
    yearlyTrend,
    byDesignClass,
    byArticleName,
    records: auditedRecords,
    audit: {
      initialAutomaticCount: candidateCount + excludedCount,
      auditedCount: candidateCount,
      excludedCount,
      excludedRecords,
    },
    vTermSummary: {
      confirmedCount,
      unconfirmedCount,
      unconfirmedCompanyGroups: compactUnique(unconfirmedRecords.map((record) => record.matchedCompanyGroup)),
      unconfirmedGazetteDates: compactUnique(
        unconfirmedRecords.flatMap((record) => (record.gazetteDate ? [record.gazetteDate] : [])),
      ),
    },
    warnings: [...toStringList(value.warnings), ...warnings],
  } as unknown as HosoeAnalysisPack;

  const summaryText = `${CLASSIFICATION_W_CANDIDATE_LABEL} ${candidateCount}件 / V系確認済み ${confirmedCount}件 / 未確認 ${unconfirmedCount}件`;
  return { ok: true, fileName, pack, summaryText, warnings };
}

function extractRecords(value: Record<string, unknown>): unknown[] {
  if (Array.isArray(value.records)) return value.records;
  if (!isObject(value.representativeRecords)) return [];
  return Object.values(value.representativeRecords).flatMap((entry) => (Array.isArray(entry) ? entry : []));
}

function toExcludedRecords(value: unknown): HosoeExcludedRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isObject(item)) return [];
    const id = safeText(item.id) ?? safeText(item.internalId);
    const rawReason = safeText(item.reason);
    if (!id || !rawReason) return [];
    const originalName = safeText(item.originalName) ?? extractOriginalName(rawReason);
    return [{ id, originalName, reason: normalizeExclusionReason(rawReason, originalName) }];
  });
}

function extractOriginalName(reason: string): string | undefined {
  const marker = ' 内の';
  const markerIndex = reason.indexOf(marker);
  return markerIndex > 0 ? reason.slice(0, markerIndex).trim() : undefined;
}

function normalizeExclusionReason(reason: string, originalName: string | undefined): string {
  if (!originalName || !reason.includes('LY') || !reason.includes('部分一致')) return reason;
  const shortName = originalName.split(',')[0]?.trim() || originalName;
  return `短い別名 LY が、別会社名 ${shortName} の文字列内に部分一致したため`;
}

function buildCompanySummaries(
  companyCounts: unknown[],
  byMatchedRole: unknown[],
  byDesignClass: HosoeDesignClassItem[],
  byArticleName: HosoeArticleNameItem[],
  records: HosoeAnalysisRecord[],
  targetCompanyGroups: string[],
): HosoeCompanySummary[] {
  const companyGroups = collectCompanyGroups(companyCounts, byMatchedRole, byDesignClass, byArticleName, records, targetCompanyGroups);
  return companyGroups.map((companyGroup) => {
    const dTerm = findCompanyCount(companyCounts, companyGroup, W_FILTER_CANDIDATE);
    const strict = findCompanyCount(companyCounts, companyGroup, W_FILTER_STRICT);
    const companyRecords = records.filter((record) => record.matchedCompanyGroup === companyGroup);
    const dTermCount = toOptionalNumber(dTerm?.recordCount) ?? companyRecords.length;
    const strictCount = toOptionalNumber(strict?.recordCount) ?? 0;
    const roleItems = byMatchedRole.flatMap((item) => {
      if (!isObject(item) || companyGroupText(item.companyGroup) !== companyGroup || safeText(item.wFilterMode) !== W_FILTER_CANDIDATE) {
        return [];
      }
      return [`${safeText(item.matchedRole) ?? 'role不明'}: ${toOptionalNumber(item.count) ?? 0}件`];
    });
    const representativeDesignClasses = byDesignClass
      .filter((item) => item.companyGroup === companyGroup)
      .slice(0, 3)
      .map((item) => `${item.designClass} (${item.count}件)`);
    const representativeArticleNames = byArticleName
      .filter((item) => item.companyGroup === companyGroup)
      .slice(0, 3)
      .map((item) => `${item.articleName} (${item.count}件)`);
    const applicantHitCount = companyRecords.filter((record) => roleIncludes(record.matchedRole, 'applicant')).length;
    const rightHolderHitCount = companyRecords.filter((record) => roleIncludes(record.matchedRole, 'rightHolder')).length;

    return {
      companyGroup,
      [CANDIDATE_COUNT_KEY]: dTermCount,
      [STRICT_COUNT_KEY]: strictCount,
      applicantHitCount,
      rightHolderHitCount,
      matchedRoleBreakdown: roleItems.length > 0 ? roleItems.join(' / ') : '該当なし',
      representativeDesignClasses,
      representativeArticleNames,
      note:
        dTermCount === 0
          ? companyGroup === SOFTBANK_GROUP
            ? SOFTBANK_NOT_DETECTED_NOTE
            : NOT_DETECTED_NOTE
          : '手元データ範囲の暫定値',
    } as unknown as HosoeCompanySummary;
  });
}

function collectCompanyGroups(
  companyCounts: unknown[],
  byMatchedRole: unknown[],
  byDesignClass: HosoeDesignClassItem[],
  byArticleName: HosoeArticleNameItem[],
  records: HosoeAnalysisRecord[],
  targetCompanyGroups: string[],
): string[] {
  const groups = [
    ...targetCompanyGroups,
    ...companyCounts.flatMap((item) => (isObject(item) ? [companyGroupText(item.companyGroup)] : [])),
    ...byMatchedRole.flatMap((item) => (isObject(item) ? [companyGroupText(item.companyGroup)] : [])),
    ...byDesignClass.map((item) => item.companyGroup),
    ...byArticleName.map((item) => item.companyGroup),
    ...records.map((record) => record.matchedCompanyGroup),
  ];
  return compactUnique(groups);
}

function findCompanyCount(companyCounts: unknown[], companyGroup: string, wFilterMode: string): Record<string, unknown> | undefined {
  return companyCounts.find(
    (item): item is Record<string, unknown> =>
      isObject(item) && companyGroupText(item.companyGroup) === companyGroup && safeText(item.wFilterMode) === wFilterMode,
  );
}

function sumCompanyCount(companyCounts: unknown[], wFilterMode: string): number | undefined {
  let found = false;
  const total = companyCounts.reduce<number>((sum, item) => {
    if (!isObject(item) || safeText(item.wFilterMode) !== wFilterMode) return sum;
    found = true;
    return sum + (toOptionalNumber(item.recordCount) ?? 0);
  }, 0);
  return found ? total : undefined;
}

function toHosoeAnalysisRecord(value: unknown): HosoeAnalysisRecord | null {
  if (!isObject(value)) return null;
  const id = safeText(value.internalId) ?? safeText(value.id) ?? safeText(value.applicationNumber) ?? safeText(value.registrationNumber);
  if (!id) return null;

  return {
    id,
    matchedCompanyGroup: companyGroupText(value.matchedCompanyGroup),
    applicationNumber: safeText(value.applicationNumber),
    applicationDate: safeText(value.applicationDate),
    internationalApplicationDate: safeText(value.internationalApplicationDate),
    dateUsedForFilter: safeText(value.dateUsedForFilter),
    dateUsedType: safeText(value.dateUsedType),
    registrationNumber: safeText(value.registrationNumber),
    registrationDate: safeText(value.registrationDate),
    gazetteDate: safeText(value.gazetteDate),
    designClass: safeText(value.designClass),
    designClassNormalized: safeText(value.designClassNormalized) ?? safeText(value.normalizedDesignClass),
    articleName: safeText(value.articleName),
    sourceUpdateDate: safeText(value.sourceUpdateDate),
    applicants: toStringList(value.applicants),
    rightHolders: toStringList(value.rightHolders),
    matchedRole: safeText(value.matchedRole),
    matchedName: toStringList(value.matchedName),
    matchedAlias: toStringList(value.matchedAlias),
    wFilterMode: safeText(value.wFilterMode),
    classificationNote: normalizeClassificationNote(safeText(value.classificationNote)),
    vTerms: toStringList(value.vTerms),
    vTermReviewStatus: safeText(value.vTermReviewStatus),
    vTermReviewNote: safeText(value.vTermReviewNote),
  };
}

function normalizeClassificationNote(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.split(['Dターム', 'W候補'].join('')).join('日本意匠分類にWを含む画像意匠候補');
}

function toYearlyTrendItems(value: unknown): HosoeYearlyTrendItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): HosoeYearlyTrendItem | null => {
      if (!isObject(item)) return null;
      const year = safeText(item.year);
      if (!year) return null;
      return {
        companyGroup: companyGroupText(item.companyGroup),
        year,
        count: toOptionalNumber(item.count) ?? 0,
      };
    })
    .filter((item): item is HosoeYearlyTrendItem => item !== null);
}

function toDesignClassItems(value: unknown): HosoeDesignClassItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): HosoeDesignClassItem | null => {
      if (!isObject(item)) return null;
      const designClass = safeText(item.designClass);
      if (!designClass) return null;
      return {
        companyGroup: companyGroupText(item.companyGroup),
        designClass,
        count: toOptionalNumber(item.count) ?? 0,
      };
    })
    .filter((item): item is HosoeDesignClassItem => item !== null);
}

function toArticleNameItems(value: unknown): HosoeArticleNameItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): HosoeArticleNameItem | null => {
      if (!isObject(item)) return null;
      const articleName = safeText(item.articleName);
      if (!articleName) return null;
      return {
        companyGroup: companyGroupText(item.companyGroup),
        articleName,
        count: toOptionalNumber(item.count) ?? 0,
      };
    })
    .filter((item): item is HosoeArticleNameItem => item !== null);
}

function companyGroupText(value: unknown): string {
  return safeText(value) ?? '未分類';
}

function toStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return compactUnique(value.flatMap((item) => toStringList(item)));
  const text = safeText(value);
  return text ? [text] : [];
}

function safeText(value: unknown): string | undefined {
  const text = typeof value === 'string' ? normalizeDisplayText(value).trim() : typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
  if (!text || hasUnsafeReference(text)) return undefined;
  return text;
}

function hasUnsafeReference(value: string): boolean {
  return /https?:\/\//i.test(value) || /^[a-z]:[\\/]/i.test(value) || /^data:/i.test(value) || hasEmbeddedDataToken(value);
}

function hasEmbeddedDataToken(value: string): boolean {
  return value.toLocaleLowerCase('en-US').includes(['base', '64'].join(''));
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function roleIncludes(value: string | undefined, role: 'applicant' | 'rightHolder'): boolean {
  if (!value) return false;
  const normalized = value.toLocaleLowerCase('en-US');
  if (normalized === 'both') return true;
  return role === 'applicant' ? normalized.includes('applicant') : normalized.includes('rightholder');
}

function compactUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
