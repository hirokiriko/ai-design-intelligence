import type { ConfirmationGuide } from './confirmation-guide';

export function SignalConfirmationGuide({ guide, onDrawing, onSources }: {
  guide: ConfirmationGuide; onDrawing: () => void; onSources: () => void;
}) {
  return <section className="signal-confirmation-guide" data-observation-id={guide.observationId} aria-label="固定の確認ガイド">
    <p className="signal-eyebrow">固定の確認ガイド · 保存AIの回答ではありません</p>
    <h4>{guide.title}</h4><p>対象：{guide.target}（保存された呼称）</p>
    <div className="signal-guide-literal"><strong>確かめる保存AI記述</strong>
      {guide.literal.kind === 'pair' ? <dl><dt>比較A</dt><dd>{guide.literal.a}</dd><dt>比較B</dt><dd>{guide.literal.b}</dd></dl> : <p>{guide.literal.text || '観察本文は未記録です。'}</p>}
    </div>
    {guide.triggers.length ? <details className="signal-guide-triggers"><summary>この手順を選ぶ根拠語</summary><p className="signal-subtle">{guide.triggers.map((trigger, index) => <span key={index}>{index ? ' / ' : ''}{trigger.side}「{trigger.text}」</span>)}</p></details> : null}
    {!guide.pairedMedia ? <p className="signal-focus-caution">比較A/Bの参照図面が揃っていません。図面の対応を確認するまで、比較の判断は保留します。</p> : null}
    <dl className="signal-guide-decisions"><dt>確認したい問い</dt><dd>{guide.question}</dd><dt>確認できた場合</dt><dd>{guide.ifConfirmed}</dd><dt>確認できない場合・次の確認先</dt><dd>{guide.ifUnclear}</dd></dl>
    <p className="signal-subtle">保存文の語に応じた確認手順です。画像を新しく解釈した結果ではなく、機能・製品の同一性・法的範囲を判定しません。</p>
    <div className="signal-guide-actions"><button type="button" className="signal-button signal-primary" onClick={onDrawing}>この箇所の原図を確認する</button><button type="button" className="signal-button" onClick={onSources}>保存引用と日付を確認する</button></div>
  </section>;
}
