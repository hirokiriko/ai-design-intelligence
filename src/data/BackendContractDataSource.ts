import type {
  AnalysisReadyDesignRecord,
  AnalysisReadyDesignRecordBase,
  BackendCompanyMembership,
  ClassificationMembership,
  CompanySelector,
} from '../domain/analysisRecords';
import {
  companyMembershipKey,
  companySelectorKey,
  companySelectorMatchesMembership,
} from '../domain/analysisRecords';
import type { AnalysisRequest, DesignKind, Period } from '../domain/types';

export const BACKEND_CONTRACT_VERSION = '0.1.0' as const;

export type BackendPartyRole = 'applicant' | 'right_holder';
export type BackendResolutionStatus = 'resolved' | 'unresolved';
export type BackendUnresolvedReason =
  | 'no_exact_match'
  | 'ambiguous_match'
  | 'missing_master'
  | 'invalid_source_value';
export type BackendQualityState = 'pass' | 'warning' | 'quarantined';
export type BackendQualitySeverity = 'info' | 'warning' | 'error';
export type BackendDesignType = DesignKind | 'unknown';

export interface BackendPartyV010 {
  role: BackendPartyRole;
  rawName: string | null;
  displayName: string | null;
  normalizedNameCandidate: string | null;
  resolvedEntityId: string | null;
  resolutionStatus: BackendResolutionStatus;
  sourceRef: string;
}

export interface BackendUnresolvedPartyV010 {
  rawValue: string;
  code: string | null;
  reason: BackendUnresolvedReason;
  sourceRef: string;
}

export interface BackendClassificationV010 {
  scheme: string;
  code: string;
  label: string | null;
  isPrimary: boolean;
}

export interface BackendPublicationV010 {
  gazetteNumber: string | null;
  publicationDocumentId: string | null;
  issueDate: string | null;
  sourceRef: string;
}

export interface BackendDrawingV010 {
  drawingId: string;
  label: string | null;
  fileName: string | null;
  mediaType: string | null;
  order: number;
  isRepresentativeCandidate: boolean;
  sourceDocumentRef: string;
}

export interface BackendQualityFindingV010 {
  code: string;
  severity: BackendQualitySeverity;
  message: string;
  path: string;
}

export interface BackendProvenanceV010 {
  sourceDatasets: string[];
  sourceArtifactRefs: string[];
  processingRunId: string;
  parserVersion: string;
  normalizationVersion: string;
  sourceRecordLocator: string;
}

export interface BackendQualityV010 {
  state: BackendQualityState;
  findings: BackendQualityFindingV010[];
  duplicateCandidates: string[];
}

export interface BackendDesignRecordV010 {
  id: string;
  applicationNumber: string | null;
  applicationDate?: string | null;
  registrationNumber: string | null;
  registrationDate?: string | null;
  gazetteDate: string | null;
  articleName: string | null;
  description?: string | null;
  articleDescription?: string | null;
  designType: BackendDesignType;
  keywords?: string[];
  designFeatures?: string[];
  applicants: BackendPartyV010[];
  rightHolders: BackendPartyV010[];
  classifications: BackendClassificationV010[];
  publication: BackendPublicationV010 | null;
  drawings: BackendDrawingV010[];
  unresolved: {
    applicants: BackendUnresolvedPartyV010[];
    rightHolders: BackendUnresolvedPartyV010[];
  };
  provenance: BackendProvenanceV010;
  quality: BackendQualityV010;
  sourceUpdatedAt: string;
  backendProcessingVersion: string;
}

export interface BackendDesignExportV010 {
  contractVersion: typeof BACKEND_CONTRACT_VERSION;
  exportId: string;
  generatedAt: string;
  sourceUpdatedAt: string;
  backendProcessingVersion: string;
  recordCount: number;
  records: BackendDesignRecordV010[];
}

export type DatasetAdapterErrorCode =
  | 'MALFORMED_JSON'
  | 'INVALID_ENVELOPE'
  | 'UNSUPPORTED_CONTRACT_VERSION'
  | 'CONTRACT_VALIDATION_FAILED'
  | 'UNSAFE_PUBLIC_PROVENANCE';

export interface DatasetAdapterError {
  code: DatasetAdapterErrorCode;
  path: string;
  message: string;
}

export type AdapterExclusionCode =
  | 'QUALITY_QUARANTINED'
  | 'MISSING_GAZETTE_DATE'
  | 'GAZETTE_DATE_AFTER_CUTOFF'
  | 'UNKNOWN_DESIGN_TYPE';

export type AdapterNoticeCode =
  | 'QUALITY_WARNING'
  | 'UNRESOLVED_APPLICANT'
  | 'UNRESOLVED_RIGHT_HOLDER'
  | 'DUPLICATE_CANDIDATE';

export interface AdapterNotice {
  code: AdapterNoticeCode;
  recordId: string;
  path: string;
  message: string;
}

export interface BackendRecordDisposition {
  status: 'accepted' | 'excluded';
  exclusionReasons: AdapterExclusionCode[];
}

export interface BackendRecordViewModel extends BackendDesignRecordV010 {
  adapterDisposition: BackendRecordDisposition;
}

export interface ExcludedBackendRecord {
  id: string;
  exclusionReasons: AdapterExclusionCode[];
  quality: BackendQualityV010;
}

export interface BackendAdapterSummary {
  totalRecordCount: number;
  acceptedCount: number;
  warningCount: number;
  quarantinedCount: number;
  excludedCount: number;
  unknownDesignTypeCount: number;
  missingGazetteDateCount: number;
  unresolvedApplicantCount: number;
  unresolvedRightHolderCount: number;
  unresolvedPartyCount: number;
}

export interface BackendContractAdapterSuccess {
  ok: true;
  meta: {
    contractVersion: typeof BACKEND_CONTRACT_VERSION;
    exportId: string;
    generatedAt: string;
    sourceUpdatedAt: string;
    backendProcessingVersion: string;
    analysisCutoff: string;
  };
  records: BackendRecordViewModel[];
  analysisRecords: AnalysisReadyDesignRecord[];
  excludedRecords: ExcludedBackendRecord[];
  notices: AdapterNotice[];
  summary: BackendAdapterSummary;
}

export interface BackendContractAdapterFailure {
  ok: false;
  detectedContractVersion?: string;
  errors: DatasetAdapterError[];
}

export type BackendContractAdapterResult = BackendContractAdapterSuccess | BackendContractAdapterFailure;

type JsonObject = Record<string, unknown>;

const ENVELOPE_REQUIRED = [
  'contractVersion',
  'exportId',
  'generatedAt',
  'sourceUpdatedAt',
  'backendProcessingVersion',
  'recordCount',
  'records',
] as const;

const RECORD_REQUIRED = [
  'id',
  'applicationNumber',
  'registrationNumber',
  'gazetteDate',
  'articleName',
  'designType',
  'applicants',
  'rightHolders',
  'classifications',
  'publication',
  'drawings',
  'unresolved',
  'provenance',
  'quality',
  'sourceUpdatedAt',
  'backendProcessingVersion',
] as const;

const RECORD_OPTIONAL = [
  'applicationDate',
  'registrationDate',
  'description',
  'articleDescription',
  'keywords',
  'designFeatures',
] as const;

const PARTY_REQUIRED = [
  'role',
  'rawName',
  'displayName',
  'normalizedNameCandidate',
  'resolvedEntityId',
  'resolutionStatus',
  'sourceRef',
] as const;

const UNRESOLVED_PARTY_REQUIRED = ['rawValue', 'code', 'reason', 'sourceRef'] as const;
const CLASSIFICATION_REQUIRED = ['scheme', 'code', 'label', 'isPrimary'] as const;
const PUBLICATION_REQUIRED = ['gazetteNumber', 'publicationDocumentId', 'issueDate', 'sourceRef'] as const;
const DRAWING_REQUIRED = [
  'drawingId',
  'label',
  'fileName',
  'mediaType',
  'order',
  'isRepresentativeCandidate',
  'sourceDocumentRef',
] as const;
const UNRESOLVED_REQUIRED = ['applicants', 'rightHolders'] as const;
const PROVENANCE_REQUIRED = [
  'sourceDatasets',
  'sourceArtifactRefs',
  'processingRunId',
  'parserVersion',
  'normalizationVersion',
  'sourceRecordLocator',
] as const;
const QUALITY_REQUIRED = ['state', 'findings', 'duplicateCandidates'] as const;
const FINDING_REQUIRED = ['code', 'severity', 'message', 'path'] as const;

const IDENTIFIER_RE = /^[A-Za-z0-9._:-]+$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|\+00:00)$/;
const HIERARCHICAL_URI_RE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
const DATA_OR_FILE_URI_RE = /^(?:data|file):/i;
const WINDOWS_DRIVE_RE = /[A-Za-z]:[\\/]/;
const SECRET_ASSIGNMENT_RE =
  /(?:^|[\s;,])(?:api[_-]?key|access[_-]?token|password|secret|connection[_-]?string)\s*[:=]\s*\S+/i;
const CREDENTIAL_MARKER_RE =
  /(?:authorization\s*:\s*(?:bearer|basic)|x-amz-(?:signature|credential|security-token)\s*=|(?:client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key)\s*[:=])\s*\S+/i;
const PRIVATE_KEY_RE = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i;
const CREDENTIAL_TOKEN_RE = /(?:AKIA|ASIA)[0-9A-Z]{16}/;
const PARENT_TRAVERSAL_RE = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const SAFE_SEMVER_RE =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const MAX_ERRORS = 200;

export function adaptBackendDesignExport(value: unknown): BackendContractAdapterResult {
  if (!isObject(value)) {
    return failure([
      {
        code: 'INVALID_ENVELOPE',
        path: '$',
        message: 'The Backend export must be a JSON object.',
      },
    ]);
  }

  if (!hasOwn(value, 'contractVersion') || typeof value.contractVersion !== 'string' || value.contractVersion.length === 0) {
    return failure([
      {
        code: 'INVALID_ENVELOPE',
        path: '$.contractVersion',
        message: 'contractVersion must be a non-empty string.',
      },
    ]);
  }

  if (value.contractVersion !== BACKEND_CONTRACT_VERSION) {
    return failure(
      [
        {
          code: 'UNSUPPORTED_CONTRACT_VERSION',
          path: '$.contractVersion',
          message: 'This contract version is not supported.',
        },
      ],
      safeDetectedVersion(value.contractVersion),
    );
  }

  const contractErrors = validateContractV010(value);
  if (contractErrors.length > 0) return failure(contractErrors, BACKEND_CONTRACT_VERSION);

  const decoded = cloneValidatedExport(value as unknown as BackendDesignExportV010);
  const unsafePaths = findUnsafePublicReferencePaths(decoded);
  if (unsafePaths.length > 0) {
    return failure(
      unsafePaths.slice(0, MAX_ERRORS).map((path) => ({
        code: 'UNSAFE_PUBLIC_PROVENANCE' as const,
        path,
        message: 'A public reference contains a prohibited path, URL, or credential-like pattern.',
      })),
      BACKEND_CONTRACT_VERSION,
    );
  }

  return projectValidatedExport(decoded);
}

export class BackendContractDataSource {
  private readonly analysisRecords: AnalysisReadyDesignRecord[];
  private readonly viewRecords: BackendRecordViewModel[];
  private readonly dataAsOf: string;
  private readonly excludedRecords: ExcludedBackendRecord[];
  private readonly notices: AdapterNotice[];
  private readonly summary: BackendAdapterSummary;
  private readonly unresolvedApplicantRecordIds: Set<string>;

  constructor(adapted: BackendContractAdapterSuccess) {
    this.analysisRecords = adapted.analysisRecords.map(cloneAnalysisRecord);
    this.viewRecords = adapted.records.map(cloneViewRecord);
    this.dataAsOf = adapted.meta.analysisCutoff;
    this.excludedRecords = adapted.excludedRecords.map(cloneExcludedRecord);
    this.notices = adapted.notices.map((notice) => ({ ...notice }));
    this.summary = { ...adapted.summary };
    this.unresolvedApplicantRecordIds = new Set(
      adapted.records
        .filter((record) =>
          record.applicants.some((party) => party.resolutionStatus === 'unresolved'),
        )
        .map((record) => record.id),
    );
  }

  query(req: AnalysisRequest): Promise<AnalysisReadyDesignRecord[]> {
    const periodStart = getBackendPeriodStart(this.dataAsOf, req.period);
    const productTokens = tokenizeProductDomain(req.productDomain ?? '');
    const selectors =
      req.scope.mode === 'companies'
        ? dedupeSelectors(req.scope.companySelectors)
        : [];

    const records = this.analysisRecords
      .filter((record) => record.gazetteDate >= periodStart && record.gazetteDate <= this.dataAsOf)
      .filter((record) => req.designKinds.includes(record.designKind))
      .filter(
        (record) =>
          req.includeUnresolvedApplicants !== false ||
          !this.unresolvedApplicantRecordIds.has(record.id),
      )
      .filter((record) => {
        if (req.scope.mode !== 'companies') return true;
        if (selectors.length === 0) return false;
        return selectors.some((selector) =>
          record.companyMemberships.some((membership) =>
            companySelectorMatchesMembership(selector, membership),
          ),
        );
      })
      .filter((record) => productTokens.length === 0 || matchesProductDomain(record, productTokens))
      .sort(compareAnalysisRecords)
      .map(cloneAnalysisRecord);

    return Promise.resolve(records);
  }

  getDataAsOf(): string {
    return this.dataAsOf;
  }

  getAllRecords(): AnalysisReadyDesignRecord[] {
    return this.analysisRecords.map(cloneAnalysisRecord).sort(compareAnalysisRecords);
  }

  getViewRecords(): BackendRecordViewModel[] {
    return this.viewRecords.map(cloneViewRecord);
  }

  getExcludedRecords(): ExcludedBackendRecord[] {
    return this.excludedRecords.map(cloneExcludedRecord);
  }

  getNotices(): AdapterNotice[] {
    return this.notices.map((notice) => ({ ...notice }));
  }

  getSummary(): BackendAdapterSummary {
    return { ...this.summary };
  }
}

export function getBackendPeriodStart(dataAsOf: string, period: Period): string {
  const match = DATE_RE.exec(dataAsOf);
  if (!match) throw new Error('dataAsOf must be a validated YYYY-MM-DD date.');

  const year = Number(match[1]) - (period === 'last_1y' ? 1 : 2);
  const month = Number(match[2]);
  const day = Math.min(Number(match[3]), daysInMonth(year, month));
  return `${padYear(year)}-${pad2(month)}-${pad2(day)}`;
}

function projectValidatedExport(exportValue: BackendDesignExportV010): BackendContractAdapterSuccess {
  const analysisCutoff = exportValue.sourceUpdatedAt.slice(0, 10);
  const records = exportValue.records.map((record) => toViewRecord(record, analysisCutoff));
  const analysisRecords = records
    .filter((record) => record.adapterDisposition.status === 'accepted')
    .map(toAnalysisRecord)
    .filter((record): record is AnalysisReadyDesignRecord => record !== null);
  const excludedRecords = records
    .filter((record) => record.adapterDisposition.status === 'excluded')
    .map((record) => ({
      id: record.id,
      exclusionReasons: [...record.adapterDisposition.exclusionReasons],
      quality: cloneQuality(record.quality),
    }));
  const notices = exportValue.records.flatMap(buildNotices);
  const unresolvedApplicantCount = exportValue.records.reduce(
    (total, record) =>
      total + record.applicants.filter((party) => party.resolutionStatus === 'unresolved').length,
    0,
  );
  const unresolvedRightHolderCount = exportValue.records.reduce(
    (total, record) =>
      total + record.rightHolders.filter((party) => party.resolutionStatus === 'unresolved').length,
    0,
  );

  const summary: BackendAdapterSummary = {
    totalRecordCount: exportValue.recordCount,
    acceptedCount: analysisRecords.length,
    warningCount: exportValue.records.filter((record) => record.quality.state === 'warning').length,
    quarantinedCount: exportValue.records.filter((record) => record.quality.state === 'quarantined').length,
    excludedCount: excludedRecords.length,
    unknownDesignTypeCount: exportValue.records.filter((record) => record.designType === 'unknown').length,
    missingGazetteDateCount: exportValue.records.filter((record) => record.gazetteDate === null).length,
    unresolvedApplicantCount,
    unresolvedRightHolderCount,
    unresolvedPartyCount: unresolvedApplicantCount + unresolvedRightHolderCount,
  };

  return {
    ok: true,
    meta: {
      contractVersion: exportValue.contractVersion,
      exportId: exportValue.exportId,
      generatedAt: exportValue.generatedAt,
      sourceUpdatedAt: exportValue.sourceUpdatedAt,
      backendProcessingVersion: exportValue.backendProcessingVersion,
      analysisCutoff,
    },
    records,
    analysisRecords,
    excludedRecords,
    notices,
    summary,
  };
}

function toViewRecord(record: BackendDesignRecordV010, cutoff: string): BackendRecordViewModel {
  const exclusionReasons: AdapterExclusionCode[] = [];
  if (record.quality.state === 'quarantined') exclusionReasons.push('QUALITY_QUARANTINED');
  if (record.gazetteDate === null) exclusionReasons.push('MISSING_GAZETTE_DATE');
  if (record.gazetteDate !== null && record.gazetteDate > cutoff) {
    exclusionReasons.push('GAZETTE_DATE_AFTER_CUTOFF');
  }
  if (record.designType === 'unknown') exclusionReasons.push('UNKNOWN_DESIGN_TYPE');

  return {
    ...cloneRecord(record),
    drawings: record.drawings.map((drawing) => ({ ...drawing })).sort((left, right) => left.order - right.order),
    adapterDisposition: {
      status: exclusionReasons.length === 0 ? 'accepted' : 'excluded',
      exclusionReasons,
    },
  };
}

function toAnalysisRecord(record: BackendRecordViewModel): AnalysisReadyDesignRecord | null {
  if (
    record.adapterDisposition.status !== 'accepted' ||
    record.gazetteDate === null ||
    record.designType === 'unknown'
  ) {
    return null;
  }

  const classificationMemberships: ClassificationMembership[] = record.classifications.map(
    (classification) => ({ ...classification }),
  );

  return {
    origin: 'backend',
    id: record.id,
    applicationNumber: record.applicationNumber,
    ...(hasOwn(record, 'applicationDate') ? { applicationDate: record.applicationDate } : {}),
    registrationNumber: record.registrationNumber,
    ...(hasOwn(record, 'registrationDate') ? { registrationDate: record.registrationDate } : {}),
    gazetteDate: record.gazetteDate,
    articleName: record.articleName,
    ...(hasOwn(record, 'description') ? { description: record.description } : {}),
    ...(hasOwn(record, 'articleDescription')
      ? { articleDescription: record.articleDescription }
      : {}),
    designKind: record.designType,
    ...(hasOwn(record, 'keywords') ? { keywords: [...(record.keywords ?? [])] } : {}),
    ...(hasOwn(record, 'designFeatures')
      ? { designFeatures: [...(record.designFeatures ?? [])] }
      : {}),
    companyMemberships: resolvedCompanyMemberships(record),
    classificationMemberships,
    primaryClassification:
      classificationMemberships.find((classification) => classification.isPrimary) ?? null,
  };
}

function resolvedCompanyMemberships(record: BackendDesignRecordV010): BackendCompanyMembership[] {
  const memberships = new Map<string, BackendCompanyMembership>();
  for (const party of [...record.applicants, ...record.rightHolders]) {
    if (party.resolutionStatus !== 'resolved' || party.resolvedEntityId === null) continue;
    const membership: BackendCompanyMembership = {
      origin: 'backend',
      role: party.role,
      resolvedEntityId: party.resolvedEntityId,
      displayLabel: partyDisplayLabel(party),
    };
    const key = companyMembershipKey(membership);
    if (!memberships.has(key)) memberships.set(key, membership);
  }
  return [...memberships.values()];
}

function partyDisplayLabel(party: BackendPartyV010): string {
  for (const value of [party.displayName, party.normalizedNameCandidate, party.rawName]) {
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return '名称未設定';
}

function buildNotices(record: BackendDesignRecordV010, recordIndex: number): AdapterNotice[] {
  const notices: AdapterNotice[] = [];
  const basePath = `$.records[${recordIndex}]`;
  if (record.quality.state === 'warning') {
    notices.push({
      code: 'QUALITY_WARNING',
      recordId: record.id,
      path: `${basePath}.quality`,
      message: 'This record has non-blocking quality findings.',
    });
  }
  if (record.applicants.some((party) => party.resolutionStatus === 'unresolved')) {
    notices.push({
      code: 'UNRESOLVED_APPLICANT',
      recordId: record.id,
      path: `${basePath}.applicants`,
      message: 'This record contains an unresolved applicant.',
    });
  }
  if (record.rightHolders.some((party) => party.resolutionStatus === 'unresolved')) {
    notices.push({
      code: 'UNRESOLVED_RIGHT_HOLDER',
      recordId: record.id,
      path: `${basePath}.rightHolders`,
      message: 'This record contains an unresolved right holder.',
    });
  }
  if (record.quality.duplicateCandidates.length > 0) {
    notices.push({
      code: 'DUPLICATE_CANDIDATE',
      recordId: record.id,
      path: `${basePath}.quality.duplicateCandidates`,
      message: 'This record has one or more duplicate-candidate references.',
    });
  }
  return notices;
}

function validateContractV010(value: JsonObject): DatasetAdapterError[] {
  const errors: DatasetAdapterError[] = [];
  validateKeys(value, '$', ENVELOPE_REQUIRED, [], errors);
  validateNonEmptyIdentifier(value.exportId, '$.exportId', errors);
  validateUtcDateTime(value.generatedAt, '$.generatedAt', errors);
  validateUtcDateTime(value.sourceUpdatedAt, '$.sourceUpdatedAt', errors);
  validateNonEmptyString(value.backendProcessingVersion, '$.backendProcessingVersion', errors);
  validateNonNegativeInteger(value.recordCount, '$.recordCount', errors);

  if (!Array.isArray(value.records)) {
    addContractError(errors, '$.records', 'Expected an array.');
    return errors;
  }

  value.records.forEach((record, index) =>
    validateRecord(record, `$.records[${index}]`, errors),
  );

  if (Number.isInteger(value.recordCount) && value.recordCount !== value.records.length) {
    addContractError(errors, '$.recordCount', 'recordCount must equal records.length.');
  }

  const recordIds = value.records
    .filter(isObject)
    .map((record) => record.id)
    .filter((id): id is string => typeof id === 'string');
  if (recordIds.length !== new Set(recordIds).size) {
    addContractError(errors, '$.records', 'Record IDs must be unique.');
  }

  const knownIds = new Set(recordIds);
  value.records.forEach((record, index) => {
    if (!isObject(record) || !isObject(record.quality) || !Array.isArray(record.quality.duplicateCandidates)) {
      return;
    }
    record.quality.duplicateCandidates.forEach((candidate, candidateIndex) => {
      if (typeof candidate === 'string' && !knownIds.has(candidate)) {
        addContractError(
          errors,
          `$.records[${index}].quality.duplicateCandidates[${candidateIndex}]`,
          'Duplicate-candidate ID is not present in this export.',
        );
      }
    });
  });

  return errors;
}

function validateRecord(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!isObject(value)) {
    addContractError(errors, path, 'Expected an object.');
    return;
  }
  validateKeys(value, path, RECORD_REQUIRED, RECORD_OPTIONAL, errors);
  validateNonEmptyIdentifier(value.id, `${path}.id`, errors);
  validateNullableString(value.applicationNumber, `${path}.applicationNumber`, errors);
  if (hasOwn(value, 'applicationDate')) validateNullableDate(value.applicationDate, `${path}.applicationDate`, errors);
  validateNullableString(value.registrationNumber, `${path}.registrationNumber`, errors);
  if (hasOwn(value, 'registrationDate')) validateNullableDate(value.registrationDate, `${path}.registrationDate`, errors);
  validateNullableDate(value.gazetteDate, `${path}.gazetteDate`, errors);
  validateNullableString(value.articleName, `${path}.articleName`, errors);
  if (hasOwn(value, 'description')) validateNullableString(value.description, `${path}.description`, errors);
  if (hasOwn(value, 'articleDescription')) {
    validateNullableString(value.articleDescription, `${path}.articleDescription`, errors);
  }
  if (!isOneOf(value.designType, ['article', 'image', 'interior', 'unknown'])) {
    addContractError(errors, `${path}.designType`, 'Unsupported designType.');
  }
  if (hasOwn(value, 'keywords')) validateUniqueStringArray(value.keywords, `${path}.keywords`, true, errors);
  if (hasOwn(value, 'designFeatures')) {
    validateUniqueStringArray(value.designFeatures, `${path}.designFeatures`, true, errors);
  }
  validateParties(value.applicants, 'applicant', `${path}.applicants`, errors);
  validateParties(value.rightHolders, 'right_holder', `${path}.rightHolders`, errors);
  validateClassifications(value.classifications, `${path}.classifications`, errors);
  validatePublication(value.publication, `${path}.publication`, errors);
  validateDrawings(value.drawings, `${path}.drawings`, errors);
  validateUnresolved(value.unresolved, `${path}.unresolved`, errors);
  validateProvenance(value.provenance, `${path}.provenance`, errors);
  validateQuality(value.quality, `${path}.quality`, errors);
  validateUtcDateTime(value.sourceUpdatedAt, `${path}.sourceUpdatedAt`, errors);
  validateNonEmptyString(value.backendProcessingVersion, `${path}.backendProcessingVersion`, errors);

  validateUnresolvedCorrespondence(value, 'applicants', path, errors);
  validateUnresolvedCorrespondence(value, 'rightHolders', path, errors);
  if (value.gazetteDate === null && isObject(value.quality) && Array.isArray(value.quality.findings)) {
    const hasMissingDateFinding = value.quality.findings.some(
      (finding) => isObject(finding) && finding.code === 'GAZETTE_DATE_MISSING',
    );
    if (!hasMissingDateFinding) {
      addContractError(
        errors,
        `${path}.quality.findings`,
        'gazetteDate null requires a GAZETTE_DATE_MISSING finding.',
      );
    }
  }
}

function validateParties(
  value: unknown,
  expectedRole: BackendPartyRole,
  path: string,
  errors: DatasetAdapterError[],
): void {
  if (!Array.isArray(value)) {
    addContractError(errors, path, 'Expected an array.');
    return;
  }
  value.forEach((party, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(party)) {
      addContractError(errors, itemPath, 'Expected an object.');
      return;
    }
    validateKeys(party, itemPath, PARTY_REQUIRED, [], errors);
    if (party.role !== expectedRole) {
      addContractError(errors, `${itemPath}.role`, 'Party role does not match its collection.');
    }
    for (const field of ['rawName', 'displayName', 'normalizedNameCandidate', 'resolvedEntityId'] as const) {
      validateNullableString(party[field], `${itemPath}.${field}`, errors);
    }
    if (!isOneOf(party.resolutionStatus, ['resolved', 'unresolved'])) {
      addContractError(errors, `${itemPath}.resolutionStatus`, 'Unsupported resolutionStatus.');
    }
    if (party.resolutionStatus === 'resolved') {
      validateNonEmptyString(party.resolvedEntityId, `${itemPath}.resolvedEntityId`, errors);
    }
    if (party.resolutionStatus === 'unresolved' && party.resolvedEntityId !== null) {
      addContractError(errors, `${itemPath}.resolvedEntityId`, 'Unresolved parties require null.');
    }
    validateNonEmptyString(party.sourceRef, `${itemPath}.sourceRef`, errors);
  });
}

function validateClassifications(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    addContractError(errors, path, 'Expected a non-empty array.');
    return;
  }
  let primaryCount = 0;
  value.forEach((classification, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(classification)) {
      addContractError(errors, itemPath, 'Expected an object.');
      return;
    }
    validateKeys(classification, itemPath, CLASSIFICATION_REQUIRED, [], errors);
    validateNonEmptyString(classification.scheme, `${itemPath}.scheme`, errors);
    validateNonEmptyString(classification.code, `${itemPath}.code`, errors);
    validateNullableString(classification.label, `${itemPath}.label`, errors);
    if (typeof classification.isPrimary !== 'boolean') {
      addContractError(errors, `${itemPath}.isPrimary`, 'Expected a boolean.');
    } else if (classification.isPrimary) {
      primaryCount += 1;
    }
  });
  if (primaryCount > 1) {
    addContractError(errors, path, 'At most one classification may be primary.');
  }
}

function validatePublication(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (value === null) return;
  if (!isObject(value)) {
    addContractError(errors, path, 'Expected an object or null.');
    return;
  }
  validateKeys(value, path, PUBLICATION_REQUIRED, [], errors);
  validateNullableString(value.gazetteNumber, `${path}.gazetteNumber`, errors);
  validateNullableString(value.publicationDocumentId, `${path}.publicationDocumentId`, errors);
  validateNullableDate(value.issueDate, `${path}.issueDate`, errors);
  validateNonEmptyString(value.sourceRef, `${path}.sourceRef`, errors);
}

function validateDrawings(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!Array.isArray(value)) {
    addContractError(errors, path, 'Expected an array.');
    return;
  }
  const orders = new Set<number>();
  value.forEach((drawing, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(drawing)) {
      addContractError(errors, itemPath, 'Expected an object.');
      return;
    }
    validateKeys(drawing, itemPath, DRAWING_REQUIRED, [], errors);
    validateNonEmptyString(drawing.drawingId, `${itemPath}.drawingId`, errors);
    validateNullableString(drawing.label, `${itemPath}.label`, errors);
    if (drawing.fileName !== null) {
    validateNonEmptyString(drawing.fileName, `${itemPath}.fileName`, errors);
      if (typeof drawing.fileName === 'string' && !isSafeDrawingFileName(drawing.fileName)) {
        addContractError(errors, `${itemPath}.fileName`, 'Only a safe basename is allowed.');
      }
    }
    validateNullableString(drawing.mediaType, `${itemPath}.mediaType`, errors);
    if (!Number.isInteger(drawing.order) || (drawing.order as number) < 1) {
      addContractError(errors, `${itemPath}.order`, 'Expected a positive integer.');
    } else if (orders.has(drawing.order as number)) {
      addContractError(errors, `${itemPath}.order`, 'Drawing order must be unique within a record.');
    } else {
      orders.add(drawing.order as number);
    }
    if (typeof drawing.isRepresentativeCandidate !== 'boolean') {
      addContractError(errors, `${itemPath}.isRepresentativeCandidate`, 'Expected a boolean.');
    }
    validateNonEmptyString(drawing.sourceDocumentRef, `${itemPath}.sourceDocumentRef`, errors);
  });
}

function validateUnresolved(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!isObject(value)) {
    addContractError(errors, path, 'Expected an object.');
    return;
  }
  validateKeys(value, path, UNRESOLVED_REQUIRED, [], errors);
  for (const collectionName of UNRESOLVED_REQUIRED) {
    const collection = value[collectionName];
    const collectionPath = `${path}.${collectionName}`;
    if (!Array.isArray(collection)) {
      addContractError(errors, collectionPath, 'Expected an array.');
      continue;
    }
    collection.forEach((detail, index) => {
      const itemPath = `${collectionPath}[${index}]`;
      if (!isObject(detail)) {
        addContractError(errors, itemPath, 'Expected an object.');
        return;
      }
      validateKeys(detail, itemPath, UNRESOLVED_PARTY_REQUIRED, [], errors);
      validateNonEmptyString(detail.rawValue, `${itemPath}.rawValue`, errors);
      validateNullableString(detail.code, `${itemPath}.code`, errors);
      if (
        !isOneOf(detail.reason, [
          'no_exact_match',
          'ambiguous_match',
          'missing_master',
          'invalid_source_value',
        ])
      ) {
        addContractError(errors, `${itemPath}.reason`, 'Unsupported unresolved reason.');
      }
      validateNonEmptyString(detail.sourceRef, `${itemPath}.sourceRef`, errors);
    });
  }
}

function validateProvenance(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!isObject(value)) {
    addContractError(errors, path, 'Expected an object.');
    return;
  }
  validateKeys(value, path, PROVENANCE_REQUIRED, [], errors);
  validateUniqueStringArray(value.sourceDatasets, `${path}.sourceDatasets`, false, errors);
  validateUniqueStringArray(value.sourceArtifactRefs, `${path}.sourceArtifactRefs`, false, errors);
  for (const field of ['processingRunId', 'parserVersion', 'normalizationVersion', 'sourceRecordLocator'] as const) {
    validateNonEmptyString(value[field], `${path}.${field}`, errors);
  }
}

function validateQuality(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!isObject(value)) {
    addContractError(errors, path, 'Expected an object.');
    return;
  }
  validateKeys(value, path, QUALITY_REQUIRED, [], errors);
  if (!isOneOf(value.state, ['pass', 'warning', 'quarantined'])) {
    addContractError(errors, `${path}.state`, 'Unsupported quality state.');
  }
  if (!Array.isArray(value.findings)) {
    addContractError(errors, `${path}.findings`, 'Expected an array.');
  } else {
    value.findings.forEach((finding, index) => {
      const itemPath = `${path}.findings[${index}]`;
      if (!isObject(finding)) {
        addContractError(errors, itemPath, 'Expected an object.');
        return;
      }
      validateKeys(finding, itemPath, FINDING_REQUIRED, [], errors);
      validateNonEmptyString(finding.code, `${itemPath}.code`, errors);
      if (!isOneOf(finding.severity, ['info', 'warning', 'error'])) {
        addContractError(errors, `${itemPath}.severity`, 'Unsupported finding severity.');
      }
      validateNonEmptyString(finding.message, `${itemPath}.message`, errors);
      validateNonEmptyString(finding.path, `${itemPath}.path`, errors);
    });
  }
  validateUniqueStringArray(value.duplicateCandidates, `${path}.duplicateCandidates`, true, errors);
}

function validateUnresolvedCorrespondence(
  record: JsonObject,
  collectionName: 'applicants' | 'rightHolders',
  path: string,
  errors: DatasetAdapterError[],
): void {
  const parties = record[collectionName];
  const unresolved = record.unresolved;
  if (!Array.isArray(parties) || !isObject(unresolved) || !Array.isArray(unresolved[collectionName])) {
    return;
  }
  const partyRefs = new Set(
    parties
      .filter(isObject)
      .filter((party) => party.resolutionStatus === 'unresolved')
      .map((party) => party.sourceRef)
      .filter((sourceRef): sourceRef is string => typeof sourceRef === 'string' && sourceRef.length > 0),
  );
  const detailRefs = new Set(
    unresolved[collectionName]
      .filter(isObject)
      .map((detail) => detail.sourceRef)
      .filter((sourceRef): sourceRef is string => typeof sourceRef === 'string' && sourceRef.length > 0),
  );
  if ([...partyRefs].some((sourceRef) => !detailRefs.has(sourceRef))) {
    addContractError(
      errors,
      `${path}.unresolved.${collectionName}`,
      'An unresolved party is missing its sourceRef-matched detail.',
    );
  }
  if ([...detailRefs].some((sourceRef) => !partyRefs.has(sourceRef))) {
    addContractError(
      errors,
      `${path}.unresolved.${collectionName}`,
      'An unresolved detail has no sourceRef-matched party.',
    );
  }
}

function validateKeys(
  value: JsonObject,
  path: string,
  required: readonly string[],
  optional: readonly string[],
  errors: DatasetAdapterError[],
): void {
  const allowed = new Set([...required, ...optional]);
  required.forEach((key) => {
    if (!hasOwn(value, key)) addContractError(errors, `${path}.${key}`, 'Required field is missing.');
  });
  Object.keys(value).forEach((key) => {
    if (!allowed.has(key)) {
      addContractError(errors, appendSafeProperty(path, key), 'Unexpected field is not allowed.');
    }
  });
}

function validateNonEmptyIdentifier(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  validateNonEmptyString(value, path, errors);
  if (typeof value === 'string' && value.length > 0 && !IDENTIFIER_RE.test(value)) {
    addContractError(errors, path, 'Identifier contains unsupported characters.');
  }
}

function validateNonEmptyString(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (typeof value !== 'string' || value.length === 0) {
    addContractError(errors, path, 'Expected a non-empty string.');
  }
}

function validateNullableString(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (value !== null && typeof value !== 'string') {
    addContractError(errors, path, 'Expected a string or null.');
  }
}

function validateNullableDate(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (value !== null && (typeof value !== 'string' || !isValidDate(value))) {
    addContractError(errors, path, 'Expected a valid YYYY-MM-DD date or null.');
  }
}

function validateUtcDateTime(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (typeof value !== 'string' || !isValidUtcDateTime(value)) {
    addContractError(errors, path, 'Expected a valid UTC date-time using Z or +00:00.');
  }
}

function validateNonNegativeInteger(value: unknown, path: string, errors: DatasetAdapterError[]): void {
  if (!Number.isInteger(value) || (value as number) < 0) {
    addContractError(errors, path, 'Expected a non-negative integer.');
  }
}

function validateUniqueStringArray(
  value: unknown,
  path: string,
  allowEmpty: boolean,
  errors: DatasetAdapterError[],
): void {
  if (!Array.isArray(value)) {
    addContractError(errors, path, 'Expected an array.');
    return;
  }
  if (!allowEmpty && value.length === 0) {
    addContractError(errors, path, 'Expected a non-empty array.');
  }
  if (value.some((item) => typeof item !== 'string' || item.length === 0)) {
    addContractError(errors, path, 'Expected non-empty string items.');
  }
  const strings = value.filter((item): item is string => typeof item === 'string');
  if (strings.length !== new Set(strings).size) {
    addContractError(errors, path, 'Duplicate items are not allowed.');
  }
}

function addContractError(errors: DatasetAdapterError[], path: string, message: string): void {
  if (errors.length >= MAX_ERRORS) return;
  errors.push({ code: 'CONTRACT_VALIDATION_FAILED', path, message });
}

function findUnsafePublicReferencePaths(exportValue: BackendDesignExportV010): string[] {
  const unsafePaths: string[] = [];
  collectUnsafeReference(
    exportValue.backendProcessingVersion,
    '$.backendProcessingVersion',
    unsafePaths,
  );
  exportValue.records.forEach((record, recordIndex) => {
    const basePath = `$.records[${recordIndex}]`;
    record.applicants.forEach((party, index) =>
      collectUnsafeReference(party.sourceRef, `${basePath}.applicants[${index}].sourceRef`, unsafePaths),
    );
    record.rightHolders.forEach((party, index) =>
      collectUnsafeReference(party.sourceRef, `${basePath}.rightHolders[${index}].sourceRef`, unsafePaths),
    );
    record.unresolved.applicants.forEach((detail, index) =>
      collectUnsafeReference(
        detail.sourceRef,
        `${basePath}.unresolved.applicants[${index}].sourceRef`,
        unsafePaths,
      ),
    );
    record.unresolved.rightHolders.forEach((detail, index) =>
      collectUnsafeReference(
        detail.sourceRef,
        `${basePath}.unresolved.rightHolders[${index}].sourceRef`,
        unsafePaths,
      ),
    );
    if (record.publication !== null) {
      collectUnsafeReference(record.publication.sourceRef, `${basePath}.publication.sourceRef`, unsafePaths);
    }
    record.drawings.forEach((drawing, index) =>
      collectUnsafeReference(
        drawing.sourceDocumentRef,
        `${basePath}.drawings[${index}].sourceDocumentRef`,
        unsafePaths,
      ),
    );
    record.provenance.sourceDatasets.forEach((reference, index) =>
      collectUnsafeReference(
        reference,
        `${basePath}.provenance.sourceDatasets[${index}]`,
        unsafePaths,
      ),
    );
    record.provenance.sourceArtifactRefs.forEach((reference, index) =>
      collectUnsafeReference(
        reference,
        `${basePath}.provenance.sourceArtifactRefs[${index}]`,
        unsafePaths,
      ),
    );
    for (const field of ['processingRunId', 'parserVersion', 'normalizationVersion', 'sourceRecordLocator'] as const) {
      collectUnsafeReference(record.provenance[field], `${basePath}.provenance.${field}`, unsafePaths);
    }
    collectUnsafeReference(
      record.backendProcessingVersion,
      `${basePath}.backendProcessingVersion`,
      unsafePaths,
    );
    record.quality.findings.forEach((finding, index) => {
      for (const field of ['code', 'message', 'path'] as const) {
        if (isUnsafePublicAuditText(finding[field])) {
          unsafePaths.push(`${basePath}.quality.findings[${index}].${field}`);
        }
      }
    });
  });
  return [...new Set(unsafePaths)];
}

function collectUnsafeReference(value: string, path: string, unsafePaths: string[]): void {
  if (isUnsafePublicReference(value)) unsafePaths.push(path);
}

function isUnsafePublicReference(value: string): boolean {
  const candidate = value.trim();
  return (
    HIERARCHICAL_URI_RE.test(candidate) ||
    DATA_OR_FILE_URI_RE.test(candidate) ||
    WINDOWS_DRIVE_RE.test(candidate) ||
    candidate.startsWith('/') ||
    candidate.startsWith('\\\\') ||
    /[\\/]/.test(candidate) ||
    PARENT_TRAVERSAL_RE.test(candidate) ||
    SECRET_ASSIGNMENT_RE.test(candidate) ||
    CREDENTIAL_MARKER_RE.test(candidate) ||
    PRIVATE_KEY_RE.test(candidate) ||
    CREDENTIAL_TOKEN_RE.test(candidate)
  );
}

function isUnsafePublicAuditText(value: string): boolean {
  const candidate = value.trim();
  return (
    HIERARCHICAL_URI_RE.test(candidate) ||
    DATA_OR_FILE_URI_RE.test(candidate) ||
    WINDOWS_DRIVE_RE.test(candidate) ||
    candidate.startsWith('/') ||
    candidate.startsWith('\\\\') ||
    PARENT_TRAVERSAL_RE.test(candidate) ||
    SECRET_ASSIGNMENT_RE.test(candidate) ||
    CREDENTIAL_MARKER_RE.test(candidate) ||
    PRIVATE_KEY_RE.test(candidate) ||
    CREDENTIAL_TOKEN_RE.test(candidate)
  );
}

function isSafeDrawingFileName(value: string): boolean {
  const candidate = value.trim();
  return (
    candidate.length > 0 &&
    candidate !== '.' &&
    candidate !== '..' &&
    !/[\\/:<>"|?*]/.test(candidate) &&
    !Array.from(candidate).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    }) &&
    !isUnsafePublicReference(candidate)
  );
}

function cloneValidatedExport(value: BackendDesignExportV010): BackendDesignExportV010 {
  return {
    contractVersion: value.contractVersion,
    exportId: value.exportId,
    generatedAt: value.generatedAt,
    sourceUpdatedAt: value.sourceUpdatedAt,
    backendProcessingVersion: value.backendProcessingVersion,
    recordCount: value.recordCount,
    records: value.records.map(cloneRecord),
  };
}

function cloneRecord(record: BackendDesignRecordV010): BackendDesignRecordV010 {
  return {
    id: record.id,
    applicationNumber: record.applicationNumber,
    ...(hasOwn(record, 'applicationDate') ? { applicationDate: record.applicationDate } : {}),
    registrationNumber: record.registrationNumber,
    ...(hasOwn(record, 'registrationDate') ? { registrationDate: record.registrationDate } : {}),
    gazetteDate: record.gazetteDate,
    articleName: record.articleName,
    ...(hasOwn(record, 'description') ? { description: record.description } : {}),
    ...(hasOwn(record, 'articleDescription')
      ? { articleDescription: record.articleDescription }
      : {}),
    designType: record.designType,
    ...(hasOwn(record, 'keywords') ? { keywords: [...(record.keywords ?? [])] } : {}),
    ...(hasOwn(record, 'designFeatures')
      ? { designFeatures: [...(record.designFeatures ?? [])] }
      : {}),
    applicants: record.applicants.map((party) => ({ ...party })),
    rightHolders: record.rightHolders.map((party) => ({ ...party })),
    classifications: record.classifications.map((classification) => ({ ...classification })),
    publication: record.publication === null ? null : { ...record.publication },
    drawings: record.drawings.map((drawing) => ({ ...drawing })),
    unresolved: {
      applicants: record.unresolved.applicants.map((detail) => ({ ...detail })),
      rightHolders: record.unresolved.rightHolders.map((detail) => ({ ...detail })),
    },
    provenance: {
      ...record.provenance,
      sourceDatasets: [...record.provenance.sourceDatasets],
      sourceArtifactRefs: [...record.provenance.sourceArtifactRefs],
    },
    quality: cloneQuality(record.quality),
    sourceUpdatedAt: record.sourceUpdatedAt,
    backendProcessingVersion: record.backendProcessingVersion,
  };
}

function cloneQuality(quality: BackendQualityV010): BackendQualityV010 {
  return {
    state: quality.state,
    findings: quality.findings.map((finding) => ({ ...finding })),
    duplicateCandidates: [...quality.duplicateCandidates],
  };
}

function cloneViewRecord(record: BackendRecordViewModel): BackendRecordViewModel {
  return {
    ...cloneRecord(record),
    adapterDisposition: {
      status: record.adapterDisposition.status,
      exclusionReasons: [...record.adapterDisposition.exclusionReasons],
    },
  };
}

function cloneExcludedRecord(record: ExcludedBackendRecord): ExcludedBackendRecord {
  return {
    id: record.id,
    exclusionReasons: [...record.exclusionReasons],
    quality: cloneQuality(record.quality),
  };
}

function cloneAnalysisRecord(record: AnalysisReadyDesignRecord): AnalysisReadyDesignRecord {
  const common: AnalysisReadyDesignRecordBase = {
    id: record.id,
    applicationNumber: record.applicationNumber,
    ...(hasOwn(record, 'applicationDate') ? { applicationDate: record.applicationDate } : {}),
    registrationNumber: record.registrationNumber,
    ...(hasOwn(record, 'registrationDate') ? { registrationDate: record.registrationDate } : {}),
    gazetteDate: record.gazetteDate,
    articleName: record.articleName,
    ...(hasOwn(record, 'description') ? { description: record.description } : {}),
    ...(hasOwn(record, 'articleDescription')
      ? { articleDescription: record.articleDescription }
      : {}),
    designKind: record.designKind,
    ...(record.keywords === undefined ? {} : { keywords: [...record.keywords] }),
    ...(record.designFeatures === undefined
      ? {}
      : { designFeatures: [...record.designFeatures] }),
    companyMemberships: record.companyMemberships.map((membership) => ({ ...membership })),
    classificationMemberships: record.classificationMemberships.map((membership) => ({ ...membership })),
    primaryClassification:
      record.primaryClassification === null ? null : { ...record.primaryClassification },
  };
  return record.origin === 'backend'
    ? { ...common, origin: 'backend' }
    : {
        ...common,
        origin: record.origin,
        ...(record.businessDomain === undefined
          ? {}
          : { businessDomain: record.businessDomain }),
      };
}

function dedupeSelectors(selectors: readonly CompanySelector[]): CompanySelector[] {
  const unique = new Map<string, CompanySelector>();
  selectors.forEach((selector) => {
    const key = companySelectorKey(selector);
    if (!unique.has(key)) unique.set(key, selector);
  });
  return [...unique.values()];
}

function matchesProductDomain(record: AnalysisReadyDesignRecord, tokens: string[]): boolean {
  const target = [
    record.articleName,
    record.description,
    record.articleDescription,
    ...record.classificationMemberships.flatMap((classification) => [
      classification.scheme,
      classification.code,
      classification.label,
    ]),
    ...(record.keywords ?? []),
    ...(record.designFeatures ?? []),
  ]
    .filter((value): value is string => typeof value === 'string')
    .map(normalize)
    .join(' ');
  return tokens.some((token) => target.includes(token));
}

function tokenizeProductDomain(value: string): string[] {
  return value
    .split(/\s+|\/|、|・/)
    .map(normalize)
    .filter(Boolean);
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

function compareAnalysisRecords(left: AnalysisReadyDesignRecord, right: AnalysisReadyDesignRecord): number {
  return right.gazetteDate.localeCompare(left.gazetteDate) || left.id.localeCompare(right.id);
}

function isValidDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function isValidUtcDateTime(value: string): boolean {
  const match = UTC_DATE_TIME_RE.exec(value);
  if (!match) return false;
  const datePart = `${match[1]}-${match[2]}-${match[3]}`;
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  return isValidDate(datePart) && hour <= 23 && minute <= 59 && second <= 59;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function padYear(value: number): string {
  return String(value).padStart(4, '0');
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn<T extends object, K extends PropertyKey>(value: T, key: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function appendSafeProperty(path: string, key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? `${path}.${key}` : `${path}.[unexpected]`;
}

function safeDetectedVersion(value: string): string | undefined {
  return value.length <= 64 && SAFE_SEMVER_RE.test(value) ? value : undefined;
}

function failure(
  errors: DatasetAdapterError[],
  detectedContractVersion?: string,
): BackendContractAdapterFailure {
  return {
    ok: false,
    ...(detectedContractVersion === undefined ? {} : { detectedContractVersion }),
    errors,
  };
}
