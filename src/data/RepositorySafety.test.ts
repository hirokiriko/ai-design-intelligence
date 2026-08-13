import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface FictionalParty {
  role: 'applicant' | 'right_holder';
  rawName: string | null;
  displayName: string | null;
  normalizedNameCandidate: string | null;
  resolvedEntityId: string | null;
  resolutionStatus: 'resolved' | 'unresolved';
  sourceRef: string;
}

interface FictionalUnresolvedParty {
  rawValue: string;
  sourceRef: string;
}

interface FictionalRecord {
  id: string;
  applicationNumber: string | null;
  registrationNumber: string | null;
  gazetteDate: string | null;
  designType: 'article' | 'image' | 'interior' | 'unknown';
  applicants: FictionalParty[];
  rightHolders: FictionalParty[];
  classifications: Array<{
    scheme: string;
    code: string;
    isPrimary: boolean;
  }>;
  publication: null | {
    gazetteNumber: string | null;
    publicationDocumentId: string | null;
  };
  drawings: Array<{
    drawingId: string;
    order: number;
  }>;
  unresolved: {
    applicants: FictionalUnresolvedParty[];
    rightHolders: FictionalUnresolvedParty[];
  };
  quality: {
    state: 'pass' | 'warning' | 'quarantined';
    findings: Array<{ code: string }>;
    duplicateCandidates: string[];
  };
}

interface FictionalContractFixture {
  contractVersion: string;
  exportId: string;
  sourceUpdatedAt: string;
  recordCount: number;
  records: FictionalRecord[];
}

const repositoryRoot = process.cwd();
const safetyScript = path.resolve(repositoryRoot, 'scripts', 'check-no-real-data.mjs');
const fixturePath = path.resolve(
  repositoryRoot,
  'fixtures',
  'backend-contract-v0.1.0',
  'design-export-fictional.json',
);

describe('repository fixture safety', () => {
  it('scans real-data-like filenames under the root fixtures directory', () => {
    expectFixtureScanToFail(
      ['design-', 'records-fixture.json'].join(''),
      JSON.stringify({ fixture: true }),
    );
  });

  it.each([
    [
      'real-like long identifier',
      JSON.stringify({ publicationDocumentId: ['1234', '5678'].join('') }),
    ],
    [
      'external URL',
      JSON.stringify({ sourceArtifactRef: ['https', '://fixture.invalid/object'].join('') }),
    ],
    [
      'absolute local path',
      JSON.stringify({ sourceArtifactRef: ['C:', '\\', 'private', '\\', 'fixture.json'].join('') }),
    ],
    [
      'secret-like assignment',
      JSON.stringify({ password: ['fixture', '-sentinel-value'].join('') }),
    ],
  ])('scans %s content under the root fixtures directory', (_label, content) => {
    expectFixtureScanToFail('unsafe-fixture.json', content);
  });

  it('keeps the committed contract fixture fictional and public-safe', () => {
    const fixture = readFixture();
    const serialized = JSON.stringify(fixture);

    expect(fixture.contractVersion).toBe('0.1.0');
    expect(fixture.exportId).toMatch(/^FIXTURE-/);
    expect(fixture.recordCount).toBe(7);
    expect(fixture.records).toHaveLength(7);

    const recordIds = fixture.records.map((record) => record.id);
    expect(recordIds.every((id) => id.startsWith('kds_fixture_'))).toBe(true);
    expect(new Set(recordIds).size).toBe(recordIds.length);

    for (const record of fixture.records) {
      expectFixtureIdentifier(record.applicationNumber);
      expectFixtureIdentifier(record.registrationNumber);
      expectFixtureIdentifier(record.publication?.gazetteNumber ?? null);
      expectFixtureIdentifier(record.publication?.publicationDocumentId ?? null);

      for (const party of [...record.applicants, ...record.rightHolders]) {
        expect(party.rawName).toContain('架空');
        expect(party.displayName).toContain('架空');
        expect(party.normalizedNameCandidate).toContain('架空');
        if (party.resolutionStatus === 'resolved') {
          expect(party.resolvedEntityId).toMatch(/^FIXTURE-/);
        } else {
          expect(party.resolvedEntityId).toBeNull();
        }
      }

      for (const unresolved of [...record.unresolved.applicants, ...record.unresolved.rightHolders]) {
        expect(unresolved.rawValue).toContain('架空');
      }
    }

    const forbiddenCompanies = [
      ['Pana', 'sonic'].join(''),
      ['Phil', 'ips'].join(''),
      ['Shark', 'Ninja'].join(''),
      ['Mi', 'dea'].join(''),
      ['Sam', 'sung'].join(''),
    ];
    forbiddenCompanies.forEach((company) => expect(serialized).not.toMatch(new RegExp(company, 'i')));

    expect(serialized).not.toMatch(/\b\d{7,}\b/);
    expect(serialized).not.toMatch(/[A-Za-z]:[\\/]/);
    expect(serialized).not.toMatch(/\\{2,}/);
    expect(serialized).not.toMatch(/(?:\/Users\/|\/home\/[^/]+\/)/i);
    expect(serialized).not.toMatch(/\b(?:https?|data|file):/i);
    expect(serialized).not.toMatch(
      /"(?:api[_-]?key|access[_-]?token|password|secret|connection[_-]?string)"\s*:\s*"[^"]+"/i,
    );
    expect(serialized).not.toMatch(new RegExp(['BEGIN', ' [A-Z ]*PRIVATE KEY'].join(''), 'i'));
    expect(serialized).not.toMatch(
      new RegExp(['JP', 'DAD|JP', 'WAD|JP', 'DRD|JP', 'WRD|JP', 'DAC|JP', 'WAC|JP', 'D_'].join('')),
    );
  });

  it('covers contract semantics and the expected overlapping summary counts', () => {
    const fixture = readFixture();
    const recordIds = new Set(fixture.records.map((record) => record.id));
    const cutoff = fixture.sourceUpdatedAt.slice(0, 10);

    expect(fixture.sourceUpdatedAt).toBe('2026-08-10T12:00:00Z');

    for (const record of fixture.records) {
      expect(record.classifications.length).toBeGreaterThan(0);
      expect(record.classifications.filter((classification) => classification.isPrimary)).toHaveLength(
        record.classifications.some((classification) => classification.isPrimary) ? 1 : 0,
      );
      expect(
        new Set(record.classifications.map((classification) => `${classification.scheme}:${classification.code}`)).size,
      ).toBe(record.classifications.length);

      const drawingOrders = record.drawings.map((drawing) => drawing.order);
      expect(new Set(drawingOrders).size).toBe(drawingOrders.length);
      expect(drawingOrders.every((order) => Number.isInteger(order) && order > 0)).toBe(true);

      record.quality.duplicateCandidates.forEach((candidateId) => expect(recordIds.has(candidateId)).toBe(true));
      expectUnresolvedSourceRefsToMatch(record.applicants, record.unresolved.applicants);
      expectUnresolvedSourceRefsToMatch(record.rightHolders, record.unresolved.rightHolders);

      if (record.gazetteDate === null) {
        expect(record.quality.findings.some((finding) => finding.code === 'GAZETTE_DATE_MISSING')).toBe(true);
      }
    }

    const alpha = fixture.records.find((record) => record.id === 'kds_fixture_alpha');
    const beta = fixture.records.find((record) => record.id === 'kds_fixture_beta');
    const gamma = fixture.records.find((record) => record.id === 'kds_fixture_gamma');
    const eta = fixture.records.find((record) => record.id === 'kds_fixture_eta');

    expect(alpha?.applicants).toHaveLength(2);
    expect(new Set(alpha?.applicants.map((party) => party.resolvedEntityId)).size).toBe(1);
    expect(beta?.quality.duplicateCandidates).toEqual(['kds_fixture_alpha']);
    expect(gamma?.publication).toBeNull();
    expect(gamma?.classifications.length).toBeGreaterThan(1);
    expect(gamma?.drawings.length).toBeGreaterThan(1);
    expect(eta?.gazetteDate && eta.gazetteDate > cutoff).toBe(true);

    const acceptedCount = fixture.records.filter((record) => blockingReasonCount(record, cutoff) === 0).length;
    const excludedCount = fixture.records.length - acceptedCount;
    const warningCount = fixture.records.filter((record) => record.quality.state === 'warning').length;
    const quarantinedCount = fixture.records.filter((record) => record.quality.state === 'quarantined').length;
    const unknownDesignTypeCount = fixture.records.filter((record) => record.designType === 'unknown').length;
    const missingGazetteDateCount = fixture.records.filter((record) => record.gazetteDate === null).length;
    const unresolvedApplicantCount = countUnresolved(fixture.records.flatMap((record) => record.applicants));
    const unresolvedRightHolderCount = countUnresolved(fixture.records.flatMap((record) => record.rightHolders));
    const unresolvedPartyCount = unresolvedApplicantCount + unresolvedRightHolderCount;

    expect({
      totalRecordCount: fixture.records.length,
      acceptedCount,
      excludedCount,
      warningCount,
      quarantinedCount,
      unknownDesignTypeCount,
      missingGazetteDateCount,
      unresolvedApplicantCount,
      unresolvedRightHolderCount,
      unresolvedPartyCount,
    }).toEqual({
      totalRecordCount: 7,
      acceptedCount: 3,
      excludedCount: 4,
      warningCount: 2,
      quarantinedCount: 1,
      unknownDesignTypeCount: 1,
      missingGazetteDateCount: 1,
      unresolvedApplicantCount: 1,
      unresolvedRightHolderCount: 1,
      unresolvedPartyCount: 2,
    });
    expect(acceptedCount + excludedCount).toBe(fixture.records.length);
    expect(unresolvedPartyCount).toBe(unresolvedApplicantCount + unresolvedRightHolderCount);
  });
});

function readFixture(): FictionalContractFixture {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as FictionalContractFixture;
}

function expectFixtureIdentifier(value: string | null): void {
  if (value !== null) expect(value).toMatch(/^FIXTURE-/);
}

function expectUnresolvedSourceRefsToMatch(
  parties: FictionalParty[],
  unresolvedDetails: FictionalUnresolvedParty[],
): void {
  const partyRefs = parties
    .filter((party) => party.resolutionStatus === 'unresolved')
    .map((party) => party.sourceRef)
    .sort();
  const detailRefs = unresolvedDetails.map((detail) => detail.sourceRef).sort();

  expect(detailRefs).toEqual(partyRefs);
}

function blockingReasonCount(record: FictionalRecord, cutoff: string): number {
  return [
    record.quality.state === 'quarantined',
    record.gazetteDate === null,
    record.gazetteDate !== null && record.gazetteDate > cutoff,
    record.designType === 'unknown',
  ].filter(Boolean).length;
}

function countUnresolved(parties: FictionalParty[]): number {
  return parties.filter((party) => party.resolutionStatus === 'unresolved').length;
}

function expectFixtureScanToFail(fileName: string, content: string): void {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repository-fixture-safety-'));
  const fixtureDirectory = path.join(tempRoot, 'fixtures', 'backend-contract-v0.1.0');

  try {
    fs.mkdirSync(fixtureDirectory, { recursive: true });
    fs.writeFileSync(path.join(fixtureDirectory, fileName), content, 'utf8');
    expect(() =>
      execFileSync(process.execPath, [safetyScript, '--root', tempRoot], { stdio: 'pipe' }),
    ).toThrow();
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
