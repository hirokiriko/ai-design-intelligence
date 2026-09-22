import { describe, expect, it } from 'vitest';
import { ContractError, decodeBootstrap, decodeRun, decodeRuns } from './contract';
import { fictionalBootstrap, fictionalRun } from './fixtures';

describe('public signal supplemental contract 1.0.0', () => {
  it('accepts fictional bootstrap, saved result, and history without changing Contract 0.1.0', () => {
    expect(decodeBootstrap(fictionalBootstrap)).toEqual(fictionalBootstrap);
    expect(decodeRun(fictionalRun)).toEqual(fictionalRun);
    expect(decodeRuns({ schemaVersion: '1.0.0', runs: [fictionalRun] })).toHaveLength(1);
  });
  it.each(['0.1.0', '1.1.0', undefined])('rejects incompatible version %s', (schemaVersion) => {
    expect(() => decodeRun({ ...fictionalRun, schemaVersion })).toThrow(ContractError);
  });
  it('rejects unexpected private fields and mismatched watch references', () => {
    expect(() => decodeRun({ ...fictionalRun, internalLocation: 'private' })).toThrow(ContractError);
    expect(() => decodeRun({ ...fictionalRun, watchId: 'another-watch' })).toThrow(ContractError);
    const bootstrap = structuredClone(fictionalBootstrap);
    bootstrap.watches[0].entityId = 'name-only-company';
    expect(() => decodeBootstrap(bootstrap)).toThrow(ContractError);
  });
  it.each(['javascript:alert(1)', 'http://leaf.example.test/news', 'https://user:pass@leaf.example.test/news', 'https://127.0.0.1/news', 'https://metadata.google.internal/news', 'https://storage.googleapis.com/private', 'https://leaf.example.test/news?token=secret'])('rejects unsafe source %s', (url) => {
    const run = structuredClone(fictionalRun);
    run.signal!.sources[0].url = url;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('rejects dangling evidence, invented quotes, and duplicate ids', () => {
    const run = structuredClone(fictionalRun);
    run.signal!.hypotheses[0].evidenceIds = ['invented'];
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.signal!.hypotheses[0].evidenceIds = ['official-1'];
    run.signal!.officialFacts[0].quote = '存在しない抜粋';
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.signal!.officialFacts = [];
    run.signal!.hypotheses = [];
    run.signal!.visualObservations[0].mediaIds = ['unknown-image'];
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.signal!.visualObservations = [];
    run.signal!.media[1].id = run.signal!.media[0].id;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('accepts no-change, insufficient and image-free results without inventing evidence', () => {
    for (const status of ['no_change', 'insufficient', 'comparison_unavailable'] as const) {
      const run = structuredClone(fictionalRun);
      Object.assign(run.signal!, { status, visualObservations: [], hypotheses: [], media: [] });
      run.signal!.counts.newlyObserved = 0;
      expect(decodeRun(run).signal?.status).toBe(status);
    }
  });
  it('distinguishes interrupted and failed from complete and rejects missing completion data', () => {
    for (const status of ['failed', 'interrupted', 'running'] as const) expect(decodeRun({ ...fictionalRun, status, completedAt: null, signal: null }).status).toBe(status);
    expect(() => decodeRun({ ...fictionalRun, signal: null })).toThrow(ContractError);
  });
  it('rejects schema size violations, missing both visual inputs, and contradictory status', () => {
    const run = structuredClone(fictionalRun);
    run.signal!.designFacts[0].text = 'x'.repeat(1501);
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.signal!.designFacts[0].text = '架空の事実';
    run.signal!.visualObservations[0].mediaIds = ['media-a'];
    expect(() => decodeRun(run)).toThrow(ContractError);
    run.signal!.visualObservations[0].mediaIds = ['media-a', 'media-b'];
    run.signal!.status = 'no_change';
    expect(() => decodeRun(run)).toThrow(ContractError);
  });
  it('accepts canonical Unicode evidence IDs but still rejects non-opaque API resource IDs', () => {
    const run = structuredClone(fictionalRun);
    run.signal!.visualObservations[0].id = '観察-1';
    run.signal!.hypotheses[0].evidenceIds = ['観察-1', 'official-1'];
    expect(decodeRun(run).signal!.visualObservations[0].id).toBe('観察-1');
    expect(() => decodeRun({ ...run, id: '実行-1' })).toThrow(ContractError);
  });
});
