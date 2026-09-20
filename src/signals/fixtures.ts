import type { Bootstrap, Run } from './contract';

// すべて架空。ブラウザ検証と契約回帰テスト専用で、実データではない。
export const fictionalBootstrap: Bootstrap = {
  schemaVersion: '1.0.0', dataMode: 'fictional', csrfToken: 'fictional-csrf-token',
  catalog: {
    entities: [{ id: 'entity-example', name: '架空リーフ機器株式会社' }],
    categories: [{ id: 'category-controller', label: '操作機器 / H1' }],
    datasets: [{ id: 'dataset-before', dataAsOf: '2026-06-01', coverage: '架空の比較A収録範囲', sourceFamily: 'fictional', recordCount: 1 }, { id: 'dataset-after', dataAsOf: '2026-07-01', coverage: '架空の比較B収録範囲', sourceFamily: 'fictional', recordCount: 2 }],
    sourceProfiles: [{ id: 'source-profile-example', label: '架空公式サイト' }],
  },
  watches: [{ id: 'watch-example', name: '架空商品の変化を確認', entityId: 'entity-example', categoryId: 'category-controller', beforeDatasetId: 'dataset-before', afterDatasetId: 'dataset-after', sourceProfileId: 'source-profile-example', createdAt: '2026-07-01T00:00:00Z' }],
};
export const fictionalRun: Run = {
  schemaVersion: '1.0.0', id: 'run-example', watchId: 'watch-example', status: 'complete', createdAt: '2026-07-01T01:00:00Z', completedAt: '2026-07-01T01:00:10Z', input: { watch: fictionalBootstrap.watches[0] }, errorCode: null,
  versions: { model: 'fictional-test', prompt: 'signal-v1', schema: '1.0.0' }, usage: { modelRequests: 1, toolCalls: 1, inputTokens: 100, outputTokens: 100 },
  signal: { status: 'change_detected', counts: { before: 1, after: 2, newlyObserved: 1, excludedBefore: 0, excludedAfter: 0, comparable: true }, coverage: { before: '架空の比較A収録範囲', after: '架空の比較B収録範囲' }, limitations: ['縮尺は未確認です。'],
    designFacts: [{ id: 'fact-1', text: '対象範囲で新しい操作機器1件を観測しました。', recordIds: ['record-new'], field: 'articleName' }],
    visualObservations: [{ id: 'observation-1', part: '操作部', observation: '操作部の輪郭が異なる可能性があります。', status: 'change_candidate', mediaIds: ['media-a', 'media-b'] }],
    officialFacts: [{ id: 'official-1', text: '公式資料には操作部の説明があります。', sourceId: 'source-1', quote: '操作部を変更しました。', start: 0, end: 11 }],
    hypotheses: [{ id: 'hypothesis-1', text: '操作部への着目が共通する可能性があります。', evidenceIds: ['observation-1', 'official-1'], limitations: ['同一製品かどうかは不明です。'] }],
    questionsForHuman: ['同じ方向・縮尺の資料で操作部を確認してください。'],
    media: [
      { id: 'media-a', recordId: 'record-old', label: '旧操作機器', role: 'comparisonA', mimeType: 'image/png', width: 640, height: 480, sourceLabel: '架空図面', permission: '審査用に作成', gazetteDate: '2026-06-01', applicationDate: null, view: '正面', comparisonStatus: '縮尺は未確認' },
      { id: 'media-b', recordId: 'record-new', label: '新操作機器', role: 'comparisonB', mimeType: 'image/png', width: 640, height: 480, sourceLabel: '架空図面', permission: '審査用に作成', gazetteDate: '2026-07-01', applicationDate: null, view: '正面', comparisonStatus: '縮尺は未確認' },
    ],
    sources: [{ id: 'source-1', url: 'https://leaf.example.test/news/controller', title: '架空の操作機器のお知らせ', publishedAt: null, retrievedAt: '2026-07-01T01:00:01Z', excerpt: '操作部を変更しました。', excerptStart: 0, contentHash: '0'.repeat(64), retrospective: true }],
    toolEvents: [{ tool: 'fetch_candidate', candidateId: 'candidate-1', reason: '登録公式サイトの候補を確認', outcome: '根拠を確認', startedAt: '2026-07-01T01:00:01Z', finishedAt: '2026-07-01T01:00:02Z' }], stopReason: '登録候補の確認を完了しました。',
  },
};
