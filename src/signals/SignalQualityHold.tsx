import type { ReactNode } from 'react';
import type { ReviewCheck } from './run-review';

export function SignalQualityHold({ checks, label, children }: { checks: readonly ReviewCheck[]; label: string; children: ReactNode }) {
  if (!checks.length) return <>{children}</>;
  // V4全体の未達から個々の仮説・対応評価の採用可否を一括判定しない。
  if (!checks.includes('V2')) return <div className="signal-quality-warning" data-quality-warning={checks.join(' ')}>
    <p className="signal-mode-note" role="note"><strong>{checks.map((check) => `${check} FAIL`).join(' / ')} · 実行全体の品質未達</strong><br />個別の合否は記録されていません。この記述の採用可否を一括では判断していません。根拠との照合が必要です。</p>
    {children}
  </div>;
  return <div className="signal-quality-hold" data-quality-hold={checks.join(' ')}>
    <p className="signal-error" role="note"><strong>{checks.map((check) => `${check} FAIL`).join(' / ')} · 結論への採用保留</strong><br />この実行には品質未達の記録があります。個々の記述の合否は記録されていないため、根拠との照合が必要です。</p>
    <details className="signal-details" data-print-evidence><summary>{label}の原文を確認</summary>
      <p className="signal-subtle">保存当時の本文・判定をそのまま表示します。以下の記述や限界の説明は、正しさを確認した結論ではありません。</p>
      {children}
    </details>
  </div>;
}
