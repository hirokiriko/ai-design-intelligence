import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignalResult } from './SignalResult';
import { ResultOverview, SavedContext } from './SignalContext';
import { SignalHistory } from './SignalHistory';
import { fictionalRun, fictionalRunV2 } from './fixtures';
import { fictionalRunV22 } from './fixtures-v22';
import { evidenceId, relationLabels } from './labels';
import { decodeRun } from './contract';
import backendReconstruction from './backend-run-v2.1.fixture.json';
import backendQuestionRun from './backend-run-v2.5.fixture.json';

describe('saved company and evidence context', () => {
  it('translates saved classification schemes while retaining the classification codes', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.category.scheme = 'JPO_NATIONAL_DESIGN';
    run.signal!.recordFacts[0].classifications = [{ scheme: 'JPO_D_TERM', code: 'D-FIXTURE', label: null }];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('<dt>分類体系</dt><dd>日本意匠分類</dd>');
    expect(html).toContain('Dターム D-FIXTURE');
    expect(html).not.toContain('JPO_NATIONAL_DESIGN');
    expect(html).not.toContain('JPO_D_TERM');
  });
  it('shows the saved 2.2.0 pair and reconstruction without using current catalog labels', () => {
    const run = structuredClone(fictionalRunV22);
    run.input.comparisonPair!.label = '保存時の架空比較組';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('この実行に保存された比較組');
    expect(html).toContain('保存時の架空比較組');
    expect(html).toContain('週次原本からの遡及再構成収録集合');
    expect(html).toContain('比較Aの対象');
    expect(html).toContain('比較Bの対象');
    run.input.comparisonPair = null;
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain('現在の候補から過去の入力を補完していません');
  });
  it('explains the saved fictional comparison status without rewriting the saved input', () => {
    const run = structuredClone(fictionalRunV22);
    const status = run.input.comparisonPair!.media[0].comparisonStatus;
    const html = renderToStaticMarkup(createElement(SavedContext, { run }));
    expect(html).toContain('管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）');
    expect(html).not.toContain(status);
    expect(run.input.comparisonPair!.media[0].comparisonStatus).toBe(status);
  });
  it('displays reconstructed collection limits and unknown acquisition without changing saved counts', () => {
    const run = decodeRun(backendReconstruction);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    for (const label of ['比較A · 週次原本からの遡及再構成収録集合', '比較B · 週次原本からの遡及再構成収録集合', '共通の収録開始日', '収録の締切日 / 判定基準', '原本の公開日', '不明（手元での確認日時とは区別）', '手元で原本を確認した日時', '再構成した日時', '事後の補足', '当時の予測実績を示すものではありません', '2026-06-01', '2026-08-09', '2026-09-18', '比較Bの対象2件、収録範囲での新規観測1件。', '個別意匠と商品の対応', '公式資料の探索範囲と不足']) expect(html).toContain(label);
    expect(html).toContain('自作架空原本による遡及再構成の回帰fixture');
    expect(html).toContain('後日取得した資料を事後の補足として含みます。当時サービスが取得済みだったことを示しません。');
    expect(html).not.toContain('当時既知の情報ではありません');
    // 概要にも保存された限界を出すが、詳細な収録条件は図面の後で確認できる。
    expect(html.indexOf('aria-label="保存時の対象とデータ"')).toBeGreaterThan(html.indexOf('画像からのAI観察候補'));
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('架空意匠ラボ甲合同会社');
    expect(history).not.toContain('架空データ（旧形式）');
  });
  it('shows saved acquisition evidence and absent supplements without fabricating missing collection metadata', () => {
    const run = decodeRun(structuredClone(backendReconstruction));
    if (run.schemaVersion !== '2.1.0') throw new Error('Fixture must use 2.1.0');
    const collection = run.input.context.beforeDataset.collection!;
    collection.sourceAcquiredFrom = '2026-09-19T00:00:00Z';
    collection.sourceAcquiredThrough = '2026-09-20T00:00:00Z';
    collection.retrospectiveSupplements = false;
    run.input.context.afterDataset.collection = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('2026-09-19T00:00:00Z 〜 2026-09-20T00:00:00Z');
    expect(html).toContain('この収録集合には登録されていません。');
    expect(html).toContain('比較B：収録集合の作成経緯は未記録です。');
    expect(renderToStaticMarkup(createElement(SignalResult, { run: fictionalRunV2 }))).not.toContain('遡及再構成収録集合');
  });
  it('leads with the saved company, product, classification, change and official findings', () => {
    const html = renderToStaticMarkup(createElement(SignalResult, { run: fictionalRunV2 }));
    for (const label of ['架空リーフ機器株式会社', '架空のリーフ操作器', '操作機器 / H1', '今回わかったこと', '公式発表の事実', '未確認事項・次に確認する資料', '処理終了は、同一製品', '比較A / Bは資料の役割', '発表日：不明', '更新日：2026-07-02', '発売日：不明', '物品名', '架空操作機器', 'AIが確認した抜粋']) expect(html).toContain(label);
    expect(html.indexOf('今回わかったこと')).toBeLessThan(html.indexOf('画像からのAI観察候補'));
  });
  it.each(Object.entries(relationLabels))('distinguishes relationship %s without broad confirmation', (relation, label) => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.relationships[0].relation = relation as keyof typeof relationLabels;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain(label);
    expect(html).toContain('支持する根拠'); expect(html).toContain('不足している根拠');
    expect(html).not.toContain('調査完了'); expect(html).not.toContain('確認完了');
  });
  it('separates approved public data from a fixture model using only fictional test values', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.dataMode = 'approved_public';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('公開情報由来のデータ'); expect(html).toContain('模擬モデル（接続・保存の検証）');
    expect(html).toContain('架空リーフ機器株式会社');
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs: [run, fictionalRun], state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('公開情報由来のデータ'); expect(history).toContain('架空データ（旧形式）');
    expect(renderToStaticMarkup(createElement(SignalResult, { run: fictionalRun }))).toContain('現在のカタログから補完していません');
  });
  it('exposes saved but model-unseen excerpt text separately and reports unknown dates', () => {
    const run = structuredClone(fictionalRunV2);
    const source = run.signal!.sources[0];
    source.excerpt += 'これはAI未確認の範囲です。';
    source.extractedChars = Array.from(source.excerpt).length; source.truncated = true;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('保存された抜粋の残り（AIは未確認）');
    expect(html).toContain('全文確認ではありません'); expect(html).toContain('日付不明');
    expect(html).toContain('事後照合'); expect(html).toContain('これはAI未確認の範囲です。');
  });
  it('escapes product, relation and source labels as text', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.entity.name = '<script>external()</script>';
    run.signal!.relationships[0].summary = '<img src=x onerror=external()>';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x onerror=external()&gt;');
  });
  it('shows missing entity and article names explicitly without substituting identity IDs', () => {
    const run = structuredClone(fictionalRunV2);
    run.input.context.entity.name = null;
    run.signal!.recordFacts[0].articleName = null; run.signal!.recordFacts[0].applicant.name = null;
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('企業名不明 / 操作機器 / H1');
    expect(html).toContain('<dt>物品名</dt><dd>不明</dd>');
    expect(html).toContain('<dt>出願人</dt><dd>不明</dd>');
  });
  it('links Unicode evidence IDs to a real fragment target after browser URL decoding', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.officialFacts[0].id = '公式記載-1';
    run.signal!.relationships[0].supportingEvidenceIds = ['公式記載-1'];
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    const linkedId = html.match(/href="#([^"]+)">公式記載1<\/a>/)?.[1];
    expect(linkedId).toBeDefined();
    expect(html).toContain(`id="${decodeURIComponent(linkedId!)}"`);
    expect(html).not.toContain('>公式記載-1</a>');
  });
  it('shows original identifiers and article description separately from a missing design description', () => {
    const run = structuredClone(fictionalRunV2);
    run.signal!.recordFacts[0].description = null;
    run.signal!.recordFacts[0].articleDescription = '架空の物品機能の説明';
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('登録番号 / 出願番号'); expect(html).toContain('FIXTURE-REG-EXAMPLE / 不明');
    expect(html).toContain('<dt>意匠の説明</dt><dd>説明は未収録</dd>');
    expect(html).toContain('<dt>物品の説明</dt><dd>架空の物品機能の説明</dd>');
  });
});

describe('saved result overview', () => {
  it('keeps later observations, official findings and selected records reachable without rewriting saved values', () => {
    const run = structuredClone(fictionalRunV2);
    const signal = run.signal!;
    signal.visualObservations.push({ id: 'FIXTURE-inner-circle', part: '内側の円', status: 'unknown', observation: '架空図面の内側の円は、線の意味を確定できません。', mediaIds: [...signal.visualObservations[0].mediaIds] });
    signal.officialFacts.push({ ...signal.officialFacts[0], id: 'FIXTURE-official-later', text: '架空公式資料の後続の記載です。対応する図面は未確認です。' });
    signal.questionsForHuman.push('架空資料の内側の円を同じ視点で確認してください。');
    for (let index = 2; index <= 4; index += 1) {
      const id = `FIXTURE-record-fact-${index}`;
      const recordId = `FIXTURE-record-${index}`;
      signal.recordFacts.push({ ...signal.recordFacts[0], id, recordId, articleName: `架空意匠${index}` });
      signal.designFacts.push({ id, text: `架空意匠${index}の書誌事項です。`, recordIds: [recordId], field: 'articleName' });
    }
    const saved = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(ResultOverview, { run }));
    expect(html).toContain('図面からの観察候補（2件）');
    expect(html).toContain('画像観察2 · 内側の円</strong> · 判断不能');
    expect(html).toContain(signal.visualObservations[1].observation);
    expect(html).toContain(signal.officialFacts[1].text);
    expect(html).toContain(signal.questionsForHuman[1]);
    expect(html).toContain('選ばれた意匠（4件）を見る');
    for (const item of [signal.visualObservations[1], signal.officialFacts[1], signal.recordFacts[3]]) {
      expect(html).toContain(`href="#${evidenceId(item.id)}"`);
      expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain(`id="${evidenceId(item.id)}"`);
    }
    const officialDetails = html.slice(html.indexOf('この記載の引用・出典をここで確かめる'));
    expect(officialDetails).toContain(signal.officialFacts[0].quote);
    expect(JSON.stringify(run)).toBe(saved);
  });

  it('preserves the saved support and opposition groups and the missing evidence for each relationship', () => {
    const run = structuredClone(fictionalRunV2);
    const signal = run.signal!;
    const relation = signal.relationships[0];
    relation.relation = 'unknown';
    relation.supportingEvidenceIds = [signal.officialFacts[0].id];
    relation.opposingEvidenceIds = [signal.visualObservations[0].id];
    relation.missingEvidence = ['架空の型番対応資料は未確認です。', '架空図面の線の意味を確認してください。'];
    const html = renderToStaticMarkup(createElement(ResultOverview, { run }));
    const support = html.match(/<dt>支持する根拠<\/dt><dd>(.*?)<\/dd>/)?.[1];
    const opposition = html.match(/<dt>不一致・反証の根拠<\/dt><dd>(.*?)<\/dd>/)?.[1];
    expect(support).toContain(`href="#${evidenceId(signal.officialFacts[0].id)}"`);
    expect(support).not.toContain(`href="#${evidenceId(signal.visualObservations[0].id)}"`);
    expect(opposition).toContain(`href="#${evidenceId(signal.visualObservations[0].id)}"`);
    expect(opposition).not.toContain(`href="#${evidenceId(signal.officialFacts[0].id)}"`);
    expect(html).toContain(relationLabels.unknown);
    expect(html).toContain('保存された支持 1件 · 反証 1件 · 不足 2件');
    for (const text of relation.missingEvidence) expect(html).toContain(text);
    expect(html).toContain(`href="#signal-relation-${encodeURIComponent(relation.id)}"`);
    expect(renderToStaticMarkup(createElement(SignalResult, { run }))).toContain(`id="signal-relation-${encodeURIComponent(relation.id)}"`);
  });

  it('prioritizes the saved 2.5 question and retains separate answer, document and hypothesis limits', () => {
    const run = decodeRun(structuredClone(backendQuestionRun));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Fixture must have a saved 2.5 answer');
    const answer = run.signal.questionAnswer;
    answer.nextChecks = ['架空の問い専用の確認資料A', '架空の問い専用の確認資料B'];
    answer.limitations = ['架空の問い専用の判断の限界'];
    run.signal.questionsForHuman = ['架空の資料全体の確認事項'];
    run.signal.limitations = ['架空の資料全体の限界'];
    run.signal.hypotheses[0].limitations = [];
    run.signal.hypotheses.push({ id: 'FIXTURE-hypothesis-later', text: '架空の後続の検討材料', evidenceIds: [run.signal.visualObservations[0].id], limitations: ['架空の後続の検討材料の限界'] });
    const saved = JSON.stringify(run);
    const html = renderToStaticMarkup(createElement(ResultOverview, { run }));
    expect(html.indexOf(run.input.analysisQuestion.text)).toBeLessThan(html.indexOf('図面からの観察候補'));
    expect(html).toContain('href="#signal-question-answer-title"');
    expect(html).not.toContain('id="signal-question-answer-title"');
    expect(html).toContain('この問いの判断に必要な資料は不足しています。');
    expect(html).not.toContain(answer.text!);
    for (const text of [...answer.nextChecks, ...answer.limitations, ...run.signal.questionsForHuman, ...run.signal.limitations, ...run.signal.hypotheses[1].limitations]) expect(html).toContain(text);
    expect(html).toContain('資料全体の確認事項（1件）を見る');
    expect(html).toContain('この問いへの回答の限界');
    expect(html).toContain('資料全体の限界');
    expect(html).toContain(`href="#${evidenceId('FIXTURE-hypothesis-later')}">検討材料2と根拠を見る`);
    const result = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(result.split('id="signal-question-answer-title"')).toHaveLength(2);
    expect(result.split(answer.text!)).toHaveLength(2);
    expect(JSON.stringify(run)).toBe(saved);
  });

  it('does not turn an unevaluated saved question or an interrupted analysis into an answer', () => {
    const run = decodeRun(structuredClone(backendQuestionRun));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Fixture must have a saved 2.5 answer');
    run.status = 'interrupted'; run.completedAt = null;
    run.signal.questionAnswer = { ...run.signal.questionAnswer, status: 'not_evaluated', text: null, evidenceIds: [], supportingEvidenceIds: [], opposingEvidenceIds: [], nextChecks: [], limitations: [] };
    const html = renderToStaticMarkup(createElement(ResultOverview, { run }));
    expect(html).toContain('回答は未評価です。以下の観察や引用を回答として補っていません。');
    expect(html).toContain('停止前に取得・検証した参考資料');
    expect(html).toContain('分析は未完了');
    expect(html).not.toContain('今回わかったこと');
    expect(html).not.toContain('保存された回答と、その支持・反証を確認できます。');
    expect(html).toContain('この問いの次の確認事項は未記録です。');
    expect(run.signal.questionAnswer.status).toBe('not_evaluated');
    expect(run.signal.questionAnswer.text).toBeNull();
  });

  it('keeps legacy evidence unclassified and does not expose unperformed image or article analysis in facts-only mode', () => {
    const legacy = renderToStaticMarkup(createElement(ResultOverview, { run: fictionalRun }));
    expect(legacy).toContain('この旧形式には、支持・反証を区別した対応評価は保存されていません。');
    expect(legacy).not.toContain('この実行に保存された問い');
    const run = structuredClone(fictionalRunV2);
    run.versions.model = 'facts-only-deterministic';
    const html = renderToStaticMarkup(createElement(ResultOverview, { run }));
    expect(html).toContain('書誌情報のみの比較です。図面は分析していません。');
    expect(html).toContain('記事本文は分析していません。');
    expect(html).not.toContain(run.signal!.visualObservations[0].observation);
    expect(html).not.toContain(run.signal!.officialFacts[0].text);
    expect(html).not.toContain(run.signal!.officialFacts[0].quote);
    expect(html).not.toContain('<img');
  });
});
