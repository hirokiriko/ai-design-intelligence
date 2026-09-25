import type { DataMode, Run, Signal, SignalV2 } from './contract';

export const runLabels: Record<Run['status'], string> = {
  running: '進行中', complete: '処理終了', partial: '一部完了', failed: 'API・AI処理の失敗', interrupted: '中断',
};
export const dataModeLabel = (mode: DataMode): string => mode === 'approved_public' ? '公開情報由来のデータ' : '架空データ · 実在の企業・製品ではありません';
export const factsOnlyRun = (run: Run): boolean => run.versions.model === 'facts-only-deterministic';
export const runStatusLabel = (run: Run): string => factsOnlyRun(run) && run.status === 'failed' ? '確認処理の失敗' : runLabels[run.status];
export const evidenceId = (id: string): string => `signal-evidence-${Array.from(id, (character) => character.codePointAt(0)!.toString(16)).join('-')}`;
export const classificationSchemeLabel = (scheme: string | null): string => {
  if (scheme === null) return '未確認';
  return { JPO_NATIONAL_DESIGN: '日本意匠分類', JPO_D_TERM: 'Dターム', LOCARNO: 'ロカルノ分類', fictional: '架空分類' }[scheme] ?? '分類体系名未確認';
};
export const recordDisplayLabel = (record: { articleName: string | null; registrationNumber: string | null; applicationNumber?: string | null } | undefined, fallback: string): string => {
  const name = record?.articleName ?? fallback;
  if (record?.registrationNumber) return `${name}（登録番号 ${record.registrationNumber}）`;
  if (record?.applicationNumber) return `${name}（出願番号 ${record.applicationNumber}）`;
  return name;
};
export const coveragePhrase = (coverage: string): string => coverage.trim().replace(/[\s。]+$/u, '');
export const comparisonCoverageSummary = (signal: Pick<Signal, 'coverage' | 'counts'>): string =>
  `比較A：${coveragePhrase(signal.coverage.before)} ／ 比較B：${coveragePhrase(signal.coverage.after)}。${signal.counts.comparable ? '比較可能な収録条件です。' : '収録条件が一致しないため、増減を断定できません。'} 除外：A ${signal.counts.excludedBefore}件・B ${signal.counts.excludedAfter}件`;
const readableClassificationSegment = (text: string): string =>
  text.replace(/\b(JPO_NATIONAL_DESIGN|JPO_D_TERM|LOCARNO|fictional)\s*:/gu, (_match, scheme: string) => `${classificationSchemeLabel(scheme)} `);
export const designFactText = (text: string, field: string): string => {
  if (field === 'classifications') return readableClassificationSegment(text);
  if (field !== 'record') return text;
  const start = text.indexOf('分類: ');
  if (start < 0) return text;
  const descriptionStart = text.indexOf('。説明: ', start);
  const end = descriptionStart < 0 ? text.length : descriptionStart;
  return text.slice(0, start) + readableClassificationSegment(text.slice(start, end)) + text.slice(end);
};
const designFactFieldLabels: Record<string, string> = {
  articleName: '物品名', registrationNumber: '登録番号', applicationNumber: '出願番号',
  applicationDate: '出願日', gazetteDate: '公報日', classifications: '分類',
  description: '意匠の説明', articleDescription: '物品の説明', recordCount: '収録件数',
};
export const designFactFieldLabel = (field: string): string => designFactFieldLabels[field] ?? '意匠書誌事項';
export const relationLabels: Record<SignalV2['relationships'][number]['relation'], string> = {
  direct: '個別意匠と商品の直接対応を確認', category: '商品分野として関連', candidate: '対応の候補・同一製品は未確認', unrelated_or_conflicting: '無関係・矛盾する根拠あり', unknown: '資料不足・対応不明',
};
