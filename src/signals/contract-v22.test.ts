import { describe, expect, it } from 'vitest';
import { ContractError, decodeBootstrap, decodeComparisonPairs, decodeRun, decodeRuns } from './contract';
import reconstruction from './backend-run-v2.1.fixture.json';
import backendPairRun from './backend-run-v2.2.fixture.json';
import backendPairCatalog from './backend-comparison-pairs-v2.2.fixture.json';
import { fictionalBootstrapV22, fictionalComparisonPair, fictionalPairsResponse, fictionalRunV22 } from './fixtures-v22';

describe('registered comparison pair contract 2.2.0', () => {
  it('decodes the new catalog and saved run without changing older run versions', () => {
    expect(decodeBootstrap(fictionalBootstrapV22)).toEqual(fictionalBootstrapV22);
    expect(decodeComparisonPairs(fictionalPairsResponse, fictionalRunV22.input.watch)).toEqual(fictionalPairsResponse);
    expect(decodeRun(fictionalRunV22)).toEqual(fictionalRunV22);
    expect(decodeRun(backendPairRun)).toEqual(backendPairRun);
    const saved = decodeRun(backendPairRun);
    expect(decodeComparisonPairs(backendPairCatalog, saved.input.watch)).toEqual(backendPairCatalog);
    if (saved.schemaVersion !== '2.2.0') throw new Error('Backend fixture must use 2.2.0');
    expect(backendPairCatalog.comparisonPairs[0]).toEqual(saved.input.comparisonPair);
    expect(backendPairCatalog.comparisonPairs).toHaveLength(2);
    expect(decodeRuns({ schemaVersion: '2.2.0', runs: [reconstruction, fictionalRunV22] })).toHaveLength(2);
  });

  it('rejects cross-scope, repeated, reversed and unregistered pair details', () => {
    const watch = fictionalRunV22.input.watch;
    const wrongScope = { ...fictionalComparisonPair, categoryId: 'other-category' };
    expect(() => decodeComparisonPairs({ schemaVersion: '2.2.0', comparisonPairs: [wrongScope] }, watch)).toThrow(ContractError);
    expect(() => decodeComparisonPairs({ schemaVersion: '2.2.0', comparisonPairs: [fictionalComparisonPair, fictionalComparisonPair] }, watch)).toThrow(ContractError);
    const reversed = structuredClone(fictionalComparisonPair);
    reversed.media.reverse();
    expect(() => decodeComparisonPairs({ schemaVersion: '2.2.0', comparisonPairs: [reversed] }, watch)).toThrow(ContractError);
    expect(() => decodeComparisonPairs({ schemaVersion: '2.2.0', comparisonPairs: [{ ...fictionalComparisonPair, imageUrl: 'https://example.test/image.png' }] }, watch)).toThrow(ContractError);
    expect(() => decodeComparisonPairs({ schemaVersion: '2.1.0', comparisonPairs: [] }, watch)).toThrow(ContractError);
  });

  it('allows one unchanged record to appear in both dated datasets with distinct media', () => {
    const pair = structuredClone(fictionalComparisonPair);
    pair.media[1].recordId = pair.media[0].recordId;
    expect(decodeComparisonPairs({ schemaVersion: '2.2.0', comparisonPairs: [pair] }, fictionalRunV22.input.watch).comparisonPairs[0]).toEqual(pair);
  });

  it('keeps old run shapes strict and requires an immutable saved selection in new runs', () => {
    const missing = structuredClone(fictionalRunV22);
    const { comparisonPair: omitted, ...input } = missing.input;
    expect(omitted).not.toBeNull();
    expect(() => decodeRun({ ...missing, input })).toThrow(ContractError);
    expect(() => decodeRun({ ...reconstruction, input: { ...reconstruction.input, comparisonPair: fictionalComparisonPair } })).toThrow(ContractError);
    expect(() => decodeRun({ ...missing, input: { ...missing.input, comparisonPair: { ...fictionalComparisonPair, afterDatasetId: 'different-dataset' } } })).toThrow(ContractError);
    expect(() => decodeRun({ ...missing, versions: { ...missing.versions, schema: '2.1.0' } })).toThrow(ContractError);
    missing.signal!.media[0].label = '現在のcatalogにある別の図面';
    expect(() => decodeRun(missing)).toThrow(ContractError);
  });

  it('accepts a saved null selection for an image-free or existing unambiguous watch', () => {
    const run = structuredClone(fictionalRunV22);
    run.input.comparisonPair = null;
    expect(decodeRun(run)).toEqual(run);
    run.signal = null; run.status = 'failed'; run.completedAt = '2026-09-20T01:00:00Z';
    expect(decodeRun(run)).toEqual(run);
  });
});
