import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeRun, type RunV21 } from './contract';
import { fictionalRunV2 } from './fixtures';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

const emptySha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function fictionalFactsOnlyRun(): RunV21 {
  const run = structuredClone(fictionalRunV2) as unknown as RunV21;
  run.schemaVersion = '2.1.0';
  run.versions = { model: 'facts-only-deterministic', prompt: 'facts-only-v1', schema: '2.1.0' };
  run.usage = { modelRequests: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 };
  run.input.context.dataMode = 'approved_public';
  run.input.context.beforeDataset.collection = null;
  run.input.context.afterDataset.collection = null;
  run.input.context.knownProducts = [];
  const signal = run.signal!;
  signal.media = [];
  signal.visualObservations = [];
  signal.officialFacts = [];
  signal.hypotheses = [];
  signal.relationships = [];
  signal.toolEvents = [];
  signal.discovery = { state: 'not_started', scannedLinks: 0, eligibleCandidates: 0, omittedCandidates: 0, limitations: [], candidates: [] };
  signal.recordFacts[0].description = null;
  signal.recordFacts[0].articleDescription = null;
  signal.sources[0] = {
    ...signal.sources[0], title: '架空企業：公開日の確認メモ', excerpt: '',
    extractionVersion: 'manual-public-fact-1.0.0', extractedChars: 0, modelVisibleChars: 0,
    contentHash: emptySha256, bodyHash: emptySha256, truncated: false,
  };
  return run;
}

describe('metadata-only public facts result', () => {
  it('decodes a saved zero-usage result and describes manual links without AI or excerpts', () => {
    const run = decodeRun(fictionalFactsOnlyRun());
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(html).toContain('公開書誌事項の比較（原文・図面なし）');
    expect(html).toContain('実行時に記事本文・図面を取得せず、AI・Vertexへ送信していません');
    expect(html).toContain('手動確認した参照リンク');
    expect(html).toContain('手動確認日時');
    expect(html).toContain('記事本文・画像は保存せず');
    expect(html).not.toContain('AIが確認した抜粋');
    expect(html).not.toContain('画像からのAI観察候補');
    expect(html).not.toContain('<blockquote>');
    expect(history).toContain('公開書誌事項の比較（原文・図面なし）');
  });

  it('rejects an AI or copied-text payload mislabeled as metadata-only', () => {
    const aiRun = fictionalFactsOnlyRun();
    aiRun.usage.modelRequests = 1;
    expect(() => decodeRun(aiRun)).toThrow();
    const copiedRun = fictionalFactsOnlyRun();
    copiedRun.signal!.sources[0].excerpt = '架空の本文';
    expect(() => decodeRun(copiedRun)).toThrow();
    const mediaRun = fictionalFactsOnlyRun();
    mediaRun.signal!.media = structuredClone(fictionalRunV2.signal!.media);
    expect(() => decodeRun(mediaRun)).toThrow();
    const claimRun = fictionalFactsOnlyRun();
    claimRun.signal!.relationships = [{ id: 'relation-claim', relation: 'direct', summary: '架空の直接対応', supportingEvidenceIds: ['fact-1'], opposingEvidenceIds: [], missingEvidence: [] }];
    expect(() => decodeRun(claimRun)).toThrow();
    const hypothesisRun = fictionalFactsOnlyRun();
    hypothesisRun.signal!.hypotheses = [{ id: 'hypothesis-claim', text: '架空の関連仮説', evidenceIds: ['fact-1'], limitations: [] }];
    expect(() => decodeRun(hypothesisRun)).toThrow();
  });

  it('does not call a deterministic failure an AI failure', () => {
    const run = fictionalFactsOnlyRun();
    run.status = 'failed';
    run.signal = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run: decodeRun(run) }));
    expect(html).toContain('確認処理の失敗');
    expect(html).not.toContain('API・AI処理の失敗');
  });
});
