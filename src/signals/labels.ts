import type { DataMode, Run, SignalV2 } from './contract';

export const runLabels: Record<Run['status'], string> = {
  running: '進行中', complete: '処理終了', partial: '一部完了', failed: 'API・AI処理の失敗', interrupted: '中断',
};
export const dataModeLabel = (mode: DataMode): string => mode === 'approved_public' ? '公開情報由来のデータ' : '架空データ · 実在の企業・製品ではありません';
export const factsOnlyRun = (run: Run): boolean => run.versions.model === 'facts-only-deterministic';
export const runStatusLabel = (run: Run): string => factsOnlyRun(run) && run.status === 'failed' ? '確認処理の失敗' : runLabels[run.status];
export const evidenceId = (id: string): string => `signal-evidence-${Array.from(id, (character) => character.codePointAt(0)!.toString(16)).join('-')}`;
export const relationLabels: Record<SignalV2['relationships'][number]['relation'], string> = {
  direct: '個別意匠と商品の直接対応を確認', category: '商品分野として関連', candidate: '対応の候補・同一製品は未確認', unrelated_or_conflicting: '無関係・矛盾する根拠あり', unknown: '資料不足・対応不明',
};
