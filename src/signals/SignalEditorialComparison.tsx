import type { EditorialComparison } from './editorial-comparison';
import { revealEvidenceLink } from './evidence-navigation';
import './editorial-comparison.css';

const sourceTarget = (id: string) => `signal-editorial-source-${id}`;
const quoteTarget = (id: string) => `signal-editorial-quote-${id}`;
const recordedTime = (value: string) => new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(value));

export function SignalEditorialComparison({ comparison, summaryOnly = false }: { comparison: EditorialComparison; summaryOnly?: boolean }) {
  const current = comparison.verification;
  const quoteLinks = (ids: string[], label: string) => <span className="signal-editorial-value-links">{ids.map((id, index) => <a key={id} href={`#${quoteTarget(id)}`} aria-label={`${label}の原文 ${index + 1}`}>原文{ids.length > 1 ? ` ${index + 1}` : ''}</a>)}</span>;
  return <section className={`signal-panel signal-editorial-comparison${summaryOnly ? ' signal-editorial-summary' : ''}`} id="signal-editorial-comparison" tabIndex={-1} aria-labelledby="signal-editorial-title" onClickCapture={revealEvidenceLink}>
    <p className="signal-eyebrow">{current ? '公式商品仕様の比較（今回の原文照合）' : summaryOnly ? '公式商品仕様の比較（保存済み要約）' : '過去の公式資料で比べる製品の違い'}</p>
    <h2 id="signal-editorial-title">{summaryOnly ? comparison.products.map(({ label }) => label).join(' / ') : comparison.title}</h2>
    {summaryOnly ? <p>{comparison.title}</p> : null}
    {current ? <p className="signal-editorial-origin">原文再照合：<time dateTime={current.checkedAt}>{recordedTime(current.checkedAt)}</time>（日本時間）。今回取得した資料の比較です。以下の公報集計・保存AI結果とは別に表示しています。</p> : summaryOnly ? <p className="signal-editorial-origin">元本文はこの環境に未保存・原文再照合未実施。以下の公報集計・保存AI結果とは別の、商品仕様の比較です。</p> : <p className="signal-editorial-origin">公式資料から編集した実例 · 自動監視・実AIの結果ではありません</p>}
    <table className="signal-editorial-table"><caption>{comparison.companyName} · {current ? '今回取得した公式資料の仕様を比較' : summaryOnly ? '保存記録にある商品仕様' : '公式資料の記載を比較'}</caption><thead><tr><th scope="col">比べる項目</th>{comparison.products.map(({ label }) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{comparison.differences.map((row, index) => <tr key={index}>
      <th scope="row">{row.label}{!current ? <span className="signal-editorial-references">{row.sourceIds.map((id) => <a key={id} href={`#${sourceTarget(id)}`} aria-label={`${row.label}の${summaryOnly ? '保存出典' : '根拠'} ${comparison.sources.findIndex((source) => source.id === id) + 1}`}>[{comparison.sources.findIndex((source) => source.id === id) + 1}]</a>)}</span> : null}</th>
      {row.values.map((value, valueIndex) => <td key={valueIndex}>{value}{current ? quoteLinks(current.differenceQuoteIds[index][valueIndex], `${comparison.products[valueIndex].label} ${row.label}`) : null}</td>)}
    </tr>)}</tbody></table>
    <p className="signal-editorial-condition"><strong>比較条件</strong> {comparison.condition}{current ? quoteLinks(current.conditionQuoteIds, '比較条件') : null}</p>
    <div className="signal-editorial-why"><h3>なぜ注目するか</h3><p>{comparison.whyItMatters}</p></div>
    {summaryOnly ? <nav className="signal-evidence-links" aria-label="商品比較の保存出典">{comparison.sources.map((source, index) => <a key={source.id} href={`#${current ? quoteTarget(current.quotes.find((quote) => quote.sourceId === source.id)!.id) : sourceTarget(source.id)}`}>[{index + 1}] {source.label}</a>)}</nav> : null}
    <p className="signal-editorial-unmapped">この収録意匠・分類との対応は未確認</p>
    <details className="signal-details signal-editorial-sources" id="signal-editorial-sources" data-print-evidence><summary>{current ? '取得原文の引用・出典・日付を見る' : summaryOnly ? '保存記録の出典・日付・比較条件を見る' : '根拠・発表日・比較の限界を確かめる'}</summary>
      {current ? <><h3>今回保存した原文の引用</h3>{current.quotes.map((quote) => {
        const source = comparison.sources.find((source) => source.id === quote.sourceId)!;
        return <div className="signal-editorial-quote" id={quoteTarget(quote.id)} tabIndex={-1} key={quote.id}><h4>{source.label}</h4><blockquote data-quote-id={quote.id}>{quote.text}</blockquote><p>取得：<time dateTime={quote.retrievedAt}>{recordedTime(quote.retrievedAt)}</time>（日本時間） · <a href={source.url} target="_blank" rel="noopener noreferrer">この引用の公式ページを開く ↗</a></p></div>;
      })}</> : null}
      <dl className="signal-editorial-dates"><div><dt>{current ? '発表記事に記載された発表日' : summaryOnly ? '保存記録上の発表日' : '発表日'}</dt><dd><time dateTime={comparison.announcement.publishedAt}>{comparison.announcement.publishedAt}</time> {current ? quoteLinks(current.announcementQuoteIds, '発表日と発売時期') : <a href={`#${sourceTarget(comparison.announcement.sourceId)}`}>{summaryOnly ? '記録された発表出典' : '発表の根拠'}</a>}</dd></div><div><dt>{current ? '発表記事の発売予定時期' : summaryOnly ? '保存記録上の発売時期' : '発売時期（原資料の表記）'}</dt><dd>{comparison.announcement.releaseWindow}</dd></div></dl>
      <div className="signal-editorial-claim"><h3>{current ? 'メーカー説明の要約と試験条件' : summaryOnly ? '保存記録にあるメーカーの比較試験' : 'メーカーによる比較試験の説明'}</h3><p>{comparison.manufacturerClaim.text} {current ? quoteLinks(current.manufacturerClaimQuoteIds, 'メーカーの比較試験') : <a href={`#${sourceTarget(comparison.manufacturerClaim.sourceId)}`}>{summaryOnly ? '記録された試験の出典' : '試験の根拠'}</a>}</p><p>メーカーの説明であり、独立した実証ではありません。</p></div>
      <h3>この比較の限界</h3><ul>{comparison.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
      <h3>{current ? '今回の取得先と確認メモ' : summaryOnly ? '保存記録にある出典とメモ' : '確認した原資料'}</h3>{summaryOnly && !current ? <p>以下の「確認」は保存時のメモです。今回、元本文との再照合は行っていません。</p> : null}<ol>{comparison.sources.map((source) => <li id={sourceTarget(source.id)} tabIndex={-1} key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a><p>{source.notes}</p></li>)}</ol>
    </details>
    <div className="signal-editorial-next" id="signal-editorial-next" tabIndex={-1}><p className="signal-eyebrow">次に調べる問い</p><h3>{comparison.nextQuestion}</h3><a className="signal-text-button" href="#signal-editorial-sources">原資料と比較条件から確認する →</a></div>
  </section>;
}
