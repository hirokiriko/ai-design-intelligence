// Backend の公開補足 DTO。旧保存結果 1.0.0 と新規 2.0.0 を別々に検証する。
export interface Watch {
  id: string; name: string; entityId: string; categoryId: string;
  beforeDatasetId: string; afterDatasetId: string; sourceProfileId: string; createdAt: string;
}
export type WatchInput = Omit<Watch, 'id' | 'createdAt'>;
export type DataMode = 'fictional' | 'approved_public';
export interface Dataset { id: string; dataAsOf: string; coverage: string; sourceFamily: string; recordCount: number; dataMode?: DataMode }
export interface Bootstrap {
  schemaVersion: '1.0.0' | '2.0.0'; dataMode: 'fictional' | 'public_design' | 'approved_public'; csrfToken: string;
  catalog: { entities: { id: string; name: string | null }[]; categories: { id: string; label: string }[]; datasets: Dataset[]; sourceProfiles: { id: string; label: string; dataMode?: DataMode }[] };
  watches: Watch[];
}
export interface Signal {
  status: 'change_detected' | 'no_change' | 'insufficient' | 'comparison_unavailable';
  counts: { before: number; after: number; newlyObserved: number; excludedBefore: number; excludedAfter: number; comparable: boolean };
  coverage: { before: string; after: string }; limitations: string[];
  designFacts: { id: string; text: string; recordIds: string[]; field: string }[];
  visualObservations: { id: string; part: string; observation: string; status: 'change_candidate' | 'no_change' | 'unknown'; mediaIds: string[] }[];
  officialFacts: { id: string; text: string; sourceId: string; quote: string; start: number; end: number }[];
  hypotheses: { id: string; text: string; evidenceIds: string[]; limitations: string[] }[];
  questionsForHuman: string[];
  media: { id: string; recordId: string; label: string; role: 'comparisonA' | 'comparisonB'; mimeType: 'image/png' | 'image/jpeg'; width: number; height: number; sourceLabel: string; permission: string; gazetteDate: string | null; applicationDate: string | null; view: string | null; comparisonStatus: string }[];
  sources: { id: string; url: string; title: string; publishedAt: string | null; retrievedAt: string; excerpt: string; excerptStart: number; contentHash: string; retrospective: boolean }[];
  toolEvents: { tool: string; candidateId: string | null; reason: string; outcome: string; startedAt: string; finishedAt: string }[];
  stopReason: string;
}
export interface RunV1 {
  schemaVersion: '1.0.0'; id: string; watchId: string;
  status: 'running' | 'complete' | 'failed' | 'partial' | 'interrupted'; createdAt: string; completedAt: string | null;
  input: { watch: Watch }; signal: Signal | null; errorCode: string | null;
  versions: { model: string; prompt: string; schema: string };
  usage: { modelRequests: number; toolCalls: number; inputTokens: number; outputTokens: number };
}
export interface RunContext {
  dataMode: DataMode;
  entity: { id: string; name: string | null };
  category: { id: string; scheme: string | null; label: string };
  beforeDataset: { id: string; dataAsOf: string; coverage: string };
  afterDataset: { id: string; dataAsOf: string; coverage: string };
  knownProducts: { name: string | null; model: string | null; recordIds: string[]; evidence: string }[];
}
export interface SignalV2 extends Omit<Signal, 'sources'> {
  recordFacts: { id: string; recordId: string; selectionReason: 'comparison_pair' | 'newly_observed' | 'scope_sample'; articleName: string | null; registrationNumber: string | null; applicationNumber: string | null; applicant: { entityId: string; name: string | null }; classifications: { scheme: string; code: string; label: string | null }[]; applicationDate: string | null; gazetteDate: string | null; description: string | null; articleDescription: string | null; quality: 'pass' | 'warning' | 'quarantined'; sourceFields: string[] }[];
  discovery: { state: 'not_started' | 'completed'; scannedLinks: number; eligibleCandidates: number; omittedCandidates: number; limitations: string[]; candidates: { id: string; url: string; title: string; publishedAt: string | null; dateStatus: 'in_period' | 'outside_period' | 'unknown'; selectionReason: string }[] };
  relationships: { id: string; relation: 'direct' | 'category' | 'candidate' | 'unrelated_or_conflicting' | 'unknown'; summary: string; supportingEvidenceIds: string[]; opposingEvidenceIds: string[]; missingEvidence: string[] }[];
  sources: (Signal['sources'][number] & { updatedAt: string | null; releaseAt: string | null; extractionVersion: string; bodyHash: string; extractedChars: number; modelVisibleChars: number; truncated: boolean })[];
}
export interface RunV2 extends Omit<RunV1, 'schemaVersion' | 'input' | 'signal'> {
  schemaVersion: '2.0.0'; input: { watch: Watch; context: RunContext }; signal: SignalV2 | null;
}
export type Run = RunV1 | RunV2;

type Check = (value: unknown) => void;
export class ContractError extends Error { constructor() { super('保存データの形式または根拠の参照を確認できません。表示を停止しました。'); } }
const fail = (): never => { throw new ContractError(); };
const boundedText = (max: number, min = 1): Check => (v) => { if (typeof v !== 'string' || Array.from(v).length < min || Array.from(v).length > max || (min > 0 && !v.trim())) fail(); };
const text = boundedText(1500);
const identifier = boundedText(160);
const opaqueId: Check = (v) => { text(v); if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v as string)) fail(); };
const catalogId: Check = (v) => { boundedText(128)(v); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v as string)) fail(); };
const integer: Check = (v) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) fail(); };
const positive: Check = (v) => { integer(v); if (v === 0 || (v as number) > 20000) fail(); };
const boolean: Check = (v) => { if (typeof v !== 'boolean') fail(); };
const date: Check = (v) => { text(v); if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(v as string) || !Number.isFinite(Date.parse(v as string))) fail(); };
const nullable = (check: Check): Check => (v) => { if (v !== null) check(v); };
const oneOf = (...values: unknown[]): Check => (v) => { if (!values.includes(v)) fail(); };
const array = (check: Check, max = 10000): Check => (v) => { if (!Array.isArray(v) || v.length > max) fail(); (v as unknown[]).forEach(check); };
const object = (shape: Record<string, Check>): Check => (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail();
  const record = v as Record<string, unknown>;
  if (Object.keys(record).length !== Object.keys(shape).length || Object.keys(record).some((key) => !(key in shape))) fail();
  for (const [key, check] of Object.entries(shape)) check(record[key]);
};
const ids = array(identifier, 20);
const strings = array(text, 20);
const watchCheck = object({ id: opaqueId, name: boundedText(120), entityId: catalogId, categoryId: catalogId, beforeDatasetId: opaqueId, afterDatasetId: opaqueId, sourceProfileId: opaqueId, createdAt: date });
const sourceUrl: Check = (v) => {
  boundedText(2048)(v);
  try {
    const url = new URL(v as string);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.search || !host.includes('.') || /^(?:\d+\.){3}\d+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|internal)$/.test(host) || /(?:^|\.)(?:storage|bucket|objects)(?:\.|$)/.test(host)) fail();
  } catch { fail(); }
};
const signalShape = {
  status: oneOf('change_detected', 'no_change', 'insufficient', 'comparison_unavailable'),
  counts: object({ before: integer, after: integer, newlyObserved: integer, excludedBefore: integer, excludedAfter: integer, comparable: boolean }),
  coverage: object({ before: text, after: text }), limitations: strings,
  designFacts: array(object({ id: identifier, text, recordIds: array(identifier, 10), field: text }), 10),
  visualObservations: array(object({ id: identifier, part: text, observation: text, status: oneOf('change_candidate', 'no_change', 'unknown'), mediaIds: array(identifier, 2) }), 10),
  officialFacts: array(object({ id: identifier, text, sourceId: identifier, quote: boundedText(1000), start: integer, end: integer }), 10),
  hypotheses: array(object({ id: identifier, text, evidenceIds: ids, limitations: strings }), 10), questionsForHuman: strings,
  media: array(object({ id: identifier, recordId: identifier, label: text, role: oneOf('comparisonA', 'comparisonB'), mimeType: oneOf('image/png', 'image/jpeg'), width: positive, height: positive, sourceLabel: text, permission: text, gazetteDate: nullable(date), applicationDate: nullable(date), view: nullable(text), comparisonStatus: text }), 2),
  sources: array(object({ id: identifier, url: sourceUrl, title: boundedText(300, 0), publishedAt: nullable(date), retrievedAt: date, excerpt: boundedText(20000, 0), excerptStart: integer, contentHash: boundedText(64, 64), retrospective: boolean }), 3),
  toolEvents: array(object({ tool: oneOf('list_candidates', 'fetch_candidate', 'finish'), candidateId: nullable(identifier), reason: text, outcome: text, startedAt: date, finishedAt: date }), 6), stopReason: text,
};
const signalCheck = object(signalShape);
const sourceV2Check = object({ id: identifier, url: sourceUrl, title: boundedText(300, 0), publishedAt: nullable(date), retrievedAt: date, excerpt: boundedText(20000, 0), excerptStart: integer, contentHash: boundedText(64, 64), retrospective: boolean, updatedAt: nullable(date), releaseAt: nullable(date), extractionVersion: text, bodyHash: boundedText(64, 64), extractedChars: integer, modelVisibleChars: integer, truncated: boolean });
const signalV2Check = object({ ...signalShape,
  sources: array(sourceV2Check, 3),
  recordFacts: array(object({ id: identifier, recordId: identifier, selectionReason: oneOf('comparison_pair', 'newly_observed', 'scope_sample'), articleName: nullable(text), registrationNumber: nullable(text), applicationNumber: nullable(text), applicant: object({ entityId: identifier, name: nullable(text) }), classifications: array(object({ scheme: text, code: text, label: nullable(boundedText(1500, 0)) }), 20), applicationDate: nullable(date), gazetteDate: nullable(date), description: nullable(boundedText(800, 0)), articleDescription: nullable(boundedText(800, 0)), quality: oneOf('pass', 'warning', 'quarantined'), sourceFields: strings }), 10),
  discovery: object({ state: oneOf('not_started', 'completed'), scannedLinks: integer, eligibleCandidates: integer, omittedCandidates: integer, limitations: strings, candidates: array(object({ id: identifier, url: sourceUrl, title: boundedText(300, 0), publishedAt: nullable(date), dateStatus: oneOf('in_period', 'outside_period', 'unknown'), selectionReason: text }), 20) }),
  relationships: array(object({ id: identifier, relation: oneOf('direct', 'category', 'candidate', 'unrelated_or_conflicting', 'unknown'), summary: text, supportingEvidenceIds: ids, opposingEvidenceIds: ids, missingEvidence: strings }), 10),
});
const dataMode = oneOf('fictional', 'approved_public');
const calendarDate: Check = (value) => { date(value); boundedText(10, 10)(value); };
const contextDatasetCheck = object({ id: opaqueId, dataAsOf: calendarDate, coverage: boundedText(240) });
const contextCheck = object({ dataMode, entity: object({ id: catalogId, name: nullable(boundedText(1000)) }), category: object({ id: catalogId, scheme: nullable(boundedText(1000)), label: boundedText(1000) }), beforeDataset: contextDatasetCheck, afterDataset: contextDatasetCheck, knownProducts: array(object({ name: nullable(boundedText(120)), model: nullable(boundedText(120)), recordIds: array(catalogId, 10), evidence: boundedText(500) }), 20) });
const runShape = { id: opaqueId, watchId: opaqueId, status: oneOf('running', 'complete', 'failed', 'partial', 'interrupted'), createdAt: date, completedAt: nullable(date), errorCode: nullable(text), usage: object({ modelRequests: integer, toolCalls: integer, inputTokens: integer, outputTokens: integer }) };
const versionCheck = (version: string) => object({ model: boundedText(1000), prompt: boundedText(1000), schema: oneOf(version) });
const runV1Check = object({ ...runShape, schemaVersion: oneOf('1.0.0'), input: object({ watch: watchCheck }), signal: nullable(signalCheck), versions: versionCheck('1.0.0') });
const runV2Check = object({ ...runShape, schemaVersion: oneOf('2.0.0'), input: object({ watch: watchCheck, context: contextCheck }), signal: nullable(signalV2Check), versions: versionCheck('2.0.0') });
const isV2 = (value: unknown): boolean => typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion === '2.0.0';
const runCheck: Check = (value) => { (isV2(value) ? runV2Check : runV1Check)(value); };
function unique(values: string[]): void { if (new Set(values).size !== values.length) fail(); }
function validateContext(run: RunV2): void {
  const { watch, context } = run.input;
  if (context.entity.id !== watch.entityId || context.category.id !== watch.categoryId || context.beforeDataset.id !== watch.beforeDatasetId || context.afterDataset.id !== watch.afterDatasetId) fail();
  if (!run.signal) return;
  const signal = run.signal;
  if (signal.coverage.before !== context.beforeDataset.coverage || signal.coverage.after !== context.afterDataset.coverage) fail();
  const evidence = [...signal.designFacts, ...signal.visualObservations, ...signal.officialFacts];
  unique([...evidence, ...signal.media, ...signal.sources, ...signal.hypotheses].map((item) => item.id));
  unique(signal.relationships.map((item) => item.id));
  const evidenceIds = new Set(evidence.map((item) => item.id));
  unique(signal.recordFacts.map((item) => item.recordId));
  unique(signal.recordFacts.map((item) => item.id));
  for (const fact of signal.recordFacts) if (fact.applicant.entityId !== context.entity.id || !signal.designFacts.some((item) => item.id === fact.id && item.recordIds.includes(fact.recordId))) fail();
  for (const item of signal.relationships) {
    unique(item.supportingEvidenceIds); unique(item.opposingEvidenceIds);
    if ([...item.supportingEvidenceIds, ...item.opposingEvidenceIds].some((id) => !evidenceIds.has(id))) fail();
    if (item.supportingEvidenceIds.some((id) => item.opposingEvidenceIds.includes(id))) fail();
    if (item.relation === 'direct' && !item.supportingEvidenceIds.length) fail();
  }
  unique(signal.discovery.candidates.map((item) => item.id));
  for (const source of signal.sources) {
    if (!/^[a-f0-9]{64}$/.test(source.bodyHash) || !/^[a-f0-9]{64}$/.test(source.contentHash) || source.excerptStart !== 0 || source.modelVisibleChars > Array.from(source.excerpt).length || Array.from(source.excerpt).length > source.extractedChars || source.truncated !== (source.modelVisibleChars < source.extractedChars)) fail();
  }
  for (const fact of signal.officialFacts) {
    const source = signal.sources.find((item) => item.id === fact.sourceId);
    if (!source || fact.end > source.modelVisibleChars) fail();
  }
}
export function decodeWatch(value: unknown): Watch { watchCheck(value); return value as Watch; }
export function decodeRun(value: unknown): Run {
  runCheck(value);
  const run = value as Run;
  if (run.watchId !== run.input.watch.id || (run.status === 'complete' && (!run.signal || !run.completedAt)) || (run.status === 'running' && run.completedAt !== null)) fail();
  if (run.schemaVersion === '2.0.0') validateContext(run);
  const signal = run.signal;
  if (signal) {
    const groups = [signal.designFacts, signal.visualObservations, signal.officialFacts, signal.hypotheses, signal.media, signal.sources];
    unique(groups.flatMap((group) => group.map((item) => item.id)));
    const mediaIds = new Set(signal.media.map((item) => item.id));
    const factIds = new Set([...signal.designFacts, ...signal.visualObservations, ...signal.officialFacts].map((item) => item.id));
    if (signal.counts.newlyObserved > signal.counts.after) fail();
    for (const observation of signal.visualObservations) if (observation.mediaIds.length !== 2 || new Set(observation.mediaIds).size !== mediaIds.size || observation.mediaIds.some((id) => !mediaIds.has(id))) fail();
    for (const fact of signal.officialFacts) {
      const source = signal.sources.find((item) => item.id === fact.sourceId);
      if (!source || fact.end <= fact.start || fact.start < source.excerptStart || Array.from(source.excerpt).slice(fact.start - source.excerptStart, fact.end - source.excerptStart).join('') !== fact.quote) fail();
    }
    for (const hypothesis of signal.hypotheses) if (!hypothesis.evidenceIds.length || hypothesis.evidenceIds.some((id) => !factIds.has(id))) fail();
    for (const fact of signal.designFacts) if (!fact.recordIds.length) fail();
    const hasChange = signal.counts.newlyObserved > 0 || signal.visualObservations.some((item) => item.status === 'change_candidate');
    if ((signal.status === 'no_change' && hasChange) || (signal.status === 'change_detected' && !hasChange) || (!signal.counts.comparable && signal.status !== 'comparison_unavailable')) fail();
  }
  return run;
}
export function decodeRuns(value: unknown): Run[] {
  object({ schemaVersion: oneOf('1.0.0', '2.0.0'), runs: array(runCheck) })(value);
  const runs = (value as { runs: unknown[] }).runs.map(decodeRun);
  unique(runs.map((run) => run.id));
  return runs;
}
export function decodeBootstrap(value: unknown): Bootstrap {
  const v2 = isV2(value);
  object({ schemaVersion: oneOf(v2 ? '2.0.0' : '1.0.0'), dataMode: v2 ? dataMode : oneOf('fictional', 'public_design'), csrfToken: text,
    catalog: object({ entities: array(object({ id: catalogId, name: v2 ? nullable(text) : text })), categories: array(object({ id: catalogId, label: text })), datasets: array(object({ id: opaqueId, dataAsOf: date, coverage: text, sourceFamily: text, recordCount: integer, ...(v2 ? { dataMode } : {}) })), sourceProfiles: array(object({ id: opaqueId, label: text, ...(v2 ? { dataMode } : {}) })) }), watches: array(watchCheck) })(value);
  const bootstrap = value as Bootstrap;
  const { entities, categories, datasets, sourceProfiles } = bootstrap.catalog;
  for (const group of [entities, categories, datasets, sourceProfiles, bootstrap.watches]) unique(group.map((item) => item.id));
  for (const watch of bootstrap.watches) {
    if (!entities.some((item) => item.id === watch.entityId) || !categories.some((item) => item.id === watch.categoryId) || !datasets.some((item) => item.id === watch.beforeDatasetId) || !datasets.some((item) => item.id === watch.afterDatasetId) || !sourceProfiles.some((item) => item.id === watch.sourceProfileId)) fail();
  }
  return bootstrap;
}
