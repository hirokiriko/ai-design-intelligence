import type { AnalysisRequest, DesignKind, DesignRecord, GazetteDrawingKeys, GazetteDrawingRef, Period } from '../domain/types';
import type { DesignDataSource } from './SampleDesignDataSource';

export interface LocalJpoIntegratedJson {
  recordCount?: number;
  records: LocalJpoDesignRecord[];
  dataPeriodKind?: unknown;
  periodType?: unknown;
  dataDate?: unknown;
  dataPeriodLabel?: unknown;
  includedWeeklyDates?: unknown;
  analysisDate?: string;
  analysisDateBasis?: string;
}

export interface LocalJpoDesignRecord {
  id?: unknown;
  sourceDataset?: unknown;
  sourceUpdateDate?: unknown;
  sourceUpdateDates?: unknown;
  sourceWeeklyDates?: unknown;
  firstSeenUpdateDate?: unknown;
  lastSeenUpdateDate?: unknown;
  applicationNumber?: unknown;
  applicationDate?: unknown;
  registrationNumber?: unknown;
  registrationDate?: unknown;
  gazetteDate?: unknown;
  analysisDate?: unknown;
  analysisDateBasis?: unknown;
  designClass?: unknown;
  articleName?: unknown;
  designDescription?: unknown;
  articleDescription?: unknown;
  applicants?: unknown;
  applicantsDisplay?: unknown;
  applicantsNormalized?: unknown;
  unresolvedApplicants?: unknown;
  rightHolders?: unknown;
  unresolvedRightHolders?: unknown;
  creators?: unknown;
  agents?: unknown;
  priorityClaims?: unknown;
  rawKeys?: unknown;
  sourceFiles?: unknown;
  gazetteDrawingKeys?: unknown;
}

export interface LocalJpoValidationResult {
  errors: string[];
  warnings: string[];
  recordIds: string[];
}

export interface RankedItem {
  label: string;
  count: number;
}

export type LocalJpoDataPeriodKind = 'daily' | 'weekly' | 'monthly_preview' | 'local';

export interface LocalJpoDatasetSummary {
  fileName: string;
  dailyDataDate?: string;
  dataPeriodKind: LocalJpoDataPeriodKind;
  dataPeriodDate?: string;
  totalRecords: number;
  sourceUpdateDateFrom?: string;
  sourceUpdateDateTo?: string;
  gazetteDateFrom?: string;
  gazetteDateTo?: string;
  registrationNumberCount: number;
  applicantsInfoCount: number;
  namedPartyRecordCount: number;
  unresolvedCodeRecordCount: number;
  unresolvedApplicantsCount: number;
  rightHoldersCount: number;
  unresolvedRightHoldersCount: number;
  gazetteDrawingKeysCount: number;
  drawingRefsRecordCount: number;
  drawingRefTotalCount: number;
  gazetteDateMismatchCount: number;
  topDesignClasses: RankedItem[];
  topArticleNames: RankedItem[];
  topParties: RankedItem[];
  topUnresolvedCodes: RankedItem[];
  priorityClaims: { withClaims: number; withoutClaims: number };
  agents: { withAgents: number; withoutAgents: number };
  inferredDesignKindCount: number;
}

export interface LocalJpoLoadSuccess {
  ok: true;
  fileName: string;
  dataSource: LocalJpoJsonDataSource;
  summary: LocalJpoDatasetSummary;
  warnings: string[];
}

export interface LocalJpoLoadFailure {
  ok: false;
  fileName: string;
  errors: string[];
  warnings: string[];
}

export type LocalJpoLoadResult = LocalJpoLoadSuccess | LocalJpoLoadFailure;

export class LocalJpoJsonDataSource implements DesignDataSource {
  private readonly records: DesignRecord[];
  private readonly dataAsOf: string;

  constructor(json: LocalJpoIntegratedJson, private readonly fileName: string) {
    this.records = json.records
      .map((record, index) => convertLocalJpoRecord(record, index))
      .filter((record): record is DesignRecord => record !== null)
      .sort((left, right) => right.gazetteDate.localeCompare(left.gazetteDate));
    this.dataAsOf = maxDate(this.records.map((record) => record.gazetteDate)) ?? todayIsoDate();
  }

  query(req: AnalysisRequest): Promise<DesignRecord[]> {
    const fromDate = getPeriodStart(this.dataAsOf, req.period);
    const productQuery = normalize(req.productDomain ?? '');
    const companies =
      req.scope.mode === 'companies'
        ? req.scope.companies.map((company) => normalize(company)).filter(Boolean)
        : [];
    const includeUnresolvedApplicants = req.includeUnresolvedApplicants ?? true;

    const records = this.records
      .filter((record) => new Date(`${record.gazetteDate}T00:00:00`) >= fromDate)
      .filter((record) => req.designKinds.includes(record.designKind))
      .filter((record) => includeUnresolvedApplicants || (record.unresolvedApplicants ?? []).length === 0)
      .filter((record) => companies.length === 0 || companies.some((company) => matchesParty(record, company)))
      .filter((record) => (productQuery ? matchesProductDomain(record, productQuery) : true));

    return Promise.resolve(records);
  }

  getDataAsOf(): string {
    return this.dataAsOf;
  }

  getAllRecords(): DesignRecord[] {
    return [...this.records];
  }

  getFileName(): string {
    return this.fileName;
  }
}

export function loadLocalJpoJson(value: unknown, fileName = 'local-jpo.json'): LocalJpoLoadResult {
  const validation = validateLocalJpoJson(value);
  if (validation.errors.length > 0 || !isObject(value) || !Array.isArray(value.records)) {
    return {
      ok: false,
      fileName,
      errors: validation.errors.length > 0 ? validation.errors : ['records配列が見つかりません。'],
      warnings: validation.warnings,
    };
  }

  const json = value as unknown as LocalJpoIntegratedJson;
  const dataSource = new LocalJpoJsonDataSource(json, fileName);
  const convertedRecords = dataSource.getAllRecords();
  const skippedCount = json.records.length - convertedRecords.length;
  const warnings = [
    ...validation.warnings,
    ...(skippedCount > 0 ? [`idがない、またはJSONオブジェクトではないレコード ${skippedCount}件を読み飛ばしました。`] : []),
  ];

  return {
    ok: true,
    fileName,
    dataSource,
    summary: summarizeLocalJpoRecords(convertedRecords, fileName, json),
    warnings,
  };
}

export function validateLocalJpoJson(value: unknown): LocalJpoValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recordIds: string[] = [];

  if (!isObject(value)) {
    return { errors: ['JSONの最上位がオブジェクトではありません。'], warnings, recordIds };
  }

  if (!Array.isArray(value.records)) {
    return { errors: ['records配列が存在しません。'], warnings, recordIds };
  }

  const declaredCount = typeof value.recordCount === 'number' ? value.recordCount : undefined;
  if (declaredCount !== undefined && declaredCount !== value.records.length) {
    warnings.push(`recordCount (${declaredCount}) と records.length (${value.records.length}) が一致しません。`);
  }

  const seenIds = new Set<string>();
  value.records.forEach((record, index) => {
    if (!isObject(record)) {
      warnings.push(`${index + 1}件目はJSONオブジェクトではありません。`);
      return;
    }

    const id = toOptionalString(record.id);
    if (!id) {
      warnings.push(`${index + 1}件目にidがありません。`);
    } else {
      recordIds.push(id);
      if (seenIds.has(id)) warnings.push(`id "${id}" が重複しています。`);
      seenIds.add(id);
    }

    if (!toOptionalString(record.gazetteDate)) warnings.push(`${id || `${index + 1}件目`} にgazetteDateがありません。`);
    if (!toOptionalString(record.articleName)) warnings.push(`${id || `${index + 1}件目`} にarticleNameがありません。`);
    if (!toOptionalString(record.designClass)) warnings.push(`${id || `${index + 1}件目`} にdesignClassがありません。`);
    if (!toOptionalString(record.registrationNumber)) warnings.push(`${id || `${index + 1}件目`} にregistrationNumberがありません。`);

    const applicants = toStringList(record.applicants).length + toStringList(record.applicantsDisplay).length;
    const rightHolders = toStringList(record.rightHolders).length;
    if (applicants === 0 && rightHolders === 0) {
      warnings.push(`${id || `${index + 1}件目`} にapplicantsまたはrightHoldersがありません。`);
    }
  });

  if (recordIds.length === 0) {
    warnings.push('evidenceIds参照用のid一覧を作成できません。idを持つレコードがありません。');
  }

  return { errors, warnings, recordIds };
}

export function convertLocalJpoRecord(record: LocalJpoDesignRecord, index = 0): DesignRecord | null {
  if (!isObject(record)) return null;
  const id = toOptionalString(record.id);
  if (!id) return null;

  const applicants = toPartyList(record.applicants);
  const applicantsDisplay = toOptionalString(record.applicantsDisplay) ?? applicants.join('、');
  const applicantsNormalized = toPartyList(record.applicantsNormalized);
  const unresolvedApplicants = toCodeList(record.unresolvedApplicants);
  const rightHolders = toPartyList(record.rightHolders);
  const unresolvedRightHolders = toCodeList(record.unresolvedRightHolders);
  const designClass = toOptionalString(record.designClass) ?? '分類未設定';
  const articleName = toOptionalString(record.articleName) ?? '物品名未設定';
  const designDescription = toOptionalString(record.designDescription);
  const articleDescription = toOptionalString(record.articleDescription);
  const designKind = inferDesignKind({ designClass, articleName, designDescription, articleDescription });
  const sourceUpdateDate =
    toOptionalString(record.sourceUpdateDate) ??
    toOptionalString(record.lastSeenUpdateDate) ??
    toOptionalString(record.firstSeenUpdateDate) ??
    toStringList(record.sourceUpdateDates)[0] ??
    toStringList(record.sourceWeeklyDates)[0];
  const applicant =
    displayPartyLabel(applicantsDisplay) ||
    displayPartyLabel(applicantsNormalized[0]) ||
    displayPartyLabel(applicants[0]) ||
    displayPartyLabel(rightHolders[0]) ||
    displayPartyLabel(unresolvedApplicants[0]) ||
    '名称未補完';
  const sourceDataset = toOptionalString(record.sourceDataset);

  return {
    id,
    sourceDataset,
    sourceUpdateDate,
    applicationNumber: toOptionalString(record.applicationNumber),
    applicationDate: toOptionalString(record.applicationDate),
    registrationNumber: toOptionalString(record.registrationNumber),
    registrationDate: toOptionalString(record.registrationDate),
    gazetteDate: toOptionalString(record.gazetteDate) ?? todayIsoDate(),
    applicant,
    applicants,
    applicantsDisplay,
    applicantsNormalized,
    unresolvedApplicants,
    rightHolders,
    unresolvedRightHolders,
    creators: toPartyList(record.creators),
    agents: toPartyList(record.agents),
    priorityClaims: toStringList(record.priorityClaims),
    rawKeys: toStringList(record.rawKeys),
    sourceFiles: toStringList(record.sourceFiles),
    gazetteDrawingKeys: toGazetteDrawingKeys(record.gazetteDrawingKeys),
    businessDomain: `意匠分類 ${designClass}`,
    designKind,
    designKindInferred: true,
    articleName,
    designClass,
    keywords: compactUnique([
      designClass,
      articleName,
      ...splitTerms(designDescription),
      ...splitTerms(articleDescription),
    ]).slice(0, 12),
    designFeatures: compactUnique([...splitTerms(designDescription), ...splitTerms(articleDescription)]).slice(0, 12),
    designDescription,
    articleDescription,
    summary: [designDescription, articleDescription].filter(Boolean).join(' / ') || `${articleName}（${designClass}）`,
    sourceLabel: 'ローカル実データJSON',
    isSample: false,
    gazetteNumber: sourceDataset ? `${sourceDataset}-${index + 1}` : undefined,
  };
}

export function summarizeLocalJpoRecords(records: DesignRecord[], fileName: string, metadata?: LocalJpoIntegratedJson): LocalJpoDatasetSummary {
  const period = inferDataPeriod(fileName, metadata);
  const sourceUpdateDates = compactUnique([
    ...toStringList(metadata?.includedWeeklyDates),
    ...records.map((record) => record.sourceUpdateDate),
  ]);
  return {
    fileName,
    dailyDataDate: period.kind === 'daily' ? period.date : undefined,
    dataPeriodKind: period.kind,
    dataPeriodDate: period.date,
    totalRecords: records.length,
    sourceUpdateDateFrom: minDate(sourceUpdateDates),
    sourceUpdateDateTo: maxDate(sourceUpdateDates),
    gazetteDateFrom: minDate(records.map((record) => record.gazetteDate)),
    gazetteDateTo: maxDate(records.map((record) => record.gazetteDate)),
    registrationNumberCount: records.filter((record) => Boolean(record.registrationNumber)).length,
    applicantsInfoCount: records.filter((record) => (record.applicants ?? []).length > 0 || Boolean(record.applicantsDisplay)).length,
    namedPartyRecordCount: records.filter((record) => namedPartyLabels(record).length > 0).length,
    unresolvedCodeRecordCount: records.filter((record) => unresolvedCodeLabels(record).length > 0).length,
    unresolvedApplicantsCount: records.filter((record) => (record.unresolvedApplicants ?? []).length > 0).length,
    rightHoldersCount: records.filter((record) => (record.rightHolders ?? []).length > 0).length,
    unresolvedRightHoldersCount: records.filter((record) => (record.unresolvedRightHolders ?? []).length > 0).length,
    gazetteDrawingKeysCount: records.filter((record) => Boolean(record.gazetteDrawingKeys)).length,
    drawingRefsRecordCount: records.filter((record) => (record.gazetteDrawingKeys?.drawingRefs ?? []).length > 0).length,
    drawingRefTotalCount: records.reduce((total, record) => total + (record.gazetteDrawingKeys?.drawingRefs ?? []).length, 0),
    gazetteDateMismatchCount: records.filter((record) => record.gazetteDrawingKeys?.gazetteDateMismatch === true).length,
    topDesignClasses: topRank(records.map((record) => record.designClass), 6),
    topArticleNames: topRank(records.map((record) => record.articleName), 6),
    topParties: topRank(records.flatMap((record) => partyLabels(record)), 8),
    topUnresolvedCodes: topRank(records.flatMap((record) => unresolvedCodeLabels(record)), 12),
    priorityClaims: {
      withClaims: records.filter((record) => (record.priorityClaims ?? []).length > 0).length,
      withoutClaims: records.filter((record) => (record.priorityClaims ?? []).length === 0).length,
    },
    agents: {
      withAgents: records.filter((record) => (record.agents ?? []).length > 0).length,
      withoutAgents: records.filter((record) => (record.agents ?? []).length === 0).length,
    },
    inferredDesignKindCount: records.filter((record) => record.designKindInferred).length,
  };
}

export function sanitizeAnalysisEvidenceIds(result: import('../domain/types').AnalysisResult, records: DesignRecord[]): string[] {
  const validIds = new Set(records.map((record) => record.id));
  const warnings: string[] = [];
  const sanitize = (insight: import('../domain/types').AnalysisInsight, label: string) => {
    const before = insight.evidenceIds;
    const after = before.filter((id) => validIds.has(id));
    const removed = before.filter((id) => !validIds.has(id));
    if (removed.length > 0) {
      warnings.push(`${label} のevidenceIdsから存在しないIDを除外しました: ${removed.join('、')}`);
      insight.evidenceIds = after;
    }
  };

  if (result.market) {
    sanitize(result.market.trends, '市場・商品トレンド');
    sanitize(result.market.emergingDomains, '新商品領域');
    sanitize(result.market.companyMoves, '企業動向');
  }

  for (const company of result.companies) {
    Object.entries(company.designTrend).forEach(([key, insight]) => sanitize(insight, `${company.company}.${key}`));
    Object.entries(company.dxDevTrend).forEach(([key, insight]) => sanitize(insight, `${company.company}.${key}`));
    Object.entries(company.designChange).forEach(([key, insight]) => sanitize(insight, `${company.company}.${key}`));
    Object.entries(company.portfolio).forEach(([key, insight]) => sanitize(insight, `${company.company}.${key}`));
    Object.entries(company.ipStrategy).forEach(([key, insight]) => sanitize(insight, `${company.company}.${key}`));
  }

  return warnings;
}

function getPeriodStart(dataAsOf: string, period: Period): Date {
  const start = new Date(`${dataAsOf}T00:00:00`);
  start.setFullYear(start.getFullYear() - (period === 'last_1y' ? 1 : 2));
  return start;
}

function matchesParty(record: DesignRecord, companyQuery: string): boolean {
  return [
    record.applicant,
    record.applicantsDisplay,
    ...(record.applicants ?? []),
    ...(record.applicantsNormalized ?? []),
    ...(record.rightHolders ?? []),
    ...(record.unresolvedApplicants ?? []).map((code) => `未解決コード: ${code}`),
  ]
    .map((value) => normalize(value ?? ''))
    .some((value) => value.includes(companyQuery));
}

function matchesProductDomain(record: DesignRecord, query: string): boolean {
  const target = [
    record.businessDomain,
    record.articleName,
    record.designClass,
    record.designDescription,
    record.articleDescription,
    record.summary,
    ...record.keywords,
    ...record.designFeatures,
  ]
    .filter(Boolean)
    .map((value) => normalize(String(value)))
    .join(' ');

  return query
    .split(/\s+|\/|、|・/)
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => target.includes(token));
}

function inferDesignKind(fields: {
  designClass: string;
  articleName: string;
  designDescription?: string;
  articleDescription?: string;
}): DesignKind {
  const haystack = normalize([fields.designClass, fields.articleName, fields.designDescription, fields.articleDescription].filter(Boolean).join(' '));
  if (/画像|画面|gui|ui|アイコン|表示|操作画面|インターフェース|interface/.test(haystack)) return 'image';
  if (/内装|空間|店舗|施設|建築|室内|インテリア|ブース|ショールーム/.test(haystack)) return 'interior';
  return 'article';
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = normalizeDisplayText(value).trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function toStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return compactUnique(value.flatMap((item) => toStringList(item)));
  if (typeof value === 'string') return normalizeDisplayText(value).split(/[、,\n]/).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (isObject(value)) {
    const preferred = ['displayName', 'name', 'normalizedName', 'applicantName', 'rightHolderName', 'creatorName', 'agentName', 'code', 'id'];
    for (const key of preferred) {
      const extracted = toOptionalString(value[key]);
      if (extracted) return [extracted];
    }
    return Object.values(value).flatMap((item) => toStringList(item)).slice(0, 4);
  }
  return [];
}

function toGazetteDrawingKeys(value: unknown): GazetteDrawingKeys | null {
  if (!isObject(value)) return null;

  const drawingRefs = Array.isArray(value.drawingRefs)
    ? value.drawingRefs.map((item) => toGazetteDrawingRef(item)).filter((item): item is GazetteDrawingRef => item !== null)
    : [];
  const drawingRefCount = toOptionalNumber(value.drawingRefCount) ?? drawingRefs.length;
  const hasDrawingRefs = typeof value.hasDrawingRefs === 'boolean' ? value.hasDrawingRefs : drawingRefs.length > 0;
  const source = safeText(value.source) ?? 'registered_design_gazette';

  return {
    source,
    issueDate: safeText(value.issueDate) ?? null,
    issueNumber: safeText(value.issueNumber) ?? null,
    matchedBy: safeText(value.matchedBy) ?? null,
    gazetteDateFromXml: safeText(value.gazetteDateFromXml) ?? null,
    gazetteDateMismatch: value.gazetteDateMismatch === true,
    gazetteNumber: safeText(value.gazetteNumber) ?? null,
    publicationDocumentId: safeText(value.publicationDocumentId) ?? null,
    hasDrawingRefs,
    drawingRefCount,
    drawingRefs,
    sourceXmlFile: safeRelativePath(value.sourceXmlFile) ?? null,
    note: safeText(value.note),
  };
}

function toGazetteDrawingRef(value: unknown): GazetteDrawingRef | null {
  if (!isObject(value)) return null;
  return {
    label: safeText(value.label) ?? null,
    fileName: safeFileName(value.fileName) ?? null,
    fileType: safeText(value.fileType) ?? null,
    order: toOptionalNumber(value.order) ?? null,
    isRepresentativeCandidate: value.isRepresentativeCandidate === true,
    sourceXmlFile: safeRelativePath(value.sourceXmlFile) ?? null,
  };
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function safeText(value: unknown): string | undefined {
  const text = toOptionalString(value);
  if (!text || hasUnsafeReference(text)) return undefined;
  return text;
}

function safeRelativePath(value: unknown): string | undefined {
  const text = toOptionalString(value)?.replace(/\\/g, '/');
  if (!text || hasUnsafeReference(text) || text.startsWith('/') || text.includes('../') || text.startsWith('../')) return undefined;
  return text;
}

function safeFileName(value: unknown): string | undefined {
  const text = toOptionalString(value)?.replace(/\\/g, '/');
  if (!text || /https?:\/\//i.test(text) || /^data:/i.test(text) || hasEmbeddedDataToken(text)) return undefined;
  const fileName = text.split('/').filter(Boolean).pop();
  return fileName && !hasUnsafeReference(fileName) ? fileName : undefined;
}

function hasUnsafeReference(value: string): boolean {
  return /https?:\/\//i.test(value) || /^[a-z]:[\\/]/i.test(value) || /^data:/i.test(value) || hasEmbeddedDataToken(value);
}

function hasEmbeddedDataToken(value: string): boolean {
  return value.toLocaleLowerCase('en-US').includes(['base', '64'].join(''));
}

function toPartyList(value: unknown): string[] {
  return compactUnique(toStringList(value).map((item) => item.trim()).filter(Boolean));
}

function toCodeList(value: unknown): string[] {
  return compactUnique(toStringList(value).map((item) => item.trim()).filter(Boolean));
}

function partyLabels(record: DesignRecord): string[] {
  const named = namedPartyLabels(record);
  return named.length > 0 ? named : unresolvedCodeLabels(record);
}

function namedPartyLabels(record: DesignRecord): string[] {
  const candidates = compactUnique([
    record.applicantsDisplay,
    ...(record.applicants ?? []),
    ...(record.applicantsNormalized ?? []),
    ...(record.rightHolders ?? []),
  ]);
  return candidates.filter((label) => !isCodeOnlyLabel(label)).map((label) => displayPartyLabel(label) ?? label);
}

function unresolvedCodeLabels(record: DesignRecord): string[] {
  const candidates = compactUnique([
    record.applicantsDisplay,
    ...(record.applicants ?? []),
    ...(record.applicantsNormalized ?? []),
    ...(record.rightHolders ?? []),
  ]);
  return compactUnique([
    ...(record.unresolvedApplicants ?? []),
    ...(record.unresolvedRightHolders ?? []),
    ...candidates.filter((label) => isCodeOnlyLabel(label)),
  ]).map((code) => displayPartyLabel(code) ?? code);
}

export function displayPartyLabel(value?: string): string | undefined {
  const trimmed = normalizeDisplayText(value ?? '').trim();
  if (!trimmed) return undefined;
  return isCodeOnlyLabel(trimmed) ? `未解決コード: ${trimmed.replace(/^code:/i, '').trim()}` : trimmed;
}

function isCodeOnlyLabel(value: string): boolean {
  return /^(code:)?\d{5,}$/i.test(value.trim());
}

function topRank(values: string[], limit: number): RankedItem[] {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ja-JP'))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function splitTerms(value?: string): string[] {
  return (value ?? '')
    .split(/[\s、。・,.;:（）()「」『』【】\\/-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !isStopWord(term));
}

function compactUnique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function minDate(values: string[]): string | undefined {
  const dates = values.filter(Boolean).sort((left, right) => left.localeCompare(right));
  return dates[0];
}

function maxDate(values: string[]): string | undefined {
  const dates = values.filter(Boolean).sort((left, right) => right.localeCompare(left));
  return dates[0];
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeDisplayText(value: string): string {
  return value
    .replace(/\u3000/g, ' ')
    .replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function inferDataPeriod(fileName: string, metadata?: LocalJpoIntegratedJson): { kind: LocalJpoDataPeriodKind; date?: string } {
  const metadataKind = normalizeDataPeriodKind(toOptionalString(metadata?.dataPeriodKind) ?? toOptionalString(metadata?.periodType));
  const metadataDate = toOptionalString(metadata?.dataDate);
  const lower = fileName.toLocaleLowerCase('en-US');
  const inferredKind: LocalJpoDataPeriodKind = lower.includes('monthly-preview') || lower.includes('monthly_preview')
    ? 'monthly_preview'
    : lower.includes('weekly')
      ? 'weekly'
      : lower.includes('daily') || lower.includes('design-records-')
        ? 'daily'
        : 'local';
  const kind = metadataKind ?? inferredKind;
  const dateMatch = kind === 'monthly_preview' ? fileName.match(/(\d{4})(\d{2})(?!\d)/) : fileName.match(/(\d{4})(\d{2})(\d{2})/);
  return {
    kind,
    date: metadataDate ?? (dateMatch ? (kind === 'monthly_preview' ? `${dateMatch[1]}-${dateMatch[2]}` : `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) : undefined),
  };
}

function normalizeDataPeriodKind(value?: string): LocalJpoDataPeriodKind | undefined {
  const normalized = value?.trim().toLocaleLowerCase('en-US').replace(/-/g, '_');
  if (normalized === 'monthly_preview') return 'monthly_preview';
  if (normalized === 'weekly') return 'weekly';
  if (normalized === 'daily') return 'daily';
  if (normalized === 'local') return 'local';
  return undefined;
}

const STOP_WORDS = new Set([
  '部分',
  '意匠登録',
  '本物品',
  '実線',
  '参考図',
  '正面図',
  '背面図',
  '左側面図',
  '右側面図',
  '平面図',
  '底面図',
  '状態',
  '使用状態',
  '図',
  '画像図',
  '変化',
  '形状',
  '特定',
  'in',
  'on',
  'of',
  'for',
  'to',
  'and',
  'or',
  'the',
  'a',
  'an',
  'as',
  'by',
  'with',
  'from',
  'show',
  'design',
  'characteristic',
  'portion',
  'thereof',
  'outermost',
  'view',
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
  'figure',
  'fig',
  'perspective',
  'shown',
  'solid',
  'broken',
  'line',
  'lines',
]);

function isStopWord(term: string): boolean {
  return STOP_WORDS.has(normalizeDisplayText(term).toLocaleLowerCase('en-US'));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
