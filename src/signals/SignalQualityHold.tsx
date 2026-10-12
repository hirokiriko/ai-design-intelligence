import type { ReactNode } from 'react';
import type { ReviewCheck } from './run-review';

export function SignalQualityHold({ checks, label, children, showContent = false }: { checks: readonly ReviewCheck[]; label: string; children: ReactNode; showContent?: boolean }) {
  if (!checks.length) return <>{children}</>;
  const imageCheck = checks.includes('V2');
  return <div className={imageCheck ? 'signal-quality-hold' : 'signal-quality-warning'} {...(imageCheck ? { 'data-quality-hold': checks.join(' ') } : { 'data-quality-warning': checks.join(' ') })}>
    <p className="signal-review-note" role="note"><strong>{imageCheck ? '図面の読み取りに再確認が必要です。回答の採用は保留です。' : '分析に確認が必要な点があります。根拠と照らして読んでください。'}</strong></p>
    <details className="signal-details signal-quality-detail"><summary>確認状況の詳細</summary><p>{checks.map((check) => `${check} FAIL`).join(' / ')} · {imageCheck ? '結論への採用保留' : '分析全体に未達'}</p><p>個別の判定は未記録です。保存された本文・判定を根拠と照合してください。</p></details>
    {!imageCheck || showContent ? children : <details className="signal-details" data-print-evidence><summary>{label}の原文を確認</summary>{children}</details>}
  </div>;
}
