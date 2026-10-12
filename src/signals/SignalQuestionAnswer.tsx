import { explanationDisplayText } from './source-display';
import { useContext } from 'react';
import type { Run } from './contract';
import { SignalEvidenceDetails } from './SignalEvidenceDetails';
import { claimFailedChecks, ResultQualityContext } from './result-quality';
import { SignalQualityHold } from './SignalQualityHold';

export function SignalQuestionAnswer({ run, developmentMode = false }: { run: Run; developmentMode?: boolean }) {
  const failedChecks = useContext(ResultQualityContext);
  if (run.schemaVersion !== '2.5.0' || !run.signal) return null;
  const answer = run.signal.questionAnswer;
  const signal = run.signal;
  return <section className="signal-overview signal-question-answer" aria-labelledby="signal-question-answer-title">
    <p className="signal-eyebrow">{developmentMode ? '固定の模擬回答 · 実AI未実施' : run.status === 'complete' ? 'この実行に保存された回答' : '分析未完了 · 保存された途中状態'}</p>
    <h3 id="signal-question-answer-title" tabIndex={-1}>{run.input.analysisQuestion.text}</h3>
    {answer.status === 'not_evaluated' ? <p>この問いへの回答はまだ得られていません。途中の観察や引用を回答として補っていません。</p> : <SignalQualityHold checks={claimFailedChecks(failedChecks, signal, [...answer.evidenceIds, ...answer.supportingEvidenceIds, ...answer.opposingEvidenceIds])} label="保存された回答と限界" showContent>
      <p className="signal-badge">{answer.status === 'answered' ? '回答あり' : '追加確認が必要'}</p><p>{explanationDisplayText(answer.text)}</p>
      <div className="signal-outcome-evidence"><div><h4>支持する根拠</h4>{answer.supportingEvidenceIds.length ? <SignalEvidenceDetails ids={answer.supportingEvidenceIds} signal={signal} developmentMode={developmentMode} label="支持の根拠・図面・引用を確かめる" /> : <p>支持の根拠は未記録です。</p>}</div><div><h4>食い違い・反証の根拠</h4>{answer.opposingEvidenceIds.length ? <SignalEvidenceDetails ids={answer.opposingEvidenceIds} signal={signal} developmentMode={developmentMode} label="食い違い・反証を確かめる" /> : <p>反証の根拠は未記録です。</p>}</div></div>
      {answer.evidenceIds.length ? <SignalEvidenceDetails ids={answer.evidenceIds} signal={signal} developmentMode={developmentMode} label="回答で参照した根拠をすべて確かめる" /> : null}

    </SignalQualityHold>}
    <nav className="signal-evidence-links" aria-label="回答の根拠を確認">{signal.media.length ? <a href="#signal-images">対象の画像を確認</a> : null}{signal.sources.length ? <a href="#signal-saved-sources">公式資料を確認</a> : null}<a href="#signal-conditions">資料の比較へ戻る</a></nav>
      {answer.nextChecks.length ? <div id="signal-answer-next-checks" tabIndex={-1} className="signal-next-action"><h4>次に確認すること</h4><ol>{answer.nextChecks.map((text, index) => <li key={index}>{explanationDisplayText(text)}</li>)}</ol></div> : null}
      {answer.limitations.length ? <details className="signal-details"><summary>回答の限界・未確認事項</summary><ul>{answer.limitations.map((text, index) => <li key={index}>{explanationDisplayText(text)}</li>)}</ul></details> : null}
  </section>;
}
