import type { ReactNode } from 'react';
import type { ReviewCheck } from './run-review';

export function SignalQualityHold({ checks, label, children }: { checks: readonly ReviewCheck[]; label: string; children: ReactNode }) {
  if (!checks.length) return <>{children}</>;
  // V4全体の未達から個々の仮説・対応評価の採用可否を一括判定しない。
  if (!checks.includes('V2')) return <div className="signal-quality-warning" data-quality-warning={checks.join(' ')}>
    <p className="signal-mode-note" role="note"><strong>{checks.map((check) => `${check} FAIL`).join(' / ')} · 分析全体に未達</strong><br />個別の判定は未記録です。支持・反証から確かめてください。</p>
    {children}
  </div>;
  return <div className="signal-quality-hold" data-quality-hold={checks.join(' ')}>
    <p className="signal-error" role="note"><strong>{checks.map((check) => `${check} FAIL`).join(' / ')} · 結論への採用保留</strong><br />画像観察の再確認が必要です。個別の判定は未記録です。</p>
    <details className="signal-details" data-print-evidence><summary>{label}の原文を確認</summary>
      <p className="signal-subtle">保存当時の本文・判定です。限界の説明も、根拠と照合してください。</p>
      {children}
    </details>
  </div>;
}
