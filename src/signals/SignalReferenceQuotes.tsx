import type { ComparisonMedia, RunContext, SignalV2 } from './contract';
import { publicationCondition, type ConfirmationGuide } from './confirmation-guide';
import { sourceDisplayTitle } from './source-display';

export function SignalReferenceQuotes({ signal, context, media, guide, held = false }: {
  signal: SignalV2; context: RunContext; media: readonly ComparisonMedia[]; guide: ConfirmationGuide | null; held?: boolean;
}) {
  return <section className="signal-reference-quotes" aria-label="実行全体の参考引用と日付">
    <h4>同じ実行の参考引用を、原図と照合する</h4>
    <p>以下は保存された公式の引用です。ここに並ぶことだけでは、選んだ箇所や個別意匠との対応を意味しません。</p>
    {held ? <p className="signal-focus-caution">このrunの引用と日付条件の評価は品質未達です。以下は再確認のための保存引用で、採用保留は変わりません。</p> : null}
    {guide ? <div className="signal-guide-literal signal-reference-target" data-observation-id={guide.observationId}><strong>照合する箇所（保存AI記述）：{guide.target}</strong>
      {guide.literal.kind === 'pair' ? <dl><dt>比較A</dt><dd>{guide.literal.a}</dd><dt>比較B</dt><dd>{guide.literal.b}</dd></dl> : <p>{guide.literal.text || '観察本文は未記録です。'}</p>}
    </div> : null}
    <p className="signal-reference-question"><strong>確認したい問い（固定ガイド）：</strong>資料に、この意匠の番号や、ここに示した保存記述が指す箇所との対応が明記されていますか？</p>
    <p><strong>確認できた場合：</strong>明記された対応と引用範囲だけを補足根拠として検討します。<strong>確認できない場合：</strong>参考資料のまま残し、図面の説明や番号が確認できる資料を調べます。</p>
    <div className="signal-reference-dates"><strong>保存された比較の基準日</strong><p>比較A {context.beforeDataset.dataAsOf} / 比較B {context.afterDataset.dataAsOf}</p>
      {media.map(item => <p key={item.id}>{item.role === 'comparisonA' ? '図面A' : '図面B'}：出願日 {item.applicationDate ?? '不明'} / 公報日 {item.gazetteDate ?? '不明'}</p>)}
      <p className="signal-subtle">基準日・公報日・発表日・発売日・取得日時は別の意味です。日付の前後だけで製品世代や因果関係は判断しません。</p>
    </div>
    {signal.officialFacts.length ? signal.officialFacts.map(fact => {
      const source = signal.sources.find(item => item.id === fact.sourceId);
      return <article className="signal-reference-quote" key={fact.id}>
        <p className="signal-eyebrow">実行全体の参考引用 · 選択箇所との対応はここでは未判定</p>
        <h5>{sourceDisplayTitle(source?.title ?? '')}</h5><blockquote>{fact.quote}</blockquote>
        <details><summary>保存AIによる記載要約</summary><p>{fact.text}</p></details>
        {source ? <><dl className="signal-reference-date-list"><dt>発表日</dt><dd>{source.publishedAt ?? '不明'}</dd><dt>更新日</dt><dd>{source.updatedAt ?? '不明'}</dd><dt>発売日</dt><dd>{source.releaseAt ?? '不明'}</dd><dt>取得日時</dt><dd>{source.retrievedAt}</dd></dl>
          <p>{publicationCondition(source.publishedAt, context.beforeDataset.dataAsOf, context.afterDataset.dataAsOf)}</p>
          {source.retrospective ? <p className="signal-subtle">事後に補足した資料として保存されています。</p> : null}
          {source.truncated ? <p className="signal-subtle">保存された分析用抜粋には省略があります。全文を確認したことにはなりません。</p> : null}
          <a href={source.url} target="_blank" rel="noopener noreferrer">公式の出典を開く ↗</a></> : <p>引用元の保存情報を確認できません。対応と日付の判断は保留します。</p>}
      </article>;
    }) : <p>採用された公式引用は未記録です。下の保存資料があっても、引用や対応の確認済みとは扱いません。</p>}
  </section>;
}
