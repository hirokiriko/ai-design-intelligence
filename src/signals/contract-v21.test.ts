import { describe, expect, it } from 'vitest';
import { ContractError, decodeBootstrap, decodeRun, decodeRuns } from './contract';
import { fictionalBootstrapV2, fictionalRun, fictionalRunV2 } from './fixtures';
import backendReconstruction from './backend-run-v2.1.fixture.json';

function reconstructionRun() {
  const run = decodeRun(structuredClone(backendReconstruction));
  if (run.schemaVersion !== '2.1.0') throw new Error('Fixture must use 2.1.0');
  return run;
}

describe('public reconstruction context 2.1.0', () => {
  it('accepts the backend fictional artifact and retains all existing counts and evidence', () => {
    expect(decodeRun(backendReconstruction)).toEqual(backendReconstruction);
    expect(decodeBootstrap({ ...fictionalBootstrapV2, schemaVersion: '2.1.0' }).catalog).toEqual(fictionalBootstrapV2.catalog);
    expect(decodeRuns({ schemaVersion: '2.1.0', runs: [fictionalRun, fictionalRunV2, backendReconstruction] })).toEqual([fictionalRun, fictionalRunV2, backendReconstruction]);
  });

  it('requires the explicit version and both saved collection fields', () => {
    const run = reconstructionRun();
    expect(() => decodeRun({ ...run, schemaVersion: '2.0.0', versions: { ...run.versions, schema: '2.0.0' } })).toThrow(ContractError);
    expect(() => decodeRun({ ...run, schemaVersion: '2.2.0' })).toThrow(ContractError);
    expect(() => decodeRun({ ...run, versions: { ...run.versions, schema: '2.0.0' } })).toThrow(ContractError);
    const { collection: omitted, ...withoutCollection } = run.input.context.beforeDataset;
    expect(omitted).not.toBeNull();
    expect(() => decodeRun({ ...run, input: { ...run.input, context: { ...run.input.context, beforeDataset: withoutCollection } } })).toThrow(ContractError);
    run.input.context.beforeDataset.collection = null;
    run.input.context.afterDataset.collection = null;
    expect(decodeRun(run)).toEqual(run);
  });

  it('keeps unknown acquisition separate from local verification and accepts a proven interval', () => {
    const run = reconstructionRun();
    const collection = run.input.context.beforeDataset.collection!;
    expect(collection.sourceAcquiredFrom).toBeNull();
    expect(collection.sourceAcquiredThrough).toBeNull();
    collection.sourceAcquiredFrom = '2026-09-19T00:00:00Z';
    collection.sourceAcquiredThrough = '2026-09-20T00:00:00Z';
    expect(decodeRun(run)).toEqual(run);
  });

  it('compares Japanese publication dates with local verification across UTC midnight', () => {
    const run = reconstructionRun();
    const collection = run.input.context.afterDataset.collection!;
    collection.locallyVerifiedAt = '2026-09-17T15:00:00Z';
    expect(decodeRun(run)).toEqual(run);
    collection.locallyVerifiedAt = '2026-09-17T14:59:59Z';
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it('rejects invented timing, invalid hashes and unsupported provenance fields', () => {
    const mutations = [
      { cutoffDate: '2026-08-10' }, { commonStartDate: '2026-08-10' },
      { commonStartDate: '2026-02-31' }, { reconstructedAt: '2026-09-20T00:00:00Z' },
      { locallyVerifiedAt: '2026-09-23T00:00:00Z' }, { locallyVerifiedAt: '2026-09-21' },
      { locallyVerifiedAt: '2026-09-20T24:00:00Z' },
      { sourceAcquiredFrom: '2026-09-19T00:00:00Z' },
      { sourceAcquiredFrom: '2026-09-20T00:00:00Z', sourceAcquiredThrough: '2026-09-19T00:00:00Z' },
      { sourceAcquiredFrom: '2026-09-20T00:00:00Z', sourceAcquiredThrough: '2026-09-22T00:00:00Z' },
      { policySha256: 'g'.repeat(64) }, { archiveSetSha256: 'unknown' },
      { sourceFamilies: [] }, { sourceFamilies: ['FIXTURE-WEEKLY', 'FIXTURE-WEEKLY'] },
      { sourceFamilies: ['FIXTURE-Z', 'FIXTURE-A'] }, { limitations: [] },
      { localPath: 'private' }, { cutoffBasis: 'file_mtime' }, { kind: 'service_snapshot' },
    ];
    for (const mutation of mutations) {
      const run = reconstructionRun();
      Object.assign(run.input.context.beforeDataset.collection!, mutation);
      expect(() => decodeRun(run), JSON.stringify(mutation)).toThrow(ContractError);
    }
  });

  it('does not report comparable counts for a mixed or differently reconstructed pair', () => {
    const run = reconstructionRun();
    run.input.context.afterDataset.collection!.policySha256 = 'b'.repeat(64);
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.signal!.counts.comparable = false;
    run.signal!.status = 'comparison_unavailable';
    expect(decodeRun(run)).toEqual(run);
    run.input.context.afterDataset.collection = null;
    expect(decodeRun(run)).toEqual(run);
    run.signal!.counts.comparable = true;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
});
