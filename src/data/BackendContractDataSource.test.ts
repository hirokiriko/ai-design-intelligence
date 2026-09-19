import { describe, expect, it } from 'vitest';
import {
  companySelectorKey,
  companySelectorMatchesMembership,
  type CompanySelector,
} from '../domain/analysisRecords';
import type { AnalysisRequest } from '../domain/types';
import {
  adaptBackendDesignExport,
  BackendContractDataSource,
  getBackendPeriodStart,
  type BackendContractAdapterSuccess,
  type BackendDesignExportV010,
  type BackendDesignRecordV010,
  type BackendPartyRole,
  type BackendPartyV010,
  type BackendUnresolvedPartyV010,
} from './BackendContractDataSource';

describe('adaptBackendDesignExport', () => {
  it('accepts exact 0.1.0 and preserves envelope metadata with a sourceUpdatedAt cutoff', () => {
    const result = requireSuccess(adaptBackendDesignExport(makeExport()));

    expect(result.meta).toEqual({
      contractVersion: '0.1.0',
      exportId: 'FIXTURE-EXPORT-001',
      generatedAt: '2026-08-10T12:00:00Z',
      sourceUpdatedAt: '2026-08-09T09:30:00Z',
      backendProcessingVersion: 'fixture-pipeline-0.1.0',
      analysisCutoff: '2026-08-09',
    });
    expect(result.analysisRecords[0].id).toBe('kds_fixture_alpha');
  });

  it.each(['0.1.1', '0.2.0', '1.0.0'])('rejects unsupported version %s before mapping', (version) => {
    const payload = makeExport() as unknown as { contractVersion: string };
    payload.contractVersion = version;

    const result = adaptBackendDesignExport(payload);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detectedContractVersion).toBe(version);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'UNSUPPORTED_CONTRACT_VERSION', path: '$.contractVersion' }),
    ]);
  });

  it('does not expose an arbitrary non-semver contractVersion in diagnostics', () => {
    const unsafeVersion = 'fixture-version-not-semver';
    const payload = makeExport() as unknown as { contractVersion: string };
    payload.contractVersion = unsafeVersion;

    const result = adaptBackendDesignExport(payload);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detectedContractVersion).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain(unsafeVersion);
  });

  it('rejects non-object and missing, empty, or non-string contractVersion as an invalid envelope', () => {
    expect(failureCodes(adaptBackendDesignExport('{"contractVersion":"0.1.0"}'))).toEqual([
      'INVALID_ENVELOPE',
    ]);

    const missing = makeExport() as Partial<BackendDesignExportV010>;
    delete missing.contractVersion;
    expect(failureCodes(adaptBackendDesignExport(missing))).toEqual(['INVALID_ENVELOPE']);

    for (const contractVersion of ['', 100, null]) {
      const payload = makeExport() as unknown as Record<string, unknown>;
      payload.contractVersion = contractVersion;
      expect(failureCodes(adaptBackendDesignExport(payload))).toEqual(['INVALID_ENVELOPE']);
    }
  });

  it('rejects missing and additional fields instead of best-effort conversion', () => {
    const missing = makeExport();
    delete (missing.records[0] as Partial<BackendDesignRecordV010>).articleName;
    expect(failureCodes(adaptBackendDesignExport(missing))).toContain('CONTRACT_VALIDATION_FAILED');

    const extra = makeExport();
    (extra.records[0] as unknown as Record<string, unknown>).unexpected = 'fixture-only';
    const result = adaptBackendDesignExport(extra);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'CONTRACT_VALIDATION_FAILED',
        path: '$.records[0].unexpected',
      }),
    );
  });

  it.each([
    ['recordCount mismatch', invalidRecordCount],
    ['duplicate record ID', invalidDuplicateRecordId],
    ['unknown duplicate candidate', invalidDuplicateCandidate],
    ['unmatched unresolved detail', invalidUnresolvedDetail],
    ['multiple primary classifications', invalidPrimaryClassifications],
    ['duplicate drawing order', invalidDrawingOrder],
    ['missing gazette-date finding', invalidMissingDateFinding],
  ] as const)('fails the whole dataset for semantic violation: %s', (_label, buildInvalid) => {
    const result = adaptBackendDesignExport(buildInvalid());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(new Set(result.errors.map((error) => error.code))).toEqual(
      new Set(['CONTRACT_VALIDATION_FAILED']),
    );
  });

  it('rejects invalid enums, calendar dates, UTC offsets, duplicate unique strings, and unsafe basenames', () => {
    const payload = makeExport();
    (payload.records[0] as unknown as { designType: string }).designType = 'other';
    payload.records[0].applicationDate = '2026-02-30';
    payload.records[0].sourceUpdatedAt = '2026-08-09T09:30:00+09:00';
    payload.records[0].keywords = ['fixture-term', 'fixture-term'];
    payload.records[0].drawings[0].fileName = 'folder/fixture.png';

    const result = adaptBackendDesignExport(payload);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
    expect(result.errors.every((error) => error.code === 'CONTRACT_VALIDATION_FAILED')).toBe(true);
  });

  it('rejects a data URI disguised as a drawing basename', () => {
    const payload = makeExport();
    payload.records[0].drawings[0].fileName = ['da', 'ta:image-png-fixture'].join('');

    const result = adaptBackendDesignExport(payload);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'CONTRACT_VALIDATION_FAILED',
        path: '$.records[0].drawings[0].fileName',
      }),
    );
  });

  it.each(['C:fixture.png', 'fixture.png:stream', '..', `fixture${String.fromCharCode(0)}.png`])(
    'rejects an unsafe drawing basename: %s',
    (fileName) => {
      const payload = makeExport();
      payload.records[0].drawings[0].fileName = fileName;

      const result = adaptBackendDesignExport(payload);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'CONTRACT_VALIDATION_FAILED',
          path: '$.records[0].drawings[0].fileName',
        }),
      );
    },
  );

  it('keeps pass and warning records, excludes quarantined/null/future/unknown records, and preserves all reasons', () => {
    const records = [
      makeRecord('kds_fixture_pass'),
      makeRecord('kds_fixture_warning', {
        quality: makeQuality('warning', [makeFinding('SOURCE_FIELD_WARNING', 'warning')]),
      }),
      makeRecord('kds_fixture_quarantined', {
        quality: makeQuality('quarantined', [makeFinding('SOURCE_RECORD_QUARANTINED', 'error')]),
      }),
      makeMissingDateRecord('kds_fixture_missing_date'),
      makeRecord('kds_fixture_future', { gazetteDate: '2026-08-10' }),
      makeRecord('kds_fixture_unknown', { designType: 'unknown' }),
      makeMissingDateRecord('kds_fixture_multi_reason', {
        designType: 'unknown',
        quality: makeQuality('quarantined', [
          makeFinding('GAZETTE_DATE_MISSING', 'warning'),
          makeFinding('SOURCE_RECORD_QUARANTINED', 'error'),
        ]),
      }),
    ];

    const result = requireSuccess(adaptBackendDesignExport(makeExport(records)));

    expect(result.analysisRecords.map((record) => record.id)).toEqual([
      'kds_fixture_pass',
      'kds_fixture_warning',
    ]);
    expect(result.records.find((record) => record.id === 'kds_fixture_warning')?.quality.state).toBe(
      'warning',
    );
    expect(result.records.find((record) => record.id === 'kds_fixture_missing_date')?.gazetteDate).toBeNull();
    expect(
      result.excludedRecords.find((record) => record.id === 'kds_fixture_multi_reason')
        ?.exclusionReasons,
    ).toEqual(['QUALITY_QUARANTINED', 'MISSING_GAZETTE_DATE', 'UNKNOWN_DESIGN_TYPE']);
    expect(result.notices).toContainEqual(
      expect.objectContaining({ code: 'QUALITY_WARNING', recordId: 'kds_fixture_warning' }),
    );
  });

  it('preserves unresolved applicants and right holders without grouping them as companies or double counting detail', () => {
    const applicantRef = 'fixture-party:unresolved-applicant';
    const rightHolderRef = 'fixture-party:unresolved-right-holder';
    const record = makeRecord('kds_fixture_unresolved_both', {
      applicants: [
        makeResolvedParty('applicant', 'FIXTURE-ENTITY-APPLICANT', '架空出願企業'),
        makeUnresolvedParty('applicant', applicantRef),
      ],
      rightHolders: [
        makeResolvedParty('right_holder', 'FIXTURE-ENTITY-HOLDER', '架空権利者'),
        makeUnresolvedParty('right_holder', rightHolderRef),
      ],
      unresolved: {
        applicants: [makeUnresolvedDetail(applicantRef)],
        rightHolders: [makeUnresolvedDetail(rightHolderRef)],
      },
    });

    const result = requireSuccess(adaptBackendDesignExport(makeExport([record])));
    const analysisRecord = result.analysisRecords[0];

    expect(analysisRecord.companyMemberships).toEqual([
      expect.objectContaining({ role: 'applicant', resolvedEntityId: 'FIXTURE-ENTITY-APPLICANT' }),
      expect.objectContaining({ role: 'right_holder', resolvedEntityId: 'FIXTURE-ENTITY-HOLDER' }),
    ]);
    expect(analysisRecord.companyMemberships).toHaveLength(2);
    expect(result.summary).toMatchObject({
      unresolvedApplicantCount: 1,
      unresolvedRightHolderCount: 1,
      unresolvedPartyCount: 2,
    });
    expect(result.notices.map((notice) => notice.code)).toEqual([
      'UNRESOLVED_APPLICANT',
      'UNRESOLVED_RIGHT_HOLDER',
    ]);
  });

  it('preserves stable IDs and duplicate candidates without merging records', () => {
    const alpha = makeRecord('kds_fixture_duplicate_alpha');
    const beta = makeRecord('kds_fixture_duplicate_beta', {
      quality: makeQuality('warning', [], ['kds_fixture_duplicate_alpha']),
    });

    const result = requireSuccess(adaptBackendDesignExport(makeExport([alpha, beta])));

    expect(result.records.map((record) => record.id)).toEqual([
      'kds_fixture_duplicate_alpha',
      'kds_fixture_duplicate_beta',
    ]);
    expect(result.analysisRecords.map((record) => record.id)).toEqual([
      'kds_fixture_duplicate_alpha',
      'kds_fixture_duplicate_beta',
    ]);
    expect(result.records[1].quality.duplicateCandidates).toEqual([
      'kds_fixture_duplicate_alpha',
    ]);
    expect(result.notices).toContainEqual(
      expect.objectContaining({ code: 'DUPLICATE_CANDIDATE', recordId: 'kds_fixture_duplicate_beta' }),
    );
  });

  it('preserves publication null, ordered drawing metadata, and repeatable classifications without synthetic fields', () => {
    const record = makeRecord('kds_fixture_metadata', {
      publication: null,
      drawings: [makeDrawing('FIXTURE-DRAWING-2', 2), makeDrawing('FIXTURE-DRAWING-1', 1)],
      classifications: [
        {
          scheme: 'FIXTURE-SCHEME-A',
          code: 'FIXTURE-CLASS-A',
          label: '架空分類A',
          isPrimary: false,
        },
        {
          scheme: 'FIXTURE-SCHEME-B',
          code: 'FIXTURE-CLASS-B',
          label: null,
          isPrimary: true,
        },
      ],
    });

    const result = requireSuccess(adaptBackendDesignExport(makeExport([record])));
    const view = result.records[0];
    const analysisRecord = result.analysisRecords[0];

    expect(view.publication).toBeNull();
    expect('gazetteNumber' in view).toBe(false);
    expect(view.drawings.map((drawing) => drawing.order)).toEqual([1, 2]);
    expect(view.drawings.map((drawing) => drawing.drawingId)).toEqual([
      'FIXTURE-DRAWING-1',
      'FIXTURE-DRAWING-2',
    ]);
    expect(analysisRecord.classificationMemberships).toHaveLength(2);
    expect(analysisRecord.primaryClassification).toEqual(
      expect.objectContaining({ scheme: 'FIXTURE-SCHEME-B', code: 'FIXTURE-CLASS-B' }),
    );
    expect('businessDomain' in analysisRecord).toBe(false);
  });

  it('preserves omitted optional arrays instead of converting omission into a known empty set', () => {
    const omitted = makeRecord('kds_fixture_optional_omitted');
    delete omitted.keywords;
    delete omitted.designFeatures;
    const knownEmpty = makeRecord('kds_fixture_optional_empty', {
      keywords: [],
      designFeatures: [],
    });

    const result = requireSuccess(adaptBackendDesignExport(makeExport([omitted, knownEmpty])));

    expect('keywords' in result.records[0]).toBe(false);
    expect('keywords' in result.analysisRecords[0]).toBe(false);
    expect(result.analysisRecords[1].keywords).toEqual([]);
    expect(result.analysisRecords[1].designFeatures).toEqual([]);
  });

  it.each([
    'https://fixture.invalid/private-object',
    '  data:fixture-private-value',
    'C:\\private\\fixture-record.json',
    '../private/fixture-record.json',
    '..',
    'password=FIXTURE-DO-NOT-COPY',
    'Authorization: Bearer FIXTURE-DO-NOT-COPY',
    'X-Amz-Signature=FIXTURE-DO-NOT-COPY',
    'X-Amz-Security-Token=FIXTURE-DO-NOT-COPY',
    '-----BEGIN PRIVATE KEY-----FIXTURE',
    '-----BEGIN ENCRYPTED PRIVATE KEY-----FIXTURE',
  ])('fails closed on unsafe public provenance and does not repeat its value: %s', (unsafeValue) => {
    const payload = makeExport();
    payload.records[0].provenance.sourceRecordLocator = unsafeValue;

    const result = adaptBackendDesignExport(payload);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'UNSAFE_PUBLIC_PROVENANCE',
        path: '$.records[0].provenance.sourceRecordLocator',
      }),
    );
    expect(JSON.stringify(result)).not.toContain(unsafeValue);
  });

  it('allows path-free opaque namespace references', () => {
    const payload = makeExport();
    payload.records[0].provenance.sourceRecordLocator = 'fixture-row:alpha-001';
    payload.records[0].provenance.sourceArtifactRefs = ['fixture-artifact:alpha-001'];

    expect(adaptBackendDesignExport(payload).ok).toBe(true);
  });

  it.each([
    ['envelope processing version', (payload: BackendDesignExportV010, value: string) => {
      payload.backendProcessingVersion = value;
    }],
    ['record processing version', (payload: BackendDesignExportV010, value: string) => {
      payload.records[0].backendProcessingVersion = value;
    }],
    ['quality finding message', (payload: BackendDesignExportV010, value: string) => {
      payload.records[0].quality.findings = [
        { ...makeFinding('SOURCE_FIELD_WARNING', 'warning'), message: value },
      ];
    }],
    ['quality finding path', (payload: BackendDesignExportV010, value: string) => {
      payload.records[0].quality.findings = [
        { ...makeFinding('SOURCE_FIELD_WARNING', 'warning'), path: value },
      ];
    }],
  ] as const)('fails closed when %s contains unsafe audit text', (_label, mutate) => {
    for (const unsafeValue of ['Authorization: Bearer FIXTURE-AUDIT-TOKEN', '/home/fixture/private-record.json']) {
      const payload = makeExport();
      mutate(payload, unsafeValue);

      const result = adaptBackendDesignExport(payload);

      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors.some((error) => error.code === 'UNSAFE_PUBLIC_PROVENANCE')).toBe(true);
      expect(JSON.stringify(result)).not.toContain(unsafeValue);
    }
  });

  it('reports summary union and overlap counts with both invariants intact', () => {
    const result = requireSuccess(
      adaptBackendDesignExport(
        makeExport([
          makeRecord('kds_fixture_summary_pass'),
          makeRecord('kds_fixture_summary_warning_unknown', {
            designType: 'unknown',
            quality: makeQuality('warning', [makeFinding('SOURCE_FIELD_WARNING', 'warning')]),
          }),
          makeMissingDateRecord('kds_fixture_summary_quarantined_missing', {
            quality: makeQuality('quarantined', [
              makeFinding('GAZETTE_DATE_MISSING', 'warning'),
              makeFinding('SOURCE_RECORD_QUARANTINED', 'error'),
            ]),
          }),
        ]),
      ),
    );

    expect(result.summary).toMatchObject({
      totalRecordCount: 3,
      acceptedCount: 1,
      warningCount: 1,
      quarantinedCount: 1,
      excludedCount: 2,
      unknownDesignTypeCount: 1,
      missingGazetteDateCount: 1,
    });
    expect(result.summary.acceptedCount + result.summary.excludedCount).toBe(
      result.summary.totalRecordCount,
    );
    expect(
      result.summary.unresolvedApplicantCount + result.summary.unresolvedRightHolderCount,
    ).toBe(result.summary.unresolvedPartyCount);
  });
});

describe('BackendContractDataSource', () => {
  it('uses role-aware Backend memberships, deduplicates memberships/selectors, and never matches local origins', async () => {
    const duplicateApplicant = makeResolvedParty(
      'applicant',
      'FIXTURE-ENTITY-SHARED',
      '架空出願企業（重複行）',
    );
    const record = makeRecord('kds_fixture_membership', {
      applicants: [
        makeResolvedParty('applicant', 'FIXTURE-ENTITY-SHARED', '架空出願企業'),
        duplicateApplicant,
      ],
      rightHolders: [
        makeResolvedParty('right_holder', 'FIXTURE-ENTITY-SHARED', '架空権利企業'),
      ],
    });
    const adapted = requireSuccess(adaptBackendDesignExport(makeExport([record])));
    const source = new BackendContractDataSource(adapted);
    const applicantSelector = makeBackendSelector(
      'applicant',
      'FIXTURE-ENTITY-SHARED',
      '架空出願企業',
    );
    const holderSelector = makeBackendSelector(
      'right_holder',
      'FIXTURE-ENTITY-SHARED',
      '架空権利企業',
    );
    const applicantSelectorWithChangedLabel = makeBackendSelector(
      'applicant',
      'FIXTURE-ENTITY-SHARED',
      '表示名だけ変更した架空企業',
    );
    const localSelector: CompanySelector = {
      origin: 'sample',
      role: 'applicant',
      localKey: 'FIXTURE-ENTITY-SHARED',
      displayLabel: '架空ローカル企業',
    };

    expect(source.getAllRecords()[0].companyMemberships).toHaveLength(2);
    expect(companySelectorKey(applicantSelector)).not.toBe(companySelectorKey(holderSelector));
    expect(companySelectorKey(applicantSelector)).toBe(
      companySelectorKey(applicantSelectorWithChangedLabel),
    );
    expect(
      companySelectorMatchesMembership(
        applicantSelector,
        source.getAllRecords()[0].companyMemberships[0],
      ),
    ).toBe(true);
    expect(
      await source.query(
        makeRequest({
          mode: 'companies',
          companySelectors: [applicantSelector, applicantSelector, holderSelector],
        }),
      ),
    ).toHaveLength(1);
    expect(
      await source.query(
        makeRequest({ mode: 'companies', companySelectors: [localSelector] }),
      ),
    ).toEqual([]);
  });

  it('derives cutoff only from envelope sourceUpdatedAt and applies inclusive leap-clamped periods', async () => {
    const payload = makeExport(
      [
        makeRecord('kds_fixture_cutoff', { gazetteDate: '2024-02-29' }),
        makeRecord('kds_fixture_boundary', { gazetteDate: '2023-02-28' }),
        makeRecord('kds_fixture_before', { gazetteDate: '2023-02-27' }),
        makeRecord('kds_fixture_after_cutoff', { gazetteDate: '2024-03-01' }),
      ],
      { sourceUpdatedAt: '2024-02-29T12:00:00Z' },
    );
    const adapted = requireSuccess(adaptBackendDesignExport(payload));
    const source = new BackendContractDataSource(adapted);

    expect(source.getDataAsOf()).toBe('2024-02-29');
    expect(getBackendPeriodStart('2024-02-29', 'last_1y')).toBe('2023-02-28');
    expect(getBackendPeriodStart('2024-02-29', 'last_2y')).toBe('2022-02-28');
    expect((await source.query(makeRequest({ mode: 'all_classes' }, 'last_1y'))).map((record) => record.id)).toEqual([
      'kds_fixture_cutoff',
      'kds_fixture_boundary',
    ]);
    expect((await source.query(makeRequest({ mode: 'all_classes' }, 'last_2y'))).map((record) => record.id)).toEqual([
      'kds_fixture_cutoff',
      'kds_fixture_boundary',
      'kds_fixture_before',
    ]);
    expect(source.getViewRecords().find((record) => record.id === 'kds_fixture_after_cutoff')?.adapterDisposition.exclusionReasons).toEqual([
      'GAZETTE_DATE_AFTER_CUTOFF',
    ]);
    expect(source.getSummary().acceptedCount).toBe(3);
  });

  it('filters by known design kind and public source text without synthesizing businessDomain', async () => {
    const payload = makeExport([
      makeRecord('kds_fixture_product_image', {
        designType: 'image',
        articleName: '架空操作画面',
        keywords: ['架空医療'],
      }),
      makeRecord('kds_fixture_product_article', {
        designType: 'article',
        articleName: '架空表示器',
        keywords: ['架空家電'],
      }),
    ]);
    const source = new BackendContractDataSource(
      requireSuccess(adaptBackendDesignExport(payload)),
    );

    const records = await source.query({
      ...makeRequest({ mode: 'all_classes' }),
      designKinds: ['image'],
      productDomain: '医療',
    });

    expect(records.map((record) => record.id)).toEqual(['kds_fixture_product_image']);
    expect('businessDomain' in records[0]).toBe(false);
  });

  it('honors includeUnresolvedApplicants as a request filter without changing adapter counts', async () => {
    const unresolvedRef = 'fixture-party:query-unresolved';
    const payload = makeExport([
      makeRecord('kds_fixture_query_resolved'),
      makeRecord('kds_fixture_query_unresolved', {
        applicants: [makeUnresolvedParty('applicant', unresolvedRef)],
        unresolved: {
          applicants: [makeUnresolvedDetail(unresolvedRef)],
          rightHolders: [],
        },
      }),
    ]);
    const adapted = requireSuccess(adaptBackendDesignExport(payload));
    const source = new BackendContractDataSource(adapted);

    const records = await source.query({
      ...makeRequest({ mode: 'all_classes' }),
      includeUnresolvedApplicants: false,
    });

    expect(records.map((record) => record.id)).toEqual(['kds_fixture_query_resolved']);
    expect(source.getSummary().acceptedCount).toBe(2);
  });

  it('returns analysis-only records separately from all view records', () => {
    const adapted = requireSuccess(
      adaptBackendDesignExport(
        makeExport([
          makeRecord('kds_fixture_ready'),
          makeMissingDateRecord('kds_fixture_view_only'),
        ]),
      ),
    );
    const source = new BackendContractDataSource(adapted);

    expect(source.getAllRecords().map((record) => record.id)).toEqual(['kds_fixture_ready']);
    expect(source.getViewRecords().map((record) => record.id)).toEqual([
      'kds_fixture_ready',
      'kds_fixture_view_only',
    ]);
    expect(source.getExcludedRecords()[0].id).toBe('kds_fixture_view_only');
  });
});

function makeExport(
  records: BackendDesignRecordV010[] = [makeRecord('kds_fixture_alpha')],
  overrides: Partial<Omit<BackendDesignExportV010, 'records' | 'recordCount' | 'contractVersion'>> = {},
): BackendDesignExportV010 {
  return {
    contractVersion: '0.1.0',
    exportId: 'FIXTURE-EXPORT-001',
    generatedAt: '2026-08-10T12:00:00Z',
    sourceUpdatedAt: '2026-08-09T09:30:00Z',
    backendProcessingVersion: 'fixture-pipeline-0.1.0',
    recordCount: records.length,
    records,
    ...overrides,
  };
}

function makeRecord(
  id: string,
  overrides: Partial<BackendDesignRecordV010> = {},
): BackendDesignRecordV010 {
  return {
    id,
    applicationNumber: `FIXTURE-APP-${id}`,
    applicationDate: '2026-01-10',
    registrationNumber: null,
    registrationDate: null,
    gazetteDate: '2026-06-10',
    articleName: '架空表示装置',
    description: '完全架空の契約テスト用レコード。',
    articleDescription: null,
    designType: 'article',
    keywords: ['架空表示'],
    designFeatures: ['架空操作部'],
    applicants: [makeResolvedParty('applicant', 'FIXTURE-ENTITY-ALPHA', '架空企業アルファ')],
    rightHolders: [],
    classifications: [
      {
        scheme: 'FIXTURE-DESIGN-CLASS',
        code: 'FIXTURE-CLASS-A01',
        label: '架空表示分類',
        isPrimary: true,
      },
    ],
    publication: {
      gazetteNumber: 'FIXTURE-GAZETTE-001',
      publicationDocumentId: null,
      issueDate: '2026-06-10',
      sourceRef: 'fixture-publication:alpha',
    },
    drawings: [makeDrawing('FIXTURE-DRAWING-1', 1)],
    unresolved: { applicants: [], rightHolders: [] },
    provenance: {
      sourceDatasets: ['FIXTURE-DATASET-001'],
      sourceArtifactRefs: ['fixture-artifact:alpha'],
      processingRunId: 'FIXTURE-RUN-001',
      parserVersion: 'fixture-parser-0.1.0',
      normalizationVersion: 'fixture-normalizer-0.1.0',
      sourceRecordLocator: 'fixture-row:alpha',
    },
    quality: makeQuality('pass'),
    sourceUpdatedAt: '2026-06-11T00:00:00Z',
    backendProcessingVersion: 'fixture-pipeline-0.1.0',
    ...overrides,
  };
}

function makeMissingDateRecord(
  id: string,
  overrides: Partial<BackendDesignRecordV010> = {},
): BackendDesignRecordV010 {
  return makeRecord(id, {
    gazetteDate: null,
    quality: makeQuality('warning', [makeFinding('GAZETTE_DATE_MISSING', 'warning')]),
    ...overrides,
  });
}

function makeResolvedParty(
  role: BackendPartyRole,
  resolvedEntityId: string,
  displayName: string,
): BackendPartyV010 {
  return {
    role,
    rawName: displayName,
    displayName,
    normalizedNameCandidate: displayName,
    resolvedEntityId,
    resolutionStatus: 'resolved',
    sourceRef: `fixture-party:${role}:${resolvedEntityId}`,
  };
}

function makeUnresolvedParty(role: BackendPartyRole, sourceRef: string): BackendPartyV010 {
  return {
    role,
    rawName: '架空未解決名称',
    displayName: null,
    normalizedNameCandidate: '架空未解決候補',
    resolvedEntityId: null,
    resolutionStatus: 'unresolved',
    sourceRef,
  };
}

function makeUnresolvedDetail(sourceRef: string): BackendUnresolvedPartyV010 {
  return {
    rawValue: '架空未解決名称',
    code: 'FIXTURE-UNRESOLVED-CODE',
    reason: 'ambiguous_match',
    sourceRef,
  };
}

function makeDrawing(drawingId: string, order: number) {
  return {
    drawingId,
    label: `架空図面${order}`,
    fileName: `fixture-${order}.png`,
    mediaType: 'image/png',
    order,
    isRepresentativeCandidate: order === 1,
    sourceDocumentRef: `fixture-document:drawing-${order}`,
  };
}

function makeFinding(code: string, severity: 'info' | 'warning' | 'error') {
  return {
    code,
    severity,
    message: '完全架空の品質所見。',
    path: '$.records[fixture]',
  };
}

function makeQuality(
  state: 'pass' | 'warning' | 'quarantined',
  findings = state === 'pass' ? [] : [makeFinding('SOURCE_FIELD_WARNING', 'warning')],
  duplicateCandidates: string[] = [],
) {
  return { state, findings, duplicateCandidates };
}

function makeBackendSelector(
  role: BackendPartyRole,
  resolvedEntityId: string,
  displayLabel: string,
): CompanySelector {
  return { origin: 'backend', role, resolvedEntityId, displayLabel };
}

function makeRequest(
  scope: AnalysisRequest['scope'],
  period: AnalysisRequest['period'] = 'last_1y',
): AnalysisRequest {
  return {
    scope,
    period,
    designKinds: ['article', 'image', 'interior'],
    purposes: ['market_trend'],
    departments: ['product_planning'],
  };
}

function requireSuccess(result: ReturnType<typeof adaptBackendDesignExport>): BackendContractAdapterSuccess {
  expect(result.ok, result.ok ? undefined : JSON.stringify(result.errors)).toBe(true);
  if (!result.ok) throw new Error('Expected Backend contract adaptation to succeed.');
  return result;
}

function failureCodes(result: ReturnType<typeof adaptBackendDesignExport>): string[] {
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors.map((error) => error.code);
}

function invalidRecordCount(): BackendDesignExportV010 {
  const payload = makeExport();
  payload.recordCount += 1;
  return payload;
}

function invalidDuplicateRecordId(): BackendDesignExportV010 {
  return makeExport([
    makeRecord('kds_fixture_duplicate_id'),
    makeRecord('kds_fixture_duplicate_id'),
  ]);
}

function invalidDuplicateCandidate(): BackendDesignExportV010 {
  return makeExport([
    makeRecord('kds_fixture_dangling_candidate', {
      quality: makeQuality('warning', [], ['kds_fixture_not_present']),
    }),
  ]);
}

function invalidUnresolvedDetail(): BackendDesignExportV010 {
  const sourceRef = 'fixture-party:unmatched';
  return makeExport([
    makeRecord('kds_fixture_unmatched_unresolved', {
      applicants: [makeUnresolvedParty('applicant', sourceRef)],
      unresolved: {
        applicants: [makeUnresolvedDetail('fixture-party:different')],
        rightHolders: [],
      },
    }),
  ]);
}

function invalidPrimaryClassifications(): BackendDesignExportV010 {
  return makeExport([
    makeRecord('kds_fixture_multiple_primary', {
      classifications: [
        { scheme: 'FIXTURE-A', code: 'FIXTURE-A1', label: null, isPrimary: true },
        { scheme: 'FIXTURE-B', code: 'FIXTURE-B1', label: null, isPrimary: true },
      ],
    }),
  ]);
}

function invalidDrawingOrder(): BackendDesignExportV010 {
  return makeExport([
    makeRecord('kds_fixture_duplicate_drawing_order', {
      drawings: [makeDrawing('FIXTURE-DRAWING-A', 1), makeDrawing('FIXTURE-DRAWING-B', 1)],
    }),
  ]);
}

function invalidMissingDateFinding(): BackendDesignExportV010 {
  return makeExport([
    makeRecord('kds_fixture_missing_finding', {
      gazetteDate: null,
      quality: makeQuality('warning', []),
    }),
  ]);
}
