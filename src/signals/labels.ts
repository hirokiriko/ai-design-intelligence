import type { Bootstrap, DataMode, Run, Signal, SignalV2 } from './contract';

export const comparisonPairsVersion = (version: Bootstrap['schemaVersion'] | undefined) => version === '2.4.0' || version === '2.5.0' ? '2.3.0' : version === '2.2.0' || version === '2.3.0' ? version : null;

export const runLabels: Record<Run['status'], string> = {
  running: '進行中', complete: '処理終了', partial: '分析未完了（途中終了）', failed: 'API・AI処理の失敗', interrupted: '中断',
};
const quoteFailureLabels: Record<string, string> = {
  MODEL_EVIDENCE_QUOTE_INVALID: '引用検証の詳細条件は記録されていません。',
  MODEL_EVIDENCE_QUOTE_DUPLICATE_SOURCE: '同じ資料への複数の引用が含まれていました。',
  MODEL_EVIDENCE_QUOTE_TOO_LONG: '引用が保存可能な文字数の上限を超えていました。',
  MODEL_EVIDENCE_QUOTE_NOT_FOUND: '引用と完全に一致する箇所を原文で確認できませんでした。',
  MODEL_EVIDENCE_QUOTE_AMBIGUOUS: '引用と一致する箇所が複数あり、位置を特定できませんでした。',
  MODEL_EVIDENCE_QUOTE_OUTSIDE_EXCERPT: '引用がAIに渡した抜粋の範囲外でした。',
  MODEL_EVIDENCE_QUOTE_POSITION_MISMATCH: '引用と保存する文字位置が一致しませんでした。',
};
export const quoteFailureLabel = (run: Run): string | null =>
  (run.status === 'failed' || run.status === 'partial') && !factsOnlyRun(run) && run.errorCode !== null && Object.prototype.hasOwnProperty.call(quoteFailureLabels, run.errorCode) ? quoteFailureLabels[run.errorCode] : null;
const candidateFailureLabels: Record<string, string> = {
  MODEL_CANDIDATE_NOT_ALLOWED: '資料選択の検証で停止しました。詳細条件は記録されていません。',
  MODEL_CANDIDATE_SELECTION_EMPTY: '確認する資料が選択されていませんでした。',
  MODEL_CANDIDATE_SELECTION_DUPLICATE: '同じ資料が重複して選択されていました。',
  MODEL_CANDIDATE_OUT_OF_SCOPE: '今回選択できる範囲外の資料が指定されていました。',
  MODEL_CANDIDATE_ALREADY_FETCHED: '取得済みの資料が再び選択されていました。',
  MODEL_CANDIDATE_ALREADY_ATTEMPTED: '取得を試みた資料が再び選択されていました。',
  MODEL_CANDIDATE_SELECTION_LIMIT: '一度に確認できる資料数の上限を超えていました。',
  MODEL_ADDITIONAL_SELECTION_LIMIT: '追加確認で選択できる資料は1件ですが、件数が一致しませんでした。',
  MODEL_ADDITIONAL_MISSING_REQUIRED: '追加確認に必要な引用・日付・対象の対応について、不足理由が指定されていませんでした。',
  MODEL_ACTION_NOT_ALLOWED: '現在の確認段階では実行できない操作が指定されていました。',
};
export const candidateFailureLabel = (run: Run): string | null =>
  (run.status === 'failed' || run.status === 'partial') && !factsOnlyRun(run) && run.errorCode !== null && Object.prototype.hasOwnProperty.call(candidateFailureLabels, run.errorCode) ? candidateFailureLabels[run.errorCode] : null;
const relationshipFailureLabels: Record<string, string> = {
  MODEL_EVIDENCE_RELATIONSHIP_INVALID: '根拠対応の検証で停止しました。詳細条件は記録されていません。',
  MODEL_EVIDENCE_RELATIONSHIP_SUPPORT_UNKNOWN: '支持に指定された参照先を、検証済みの根拠から確認できませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_OPPOSITION_UNKNOWN: '反証に指定された参照先を、検証済みの根拠から確認できませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_OVERLAP: '同じ根拠が支持と反証の両方に指定されていました。',
  MODEL_EVIDENCE_RELATIONSHIP_DIRECT_SUPPORT_MISSING: '直接対応の判定に必要な支持根拠が指定されていませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_DIRECT_DESIGN_MISSING: '直接対応の支持根拠に意匠事実が含まれていませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_DIRECT_OFFICIAL_MISSING: '直接対応の支持根拠に検証済みの公式事実が含まれていませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_DIRECT_CONTRADICTED: '直接対応の判定に、反証または未確認事項が残っていました。',
  MODEL_EVIDENCE_RELATIONSHIP_CATEGORY_OFFICIAL_MISSING: '商品分野としての関連を支える検証済みの公式事実がありませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_MISSING_EVIDENCE_REQUIRED: '対応が未確認の判定に、次に必要な資料の説明がありませんでした。',
  MODEL_EVIDENCE_RELATIONSHIP_OPPOSITION_REQUIRED: '無関係・矛盾の判定に反証根拠が指定されていませんでした。',
};
export const relationshipFailureLabel = (run: Run): string | null =>
  (run.status === 'failed' || run.status === 'partial') && !factsOnlyRun(run) && run.errorCode !== null && Object.prototype.hasOwnProperty.call(relationshipFailureLabels, run.errorCode) ? relationshipFailureLabels[run.errorCode] : null;
export const dataModeLabel = (mode: DataMode): string => mode === 'approved_public' ? '公開情報由来のデータ' : '架空データ · 実在の企業・製品ではありません';
export const comparisonStatusLabel = (status: string): string => {
  if (status === 'administrator_matched_fixture_not_product_generations') return '管理者が架空資料を対応づけ済み（商品の新旧世代は未確認）';
  if (status === 'scale_unknown') return '縮尺は未確認';
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(status) ? status : '比較条件の詳細は未確認';
};
export const factsOnlyRun = (run: Run): boolean => run.versions.model === 'facts-only-deterministic';
const sourceRejectionOutcomes = new Set([
  ...['ENTRY', 'REDIRECT'].flatMap((stage) => ['CHARACTERS', 'PARSE', 'SCHEME', 'HOST', 'QUERY', 'USERINFO', 'PORT', 'PATH'].map((condition) => `URL_REJECTED_${stage}_${condition}`)),
  'SOURCE_PATH_NOT_APPROVED_ENTRY', 'SOURCE_PATH_NOT_APPROVED_REDIRECT',
]);
const sourceRejectionEvent = (event: Signal['toolEvents'][number]): boolean => event.tool === 'fetch_candidate' && sourceRejectionOutcomes.has(event.outcome);
export const partialSourceEvaluationRun = (run: Run): boolean => {
  if (run.status !== 'partial' || factsOnlyRun(run) || !['URL_REJECTED', 'SOURCE_PATH_NOT_APPROVED'].includes(run.errorCode ?? '') || !run.signal) return false;
  const readableSource = run.signal.sources.some((source) => {
    const chars = Array.from(source.excerpt);
    const visible = 'modelVisibleChars' in source && typeof source.modelVisibleChars === 'number' ? source.modelVisibleChars : chars.length;
    return chars.slice(0, visible).join('').trim().length > 0;
  });
  if (!readableSource) return false;
  const rejectedAt = run.signal.toolEvents.findIndex(sourceRejectionEvent);
  return rejectedAt >= 0 && run.signal.toolEvents.slice(rejectedAt + 1).some((event) => event.tool === 'finish' && event.outcome === 'ok');
};
export const sourceFailureLabel = (run: Run): string | null =>
  (run.status === 'failed' || run.status === 'partial') && !factsOnlyRun(run) && (['URL_REJECTED', 'SOURCE_PATH_NOT_APPROVED'].includes(run.errorCode ?? '') || run.signal?.toolEvents.some(sourceRejectionEvent))
    ? '公式資料の取得を許可範囲で停止しました。取得できなかった資料は結果の根拠に使っていません。' : null;
export const runStatusLabel = (run: Run): string => {
  if (partialSourceEvaluationRun(run)) return '一部資料を取得できず、取得済み資料で確認した途中結果';
  if (quoteFailureLabel(run)) return '引用の検証で停止／分析は未完了';
  if (candidateFailureLabel(run)) return '資料選択の検証で停止／分析は未完了';
  if (relationshipFailureLabel(run)) return '根拠対応の検証で停止／分析は未完了';
  if (run.status !== 'failed') return runLabels[run.status];
  if (factsOnlyRun(run)) return '確認処理の失敗';
  if (run.errorCode === 'MODEL_ASSESSMENT_RELATIONSHIP_INVALID') return 'AI応答の検証失敗（仮説と根拠の対応）';
  if (run.errorCode === 'MODEL_ASSESSMENT_TEXT_INVALID') return 'AI応答の検証失敗（確認事項の説明）';
  return runLabels.failed;
};
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
export const savedResultTarget = (run: Run): string => {
  if (run.schemaVersion === '1.0.0') return run.input.watch.name;
  const { entity, category } = run.input.context;
  const records = run.signal?.recordFacts ?? [];
  const codeOnly = records.some((record) => record.classifications.some((classification) => classification.code === category.label));
  const names = codeOnly ? [...new Set(records.flatMap((record) => record.articleName ? [record.articleName] : []))] : [];
  return `${entity.name ?? '企業名不明'} / ${names.length ? `対象物品：${names.join('・')}` : category.label}`;
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
