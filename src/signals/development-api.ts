import { SignalApiError, type SignalApi } from './api';
import { decodeBootstrap, decodeComparisonPairs, decodeRun, decodeRuns, decodeWatch, type Bootstrap, type Run, type RunV22, type RunV25, type SignalV25, type Watch, type WatchInput } from './contract';
import { ANALYSIS_QUESTIONS, ANALYSIS_QUESTION_VERSION, analysisQuestion, isAnalysisQuestion, sameAnalysisQuestion, type AnalysisQuestion } from './analysis-question';
import { fictionalRunV22 } from './fixtures-v22';

// This adapter is imported only by the explicitly selected, loopback-only Vite development screen.
// It never uses fetch, the real API adapter, real pending-request storage, or a database.
export const DEVELOPMENT_STORAGE_KEY = 'kds_fixture_signals_local_development_v1';
const developmentLock = 'kds_fixture_signals_local_development_lock_v1';
const injectedStorageLocks = new WeakMap<DevelopmentStorage, Promise<void>>();
const csrfToken = 'kds_fixture_local_development_csrf';
const storageMessage = '架空のローカル保存を確認できません。実環境へは接続しません。ブラウザーの保存設定を確認するか、開発モードの「架空保存を消して最初から」を使ってください。';
const namespace = /^(?:FIXTURE-|kds_fixture_)[A-Za-z0-9._:-]+$/;
export type DevelopmentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
interface DevelopmentOptions { storage?: DevelopmentStorage; delayMs?: number }
interface RequestAssociation { watchId: string; requestId: string; runId: string }
interface DevelopmentState { version: 1; epoch: string; watches: Watch[]; runs: Run[]; requests: RequestAssociation[] }
interface LocalSnapshot { raw: string | null; state: DevelopmentState }
export interface DevelopmentApi extends SignalApi { resetLocalData: () => Promise<void> }

function localError(code: string, message: string): SignalApiError { return new SignalApiError(code, message, false, true); }
function storageError(): SignalApiError { return localError('development-storage', storageMessage); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean { return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)); }

// Replace whole identifier values only. Text, source offsets, and quoted passages are never rewritten.
function mapFixtureIds<T>(value: T, replacements: Map<string, string>): T {
  if (typeof value === 'string') return (replacements.get(value) ?? value) as T;
  if (Array.isArray(value)) return value.map((entry: unknown) => mapFixtureIds(entry, replacements)) as T;
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, mapFixtureIds(entry, replacements)])) as T;
  return value;
}
function assertFictionalIdentifiers(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(assertFictionalIdentifiers); return; }
  if (!isObject(value)) return;
  // Question IDs are a closed, decoder-validated enum; every artifact identifier remains fictional.
  if (isAnalysisQuestion(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'questionId') {
      if (typeof entry !== 'string' || !Object.prototype.hasOwnProperty.call(ANALYSIS_QUESTIONS, entry) || value.questionVersion !== ANALYSIS_QUESTION_VERSION) throw storageError();
      continue;
    }
    if (key === 'id' || key.endsWith('Id')) {
      if (entry !== null && (typeof entry !== 'string' || !namespace.test(entry))) throw storageError();
    } else if (key.endsWith('Ids')) {
      if (!Array.isArray(entry) || entry.some((id: unknown) => typeof id !== 'string' || !namespace.test(id))) throw storageError();
    }
    assertFictionalIdentifiers(entry);
  }
}

function createTemplate(caseNumber: 1 | 2): RunV22 {
  const prefix = `FIXTURE-DEV-CASE-${caseNumber}`;
  const mapping = new Map<string, string>([
    ['run-fixture-pair-one', `kds_fixture_case_${caseNumber}_template_run`],
    ['watch_fixture_v2', `kds_fixture_case_${caseNumber}_watch`],
    ['FIXTURE-ENTITY-APPLICANT-A', `${prefix}-ENTITY`], ['FIXTURE-CLASS-A01', `${prefix}-CLASS`],
    ['FIXTURE-DATASET-SIGNAL-BEFORE', `${prefix}-DATASET-A`], ['FIXTURE-DATASET-SIGNAL-AFTER', `${prefix}-DATASET-B`],
    ['FIXTURE-SOURCE-COMPANY-A', `${prefix}-SOURCE-PROFILE`], ['fixture-pair-one', `${prefix}-PAIR`],
    ['kds_fixture_article_alpha', `${prefix}-RECORD-A`], ['kds_fixture_article_beta', `${prefix}-RECORD-B`],
    ['FIXTURE-MEDIA-BEFORE', `${prefix}-MEDIA-A`], ['FIXTURE-MEDIA-AFTER', `${prefix}-MEDIA-B`],
    ['design-1', `${prefix}-FACT-A`], ['design-2', `${prefix}-FACT-B`],
    ['visual-fixture', `${prefix}-OBSERVATION`], ['official-fixture', `${prefix}-OFFICIAL`],
    ['hypothesis-fixture', `${prefix}-HYPOTHESIS`],
    ['candidate-4a7d1cd5eae802b4', `${prefix}-SOURCE-OFFICE`], ['candidate-0887fe04fce9fea4', `${prefix}-SOURCE-PRODUCT`],
  ]);
  const run = mapFixtureIds(structuredClone(fictionalRunV22), mapping);
  if (!run.signal || !run.input.comparisonPair) throw new Error('Fictional development template is incomplete');
  const signal = run.signal;
  const pair = run.input.comparisonPair;
  run.input.watch.name = caseNumber === 1 ? '架空操作器 · 中央枠の表現差' : '架空案内器 · 引用との対応が不明';
  run.input.context.entity.name = `架空図形ラボ${caseNumber}`;
  run.input.context.category.label = caseNumber === 1 ? '架空操作器' : '架空案内器';
  run.input.context.beforeDataset.collection = null;
  run.input.context.afterDataset.collection = null;
  run.input.context.beforeDataset.coverage = '自作の架空資料Aを含む限定収録例。実在資料ではありません。';
  run.input.context.afterDataset.coverage = '自作の架空資料A/Bを含む限定収録例。実在資料ではありません。';
  signal.coverage = { before: run.input.context.beforeDataset.coverage, after: run.input.context.afterDataset.coverage };
  signal.limitations = ['自作の架空図形と固定の模擬結果です。実AIによる画像観察や品質判定を実施していません。', 'A/Bは比較資料の役割です。商品の新旧世代や販売順を示しません。'];
  pair.label = caseNumber === 1 ? '架空図形 · 中央の円と長方形' : '架空図形 · 形状と無関係な引用';
  pair.evidence = '同じ640×480の表示条件で配置する自作図形の架空比較例です。商品の対応、機能、材質は不明です。';
  pair.media.forEach((media, index) => {
    media.label = index === 0 ? '架空資料A · 中央に円' : '架空資料B · 中央に長方形';
    media.width = 640; media.height = 480; media.view = '自作図形の正面例';
    media.permission = '自作の架空図形。ローカル開発表示専用。';
    media.comparisonStatus = '自作図形を同じ表示条件で配置。実在製品の対応は不明。';
  });
  signal.media = structuredClone(pair.media);
  signal.recordFacts.forEach((fact, index) => {
    fact.articleName = `${run.input.context.category.label} · 架空資料${index === 0 ? 'A' : 'B'}`;
    fact.applicant.name = run.input.context.entity.name;
    fact.classifications.forEach((classification) => { classification.label = run.input.context.category.label; });
    fact.description = '自作の架空比較図形。実在する製品や登録意匠の資料ではありません。';
    fact.articleDescription = '画面操作の検証用に作成した架空資料です。';
  });
  signal.designFacts.forEach((fact, index) => { fact.text = `${run.input.context.category.label}の架空資料${index === 0 ? 'A' : 'B'}。実在する製品や登録意匠の事実ではありません。`; });
  signal.visualObservations = [{ id: `${prefix}-OBSERVATION`, part: '中央の閉じた枠', status: 'change_candidate', mediaIds: pair.media.map((media) => media.id), observation: '架空資料Aでは中央の閉じた枠を円、Bでは長方形として描いています。これは自作図形に対応する固定の模擬観察文です。機能、材質、内側の奥行きは分かりません。' }];
  const quote = caseNumber === 1 ? '架空操作器の作図例には、中央に閉じた枠を配置しました。実在する商品ではありません。' : '架空図形ラボの本社を移転しました。実在する企業のお知らせではありません。';
  const source = structuredClone(signal.sources[caseNumber === 1 ? 1 : 0]);
  source.excerpt = quote; source.excerptStart = 0; source.extractedChars = Array.from(quote).length; source.modelVisibleChars = Array.from(quote).length;
  source.title = caseNumber === 1 ? '架空資料 · 中央枠の作図案内' : '架空資料 · 本社移転のお知らせ';
  source.url = `https://fixture.example.test/development/case-${caseNumber}`;
  source.publishedAt = null; source.updatedAt = '2026-09-20'; source.releaseAt = null;
  source.extractionVersion = 'kds_fixture_local_text'; source.contentHash = '0'.repeat(64); source.bodyHash = '0'.repeat(64);
  signal.sources = [source];
  signal.officialFacts = [{ id: `${prefix}-OFFICIAL`, sourceId: source.id, quote, start: 0, end: Array.from(quote).length, text: caseNumber === 1 ? '架空資料は中央に閉じた枠を置いた作図例だと記載しています。円から長方形への変更理由は記載していません。' : '架空資料の記載は本社移転です。商品の形状や中央枠についての説明はありません。' }];
  signal.hypotheses = [{ id: `${prefix}-HYPOTHESIS`, evidenceIds: [`${prefix}-OBSERVATION`, `${prefix}-OFFICIAL`], text: caseNumber === 1 ? '中央枠の表現差を、操作位置の見せ方を検討する材料にできます。機能が変わったとの結論には追加資料が必要です。' : '自作図形の表現差は比較できますが、本社移転の引用から形状変更の意図や製品との対応は判断できません。', limitations: ['固定の模擬結果です。実在製品の意図や法的範囲の判断に使えません。', '商品の型番・機能と図面を対応付ける資料がありません。'] }];
  signal.relationships = [{ id: `${prefix}-HYPOTHESIS`, relation: caseNumber === 1 ? 'candidate' : 'unrelated_or_conflicting', summary: caseNumber === 1 ? '中央枠という観点は共通します。資料の対応と変更理由は未確認です。' : '引用は本社移転だけで、比較図形の形状を裏付けません。', supportingEvidenceIds: caseNumber === 1 ? [`${prefix}-OBSERVATION`, `${prefix}-OFFICIAL`] : [], opposingEvidenceIds: caseNumber === 2 ? [`${prefix}-OFFICIAL`] : [], missingEvidence: ['図形と製品型番の対応表', '中央枠の機能・寸法・変更理由を説明する資料', '発表日を明示した本文または公式メタデータ'] }];
  signal.questionsForHuman = caseNumber === 1 ? ['A/B画像で中央枠と外周を別々に確認してください。円と長方形の違いから機能や材質を推測しないでください。', '次の検討には、製品型番との対応表と中央枠の寸法・機能説明を用意してください。'] : ['本社移転の引用は形状変更の根拠になるか、引用本文で確認してください。', '形状と製品を結び付ける説明資料を追加し、関連が不明のまま保存されていることを確認してください。'];
  signal.status = 'insufficient'; signal.toolEvents = [];
  signal.discovery = { state: 'not_started', scannedLinks: 0, eligibleCandidates: 0, omittedCandidates: 0, candidates: [], limitations: ['架空資料を読み込んだだけです。Web取得やAI検索は行いません。'] };
  signal.stopReason = '架空の固定結果を表示しました。実AI・外部通信は行っていません。';
  run.usage = { modelRequests: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0 };
  run.versions = { model: 'fictional-development-replay', prompt: 'kds_fixture_local_display_v1', schema: '2.2.0' };
  assertFictionalIdentifiers(run);
  return decodeRun(run) as RunV22;
}

const templates = [createTemplate(1), createTemplate(2)];
const initialWatches = templates.map((template) => template.input.watch);
const catalog: Bootstrap['catalog'] = {
  entities: templates.map((template) => template.input.context.entity),
  categories: templates.map((template) => ({ id: template.input.context.category.id, label: template.input.context.category.label })),
  datasets: templates.flatMap((template) => [template.input.context.beforeDataset, template.input.context.afterDataset].map(({ id, dataAsOf, coverage }, index) => ({ id, dataAsOf, coverage, sourceFamily: 'FIXTURE-LOCAL-DEVELOPMENT', recordCount: index + 1, dataMode: 'fictional' as const }))),
  sourceProfiles: initialWatches.map((watch, index) => ({ id: watch.sourceProfileId, label: `架空資料セット${index + 1} · 外部取得なし`, dataMode: 'fictional' })),
};
function bootstrapFor(watches: Watch[]): Bootstrap { return decodeBootstrap({ schemaVersion: '2.5.0', dataMode: 'fictional', analysisMode: 'standard', analysisQuestionVersion: ANALYSIS_QUESTION_VERSION, csrfToken, catalog: structuredClone(catalog), watches: structuredClone(watches) }); }
function questionTemplate(template: RunV22, question: AnalysisQuestion): RunV25 {
  if (!template.signal) throw storageError();
  const signal = structuredClone(template.signal);
  const relationship = signal.relationships[0];
  const answer: SignalV25['questionAnswer'] = {
    questionId: question.id, questionVersion: question.version, status: question.id === 'support' ? 'insufficient' : 'answered',
    text: question.id === 'drawings' ? signal.visualObservations[0].observation
      : question.id === 'support' ? '架空の引用と図形を照合する固定の表示例です。共通する観点や関連不足は示せますが、図面変更の理由や実際の製品との対応は確認できません。'
        : '次に図面と製品型番の対応、中央枠の説明、公開日の根拠を人が確認します。これは保存済みの架空資料を使った固定の表示例です。',
    evidenceIds: question.id === 'drawings' ? signal.visualObservations.map((item) => item.id)
      : question.id === 'support' ? [...signal.visualObservations, ...signal.officialFacts].map((item) => item.id) : signal.designFacts.map((item) => item.id),
    supportingEvidenceIds: question.id === 'support' ? [...relationship.supportingEvidenceIds] : [],
    opposingEvidenceIds: question.id === 'support' ? [...relationship.opposingEvidenceIds] : [],
    nextChecks: [...signal.questionsForHuman],
    limitations: [...signal.limitations, '架空資料の固定回答です。実 AI の品質、モデル実行、費用を示す結果ではありません。'],
  };
  return { ...structuredClone(template), schemaVersion: '2.5.0', input: { ...structuredClone(template.input), analysisQuestion: analysisQuestion(question.id) }, signal: { ...signal, questionAnswer: answer }, versions: { ...template.versions, prompt: 'kds_fixture_local_question_v1', schema: '2.5.0' } };
}
function matchesPurpose(run: Run, comparisonPairId: string | undefined, question: AnalysisQuestion | null): boolean {
  return (run.schemaVersion === '2.2.0' || run.schemaVersion === '2.5.0') && run.input.comparisonPair?.id === comparisonPairId
    && sameAnalysisQuestion(run.schemaVersion === '2.5.0' ? run.input.analysisQuestion : null, question);
}
function templateFor(watch: Watch | WatchInput): RunV22 | undefined {
  return templates.find(({ input }) => ['entityId', 'categoryId', 'beforeDatasetId', 'afterDatasetId', 'sourceProfileId'].every((key) => watch[key as keyof WatchInput] === input.watch[key as keyof WatchInput]));
}
function initialState(epoch = 'kds_fixture_initial_epoch'): DevelopmentState { return { version: 1, epoch, watches: structuredClone(initialWatches), runs: [], requests: [] }; }
function requireWatch(state: DevelopmentState, watchId: string): Watch {
  const watch = state.watches.find((item) => item.id === watchId);
  if (!watch) throw localError('404', 'この架空確認条件はありません。登録済みの架空ケースを選び直してください。');
  return watch;
}
function validateState(value: unknown): DevelopmentState {
  if (!isObject(value) || !exactKeys(value, ['version', 'epoch', 'watches', 'runs', 'requests']) || value.version !== 1 || typeof value.epoch !== 'string' || !/^kds_fixture_[A-Za-z0-9_-]+$/.test(value.epoch) || !Array.isArray(value.watches) || value.watches.length > 100 || !Array.isArray(value.runs) || value.runs.length > 200 || !Array.isArray(value.requests) || value.requests.length > 500) throw storageError();
  assertFictionalIdentifiers(value);
  const watches = value.watches.map(decodeWatch);
  bootstrapFor(watches);
  if (initialWatches.some((watch) => !watches.some((entry) => JSON.stringify(entry) === JSON.stringify(watch))) || watches.some((watch) => !templateFor(watch))) throw storageError();
  const runs = decodeRuns({ schemaVersion: '2.2.0', runs: value.runs });
  for (const run of runs) {
    const watch = watches.find((entry) => entry.id === run.watchId);
    const template = templateFor(run.input.watch);
    if ((run.schemaVersion !== '2.2.0' && run.schemaVersion !== '2.5.0') || !watch || !template || run.status !== 'complete' || run.errorCode !== null || run.input.context.dataMode !== 'fictional') throw storageError();
    const expected = run.schemaVersion === '2.5.0' ? questionTemplate(template, run.input.analysisQuestion) : template;
    if (JSON.stringify(run.input.watch) !== JSON.stringify(watch) || JSON.stringify(run.input.context) !== JSON.stringify(template.input.context)
      || JSON.stringify(run.input.comparisonPair) !== JSON.stringify(template.input.comparisonPair) || JSON.stringify(run.signal) !== JSON.stringify(expected.signal)
      || JSON.stringify(run.versions) !== JSON.stringify(expected.versions) || Object.values(run.usage).some((number) => number !== 0)) throw storageError();
  }
  const requests: RequestAssociation[] = value.requests.map((entry: unknown) => {
    if (!isObject(entry) || !exactKeys(entry, ['watchId', 'requestId', 'runId']) || typeof entry.watchId !== 'string' || typeof entry.requestId !== 'string' || typeof entry.runId !== 'string' || !runs.some((run) => run.id === entry.runId && run.watchId === entry.watchId)) throw storageError();
    return { watchId: entry.watchId, requestId: entry.requestId, runId: entry.runId };
  });
  if (new Set(requests.map((entry) => `${entry.watchId}:${entry.requestId}`)).size !== requests.length) throw storageError();
  return { version: 1, epoch: value.epoch, watches, runs, requests };
}
function normalizedRequestId(requestId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(requestId)) throw localError('400', '架空実行の要求IDを確認できません。自動再送は行いません。');
  return `kds_fixture_request_${requestId}`;
}

export function createDevelopmentApi({ storage, delayMs = 300 }: DevelopmentOptions = {}): DevelopmentApi {
  let generation = 0;
  const selectedStorage = (): DevelopmentStorage => {
    try { return storage ?? window.localStorage; } catch { throw storageError(); }
  };
  const load = (): LocalSnapshot => {
    try {
      const raw = selectedStorage().getItem(DEVELOPMENT_STORAGE_KEY);
      if (raw === null) return { raw, state: initialState() };
      if (raw.length > 2_000_000) throw storageError();
      return { raw, state: validateState(JSON.parse(raw) as unknown) };
    } catch { throw storageError(); }
  };
  const save = (snapshot: LocalSnapshot): void => {
    try {
      const next = JSON.stringify(validateState(snapshot.state));
      if (next.length > 2_000_000) throw storageError();
      const target = selectedStorage();
      if (target.getItem(DEVELOPMENT_STORAGE_KEY) !== snapshot.raw) throw storageError();
      target.setItem(DEVELOPMENT_STORAGE_KEY, next);
      if (target.getItem(DEVELOPMENT_STORAGE_KEY) !== next) throw storageError();
    } catch { throw storageError(); }
  };
  const wait = async (): Promise<void> => {
    const duration = Math.min(500, Math.max(0, Number.isFinite(delayMs) ? delayMs : 0));
    if (duration) await new Promise<void>((resolve) => setTimeout(resolve, duration));
  };
  const mutate = async <T,>(action: () => T | Promise<T>): Promise<T> => {
    if (storage) {
      // Explicitly injected stores are the in-process test boundary, shared by all test adapters.
      const previous = injectedStorageLocks.get(storage) ?? Promise.resolve();
      const operation = previous.then(action);
      injectedStorageLocks.set(storage, operation.then(() => {}, () => {}));
      return operation;
    }
    if (typeof navigator === 'undefined' || typeof navigator.locks?.request !== 'function') throw localError('development-storage', '架空保存を安全に更新するためのブラウザーロックを利用できません。実環境には接続しません。通常の対応ブラウザーでローカル開発画面を開いてください。');
    try { return await navigator.locks.request(developmentLock, { mode: 'exclusive' }, action); }
    catch (failure) { if (failure instanceof SignalApiError) throw failure; throw storageError(); }
  };
  const requireGeneration = (expected: number): void => {
    if (expected !== generation) throw localError('development-reset', '架空保存の初期化により、この操作を取り消しました。初期化前の要求を再送していません。');
  };
  const result = (run: Run): Run => decodeRun(structuredClone(run));
  return {
    bootstrap: async () => bootstrapFor(load().state.watches),
    comparisonPairs: async (watch) => {
      const current = requireWatch(load().state, watch.id);
      const template = templateFor(current);
      if (!template?.input.comparisonPair) throw localError('404', 'この架空条件に対応する比較資料がありません。');
      return decodeComparisonPairs({ schemaVersion: '2.3.0', comparisonPairs: [structuredClone(template.input.comparisonPair)] }, current);
    },
    saveWatch: async (input, token) => {
      if (token !== csrfToken) throw localError('403', '架空開発モードの操作情報を確認できません。再読み込みしてください。');
      if (!templateFor(input)) throw localError('400', 'この開発例では、同じ架空ケースの企業・分類・収録資料・参照先を組み合わせてください。');
      const expected = generation;
      const expectedEpoch = load().state.epoch;
      return mutate(() => {
        requireGeneration(expected);
        const snapshot = load();
        if (snapshot.state.epoch !== expectedEpoch) throw localError('development-reset', '架空保存の初期化により、この操作を取り消しました。初期化前の要求を再送していません。');
        const watch = decodeWatch({ ...input, id: `kds_fixture_watch_${crypto.randomUUID()}`, createdAt: new Date().toISOString() });
        snapshot.state.watches.push(watch); save(snapshot);
        return structuredClone(watch);
      });
    },
    runs: async (watchId) => {
      const state = load().state; requireWatch(state, watchId);
      return state.runs.filter((run) => run.watchId === watchId).map(result).reverse();
    },
    run: async (runId) => {
      const run = load().state.runs.find((entry) => entry.id === runId);
      if (!run) throw localError('404', 'このブラウザーの架空保存に結果がありません。架空ケースを選び、明示的に開始してください。');
      return result(run);
    },
    requestRun: async (watchId, requestId) => {
      const state = load().state; requireWatch(state, watchId);
      const association = state.requests.find((entry) => entry.watchId === watchId && entry.requestId === normalizedRequestId(requestId));
      const run = association && state.runs.find((entry) => entry.id === association.runId);
      if (!run) throw localError('404', 'この架空実行の保存結果はありません。要求は自動再送しません。');
      return result(run);
    },
    start: async (watchId, intent, requestId, token, comparisonPairId, selectedQuestion) => {
      const candidate = selectedQuestion == null ? null : { ...selectedQuestion };
      if (candidate !== null && !isAnalysisQuestion(candidate)) throw localError('invalid-question', '登録された質問を選び直してください。');
      const question = candidate === null ? null : analysisQuestion(candidate.id);
      if (token !== csrfToken) throw localError('403', '架空開発モードの操作情報を確認できません。再読み込みしてください。');
      const request = normalizedRequestId(requestId);
      const expected = generation;
      const expectedEpoch = load().state.epoch;
      return mutate(async () => {
        // The brief simulated progress is inside the own-key lock. A reset queued by another
        // adapter/tab completes after this operation and cannot be undone by its delayed write.
        await wait();
        requireGeneration(expected);
        const snapshot = load();
        if (snapshot.state.epoch !== expectedEpoch) throw localError('development-reset', '架空保存の初期化により、この操作を取り消しました。初期化前の要求を再送していません。');
        const watch = requireWatch(snapshot.state, watchId);
        const template = templateFor(watch);
        if (!template?.input.comparisonPair || template.input.comparisonPair.id !== comparisonPairId) throw localError('400', 'この架空ケースの比較組を選んでから開始してください。資料の選択だけでは実行しません。');
        const priorRequest = snapshot.state.requests.find((entry) => entry.watchId === watchId && entry.requestId === request);
        if (priorRequest) {
          const priorRun = snapshot.state.runs.find((run) => run.id === priorRequest.runId);
          if (!priorRun || !matchesPurpose(priorRun, comparisonPairId, question)) throw localError('409', '同じ要求IDを別の架空比較条件に使うことはできません。');
          return result(priorRun);
        }
        let run = intent === 'check' ? [...snapshot.state.runs].reverse().find((entry) => entry.watchId === watchId && matchesPurpose(entry, comparisonPairId, question)) : undefined;
        if (!run) {
          const createdAt = new Date().toISOString();
          const selectedTemplate = question ? questionTemplate(template, question) : structuredClone(template);
          run = decodeRun({ ...selectedTemplate, id: `kds_fixture_run_${crypto.randomUUID()}`, watchId, createdAt, completedAt: createdAt, input: { ...selectedTemplate.input, watch: structuredClone(watch) } });
          snapshot.state.runs.push(run);
        }
        snapshot.state.requests.push({ watchId, requestId: request, runId: run.id }); save(snapshot);
        return result(run);
      });
    },
    resetLocalData: async () => {
      generation += 1;
      return mutate(() => {
        try {
          const target = selectedStorage();
          // An empty state with a new own-key epoch also invalidates operations queued in other tabs.
          const empty = JSON.stringify(initialState(`kds_fixture_epoch_${crypto.randomUUID()}`));
          target.setItem(DEVELOPMENT_STORAGE_KEY, empty);
          if (target.getItem(DEVELOPMENT_STORAGE_KEY) !== empty) throw storageError();
        } catch { throw storageError(); }
      });
    },
  };
}
