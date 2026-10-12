import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { decodeRun, type RunV25 } from './contract';
import questionFixture from './backend-run-v2.5.fixture.json';
import { SignalResult } from './SignalResult';
import { savedStopExplanation } from './execution-explanation';

function savedPartial(): RunV25 {
  const run = decodeRun(structuredClone(questionFixture)) as RunV25;
  run.status = 'partial';
  run.errorCode = 'MODEL_INPUT_BUDGET_EXCEEDED';
  if (!run.signal) throw Error('FIXTURE-signal-required');
  run.signal.officialFacts = [];
  run.signal.relationships = [];
  run.signal.hypotheses = [];
  run.signal.questionAnswer = { ...run.signal.questionAnswer, status: 'not_evaluated', text: null,
    evidenceIds: [], supportingEvidenceIds: [], opposingEvidenceIds: [], nextChecks: [], limitations: [] };
  run.signal.stopReason = '架空の入力上限で停止しました。回答の評価は未完了です。';
  const source = structuredClone(run.signal.sources[0]);
  source.id = 'FIXTURE-second-saved-source'; source.url = 'https://fixture.example.test/second-saved-source';
  run.signal.sources = [run.signal.sources[0], source];
  return decodeRun(run) as RunV25;
}
const render = (run: RunV25) => renderToStaticMarkup(createElement(SignalResult, { run }));

describe('saved partial explanation and read-only next steps', () => {
  it('shows the input-limit reason and saved sources before the unanswered snapshot, without changing it', () => {
    const run = savedPartial();
    const before = JSON.stringify(run);
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    try {
      const html = render(run);
      expect(html).toContain('モデル入力の上限により停止しました');
      expect(html.indexOf('停止理由：')).toBeLessThan(html.indexOf('この問いへの回答'));
      expect(html).toContain('公式資料の参照先が2件、保存された抜粋が2件あります');
      expect(html).toContain('資料の保存は、AIによる照合や回答の完了を意味しません');
      expect(html).toContain('href="#signal-saved-sources"');
      expect(html).toContain('id="signal-saved-sources"');
      expect(html).toContain('href="#signal-execution-details"');
      expect(html).toContain('id="signal-execution-details"');
      expect(html).toContain('分析用に用意した抜粋');
      expect(html).not.toContain('AIが確認した抜粋');
      expect(html).toContain('この問いへの回答はまだ得られていません');
      expect(html).toContain('この問いの次の確認事項は未記録');
      expect(html).not.toContain('回答あり');
      expect(html).not.toContain('MODEL_INPUT_BUDGET_EXCEEDED');
      expect(html).not.toContain('取得や分析の個別状態は、保存情報だけでは特定できません');
      expect(JSON.stringify(run)).toBe(before);
      expect(fetcher).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it('does not invent a saved excerpt or source link when source data is absent', () => {
    const run = savedPartial();
    run.signal!.sources = [];
    const html = render(run);
    expect(html).not.toContain('href="#signal-saved-sources"');
    expect(html).not.toContain('公式資料の参照先が');
    expect(html).toContain('採用された引用は未記録です'); expect(html).not.toContain('照合する公式資料の商品説明');
  });

  it('distinguishes an empty saved excerpt from a retained source reference', () => {
    const run = savedPartial();
    for (const source of run.signal!.sources) source.excerpt = '';
    const html = render(run);
    expect(html).toContain('公式資料の参照先が2件、保存された抜粋が0件あります');
    expect(html).not.toContain('AIが確認した');
  });

  it('preserves saved unknown dates and does not replace them with release dates', () => {
    const run = savedPartial();
    const source = run.signal!.sources[0];
    source.publishedAt = null; source.updatedAt = null; source.releaseAt = '2026-09-02';
    const before = JSON.stringify(run);
    const html = render(run);
    expect(html).toContain('発表日：不明');
    expect(html).toContain('発売日：2026-09-02');
    expect(JSON.stringify(run)).toBe(before);
  });

  it('does not invent causes for null snapshots, or replace completed status', () => {
    const run = savedPartial();
    run.errorCode = 'FIXTURE-UNKNOWN-STOP'; run.signal = null;
    const html = render(run);
    expect(html).toContain('詳しい停止理由は保存されていません');
    expect(html).not.toContain('FIXTURE-UNKNOWN-STOP');
    expect(html).not.toContain('href="#signal-saved-sources"');
    run.status = 'complete';
    expect(savedStopExplanation(run)).toBeNull();
  });

  it('explains a saved input-limit code without claiming an absent partial snapshot exists', () => {
    const run = savedPartial();
    run.status = 'failed'; run.signal = null;
    const html = render(run);
    expect(html).toContain('モデル入力の上限により停止しました。分析は未完了です。');
    expect(html).not.toContain('保存された途中結果で');
    expect(html).not.toContain('保存図面と観察を見る');
    expect(html).not.toContain('保存された公式資料を見る');
    expect(html).toContain('閲覧しても分析は再送されません');
  });

  it('shows the saved stop reason as escaped text without promoting it into an answer', () => {
    const run = savedPartial();
    run.errorCode = 'FIXTURE-OTHER-STOP';
    run.signal!.stopReason = '架空停止理由 <script>FIXTURE</script>';
    const html = render(run);
    expect(html).toContain('架空停止理由 &lt;script&gt;FIXTURE&lt;/script&gt;');
    expect(html).not.toContain('<script>FIXTURE</script>');
    expect(html).toContain('この問いへの回答はまだ得られていません');
  });
});
