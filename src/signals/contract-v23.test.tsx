import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContractError, decodeBootstrap, decodeComparisonPairs, decodeRun, decodeRuns, type RunV23, type SelectedDailyCollectionContext } from './contract';
import { fictionalBootstrapV22, fictionalComparisonPair, fictionalRunV22 } from './fixtures-v22';
import { SignalResult } from './SignalResult';

function dailyCollection(cutoffDate: string, selectedIssueDates: string[]): SelectedDailyCollectionContext {
  const weekly = fictionalRunV22.input.context.beforeDataset.collection;
  if (!weekly) throw new Error('Fictional reconstruction is required');
  return {
    ...structuredClone(weekly),
    kind: 'retrospective_selected_daily_gazettes',
    commonStartDate: '2026-08-09',
    cutoffDate,
    selectedIssueDates,
  };
}

function dailyRun(): RunV23 {
  const prior = structuredClone(fictionalRunV22);
  return {
    ...prior,
    id: 'run-fixture-daily-one',
    schemaVersion: '2.3.0',
    input: {
      ...prior.input,
      context: {
        ...prior.input.context,
        beforeDataset: { ...prior.input.context.beforeDataset, collection: dailyCollection('2026-08-09', ['2026-08-09']) },
        afterDataset: { ...prior.input.context.afterDataset, collection: dailyCollection('2026-09-18', ['2026-08-09', '2026-09-18']) },
      },
    },
    versions: { ...prior.versions, schema: '2.3.0' },
  };
}

describe('selected daily gazette reconstruction contract 2.3.0', () => {
  it('accepts the versioned catalog and saved reconstruction with its selected dates', () => {
    const run = dailyRun();
    const bootstrap = { ...fictionalBootstrapV22, schemaVersion: '2.3.0' };
    const pairs = { schemaVersion: '2.3.0', comparisonPairs: [fictionalComparisonPair] };
    expect(decodeBootstrap(bootstrap)).toEqual(bootstrap);
    expect(decodeComparisonPairs(pairs, run.input.watch)).toEqual(pairs);
    expect(decodeRun(run)).toEqual(run);
    expect(decodeRuns({ schemaVersion: '2.3.0', runs: [fictionalRunV22, run] })).toHaveLength(2);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('選定した日刊公報からの遡及再構成収録集合');
    expect(html).toContain('選定した公報日：2026-08-09、2026-09-18');
    expect(html).toContain('全公報・全件の収録は示しません');
  });

  it('rejects false cutoffs, reordered dates, nonprefix pairs and retroactive reinterpretation of 2.2', () => {
    const run = dailyRun();
    const badCutoff = structuredClone(run);
    badCutoff.input.context.beforeDataset.collection!.cutoffDate = '2026-08-10';
    expect(() => decodeRun(badCutoff)).toThrow(ContractError);
    const badOrder = structuredClone(run);
    const after = badOrder.input.context.afterDataset.collection;
    if (after?.kind !== 'retrospective_selected_daily_gazettes') throw new Error('Daily fixture is required');
    after.selectedIssueDates.reverse();
    expect(() => decodeRun(badOrder)).toThrow(ContractError);
    const badPrefix = structuredClone(run);
    const before = badPrefix.input.context.beforeDataset.collection;
    if (before?.kind !== 'retrospective_selected_daily_gazettes') throw new Error('Daily fixture is required');
    before.selectedIssueDates = ['2026-08-01', '2026-08-09'];
    before.commonStartDate = '2026-08-01';
    const afterPrefix = badPrefix.input.context.afterDataset.collection;
    if (afterPrefix?.kind !== 'retrospective_selected_daily_gazettes') throw new Error('Daily fixture is required');
    afterPrefix.commonStartDate = '2026-08-01';
    afterPrefix.selectedIssueDates = ['2026-08-01', '2026-09-18'];
    expect(() => decodeRun(badPrefix)).toThrow(ContractError);
    expect(() => decodeRun({ ...run, schemaVersion: '2.2.0', versions: { ...run.versions, schema: '2.2.0' } })).toThrow(ContractError);
  });
});
