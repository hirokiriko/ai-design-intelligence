import type { EditorialComparison } from './editorial-comparison';
import { revealEvidenceLink } from './evidence-navigation';
import './editorial-comparison.css';

const sourceTarget = (id: string) => `signal-editorial-source-${id}`;

export function SignalEditorialComparison({ comparison }: { comparison: EditorialComparison }) {
  return <section className="signal-panel signal-editorial-comparison" id="signal-editorial-comparison" tabIndex={-1} aria-labelledby="signal-editorial-title" onClickCapture={revealEvidenceLink}>
    <p className="signal-eyebrow">過去の公式資料で比べる製品の違い</p>
    <h2 id="signal-editorial-title">{comparison.title}</h2>
    <p className="signal-editorial-origin">公式資料から編集した実例 · 自動監視・実AIの結果ではありません</p>
    <table className="signal-editorial-table"><caption>{comparison.companyName} · 公式資料の記載を比較</caption><thead><tr><th scope="col">比べる項目</th>{comparison.products.map(({ label }) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{comparison.differences.map((row, index) => <tr key={index}><th scope="row">{row.label}<span className="signal-editorial-references">{row.sourceIds.map((id) => <a key={id} href={`#${sourceTarget(id)}`} aria-label={`${row.label}の根拠 ${comparison.sources.findIndex((source) => source.id === id) + 1}`}>[{comparison.sources.findIndex((source) => source.id === id) + 1}]</a>)}</span></th>{row.values.map((value, valueIndex) => <td key={valueIndex}>{value}</td>)}</tr>)}</tbody></table>
    <p className="signal-editorial-condition"><strong>比較条件</strong> {comparison.condition}</p>
    <div className="signal-editorial-why"><h3>なぜ注目するか</h3><p>{comparison.whyItMatters}</p></div>
    <p className="signal-editorial-unmapped">この収録意匠・分類との対応は未確認</p>
    <details className="signal-details signal-editorial-sources" id="signal-editorial-sources" data-print-evidence><summary>根拠・発表日・比較の限界を確かめる</summary>
      <dl className="signal-editorial-dates"><div><dt>発表日</dt><dd><time dateTime={comparison.announcement.publishedAt}>{comparison.announcement.publishedAt}</time> <a href={`#${sourceTarget(comparison.announcement.sourceId)}`}>発表の根拠</a></dd></div><div><dt>発売時期（原資料の表記）</dt><dd>{comparison.announcement.releaseWindow}</dd></div></dl>
      <div className="signal-editorial-claim"><h3>メーカーによる比較試験の説明</h3><p>{comparison.manufacturerClaim.text} <a href={`#${sourceTarget(comparison.manufacturerClaim.sourceId)}`}>試験の根拠</a></p><p>メーカーの説明であり、独立した実証ではありません。</p></div>
      <h3>この比較の限界</h3><ul>{comparison.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>
      <h3>確認した原資料</h3><ol>{comparison.sources.map((source) => <li id={sourceTarget(source.id)} tabIndex={-1} key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a><p>{source.notes}</p></li>)}</ol>
    </details>
    <div className="signal-editorial-next" id="signal-editorial-next" tabIndex={-1}><p className="signal-eyebrow">次に調べる問い</p><h3>{comparison.nextQuestion}</h3><a className="signal-text-button" href="#signal-editorial-sources">原資料と比較条件から確認する →</a></div>
  </section>;
}
