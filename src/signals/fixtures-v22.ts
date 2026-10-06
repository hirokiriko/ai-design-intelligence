import { decodeRun, type Bootstrap, type ComparisonPair, type ComparisonPairs, type RunV22 } from './contract';
import reconstruction from './backend-run-v2.1.fixture.json';
import { fictionalBootstrapV2 } from './fixtures';

// 架空の旧公開fixtureから、新版の組選択・保存表示だけを検証する入力を組み立てる。
const previous = decodeRun(structuredClone(reconstruction));
if (previous.schemaVersion !== '2.1.0' || !previous.signal || previous.signal.media.length !== 2) throw new Error('Fictional reconstruction fixture is incomplete');

export const fictionalComparisonPair: ComparisonPair = {
  id: 'fixture-pair-one', label: '架空の操作部比較 1', evidence: '管理者が同方向の架空図面を比較対象として確認しました。商品の新旧世代は未確認です。',
  entityId: previous.input.watch.entityId, categoryId: previous.input.watch.categoryId,
  beforeDatasetId: previous.input.watch.beforeDatasetId, afterDatasetId: previous.input.watch.afterDatasetId,
  media: [structuredClone(previous.signal.media[0]), structuredClone(previous.signal.media[1])],
};
export const fictionalPairsResponse: ComparisonPairs = { schemaVersion: '2.2.0', comparisonPairs: [fictionalComparisonPair] };
export const fictionalBootstrapV22: Bootstrap = { ...fictionalBootstrapV2, schemaVersion: '2.2.0' };
export const fictionalRunV22: RunV22 = {
  ...previous, id: 'run-fixture-pair-one', schemaVersion: '2.2.0',
  input: { ...previous.input, comparisonPair: fictionalComparisonPair },
  versions: { ...previous.versions, schema: '2.2.0' },
};
