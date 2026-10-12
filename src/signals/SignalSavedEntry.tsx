import type { Run } from './contract';
import { evidenceId } from './labels';
import { SignalScopeSummary } from './SignalScopeSummary';
import { sourceDisplayTitle } from './source-display';

/** Read the selected saved run only; never infer a product match or execute analysis. */
export function SignalSavedEntry({ run }: { run: Run }) {
  if (run.schemaVersion === '1.0.0' || !run.signal) return null;
  const signal = run.signal;
  const pair = 'comparisonPair' in run.input ? run.input.comparisonPair : null;
  const media = pair ? signal.media.filter((item) => pair.media.some((selected) => selected.id === item.id)) : signal.media;
  const sources = signal.sources.filter((source) => source.excerpt.length > 0);
  return <div className="signal-saved-entry" aria-label="保存資料から比較を始める">
    {media.length || sources.length ? <a className="signal-button signal-primary signal-entry-primary" href={media.length ? '#signal-images' : '#signal-official'}>{media.length ? '図面と出典を詳しく見る' : '公式資料を詳しく見る'}</a> : null}
    <p className="signal-eyebrow">1 · 選定資料で何が変わったか</p>
    <SignalScopeSummary run={run} embedded />
    {media.length || sources.length ? <div className="signal-entry-materials">
      <div><p className="signal-eyebrow">2 · 詳しく見る対象</p><h3>図面の形と、商品説明を見比べる</h3>
        <p>対象図面を開き、公式資料の記載と照らして次の調査を絞ります。</p></div>
      {media.length ? <div className="signal-entry-drawings">{media.map((item) => {
        const record = signal.recordFacts.find((fact) => fact.recordId === item.recordId);
        return <a key={item.id} href={`#${evidenceId(item.id)}`} className="signal-entry-drawing"><span>{item.role === 'comparisonA' ? '比較A' : '比較B'} · {record?.articleName ?? item.label}</span><img src={`/api/v1/media/${encodeURIComponent(item.id)}`} width={item.width} height={item.height} alt={`${item.label}の対象図面`} /><small>登録番号 {record?.registrationNumber ?? '不明'} · {item.view ?? '視図不明'}</small></a>;
      })}</div> : null}
      {sources.length ? <div className="signal-entry-sources"><p className="signal-eyebrow">3 · 照合する公式資料の商品説明</p><div className="signal-entry-source-grid">{sources.map((source) => <article key={source.id}><h4>{sourceDisplayTitle(source.title)}</h4><blockquote>{Array.from(source.excerpt).slice(0, source.modelVisibleChars).join('')}</blockquote><a href={`#${evidenceId(source.id)}`}>この抜粋の出典・日付を確認</a></article>)}</div><p className="signal-subtle">保存された資料の原文抜粋。図面との対応は、下の回答・根拠で確認できます。</p></div> : null}
    </div> : null}
    <nav className="signal-evidence-links" aria-label="保存結果の読み進め方">{run.schemaVersion === '2.5.0' ? <a href="#signal-question-answer-title">保存された回答を見る</a> : null}<a href="#signal-next-checks">次の調査を確認</a><a href="#signal-conditions">保存条件を確認</a><a href="#signal-history">保存履歴へ</a></nav>
  </div>;
}
