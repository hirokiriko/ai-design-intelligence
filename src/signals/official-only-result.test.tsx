import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeRun, decodeRuns, type RunV23 } from './contract';
import { fictionalRunV22 } from './fixtures-v22';
import { evidenceId } from './labels';
import { SignalHistory } from './SignalHistory';
import { SignalResult } from './SignalResult';

describe('completed official facts with no grounded hypothesis', () => {
  it('keeps the quoted announcement visible while identity remains insufficient and old history is unchanged', () => {
    const current: RunV23 = {
      ...structuredClone(fictionalRunV22), id: 'FIXTURE-OFFICIAL-ONLY', schemaVersion: '2.3.0',
      status: 'complete', errorCode: null,
      versions: { ...fictionalRunV22.versions, model: 'fixture-controller', schema: '2.3.0' },
    };
    const signal = current.signal!;
    signal.status = 'insufficient';
    signal.hypotheses = [];
    const missing = '比較対象の意匠と商品名・型番を結ぶ公式記載または管理された対応資料が必要です。個別商品の対応を判断します。';
    signal.relationships = [{ id: 'FIXTURE-RELATIONSHIP-UNVERIFIED', relation: 'unknown',
      summary: '収録意匠と公式資料の個別商品対応は確認できていません。',
      supportingEvidenceIds: [], opposingEvidenceIds: [], missingEvidence: [missing] }];
    signal.questionsForHuman = [missing];
    const fact = signal.officialFacts[0];
    const source = signal.sources.find((entry) => entry.id === fact.sourceId)!;
    source.publishedAt = '2026-08-12';
    const before = JSON.stringify([fictionalRunV22, current]);
    const run = decodeRun(current);
    const html = renderToStaticMarkup(createElement(SignalResult, { run }));
    expect(html).toContain('処理終了');
    expect(html).toContain('判断する資料が不足');
    expect(html).toContain('<h3>公式発表の事実</h3>');
    expect(html).toContain(fact.text);
    expect(html).toContain(`<blockquote>${fact.quote}</blockquote>`);
    expect(html).toContain(`出典：${source.title} · 発表日：2026-08-12`);
    expect(html).toContain(`href="#${evidenceId(source.id)}"`);
    expect(html).toContain('根拠のある関連仮説はありません。');
    expect(html).toContain(missing);
    expect(html).toContain('処理終了は、同一製品・商品化やすべての根拠の確認が済んだことを意味しません。');
    for (const text of ['API・AI処理の失敗', '分析未完了（途中終了）', '今回の結果に採用された公式発表はありません。']) {
      expect(html).not.toContain(text);
    }
    for (const marker of ['id="signal-images"', 'id="signal-official"', 'class="signal-hypotheses"']) {
      expect(html).toContain(marker);
    }
    expect(html.indexOf('id="signal-images"')).toBeLessThan(html.indexOf('id="signal-official"'));
    expect(html.indexOf('id="signal-official"')).toBeLessThan(html.indexOf('class="signal-hypotheses"'));
    const runs = decodeRuns({ schemaVersion: '2.3.0', runs: [fictionalRunV22, current] });
    const history = renderToStaticMarkup(createElement(SignalHistory, { runs, state: 'ready', disabled: false, onSelect: () => undefined }));
    expect(history).toContain('処理終了');
    expect(JSON.stringify([fictionalRunV22, current])).toBe(before);
    expect(runs[0]).toEqual(fictionalRunV22);
  });
});
