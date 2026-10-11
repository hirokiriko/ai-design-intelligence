import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalApiError } from './api';
import { analysisQuestion, type AnalysisQuestion, type AnalysisQuestionId } from './analysis-question';
import { decodeBootstrap, decodeRun, type Run, type Watch } from './contract';
import { createDevelopmentApi, DEVELOPMENT_STORAGE_KEY, type DevelopmentApi, type DevelopmentStorage } from './development-api';

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  const storage: DevelopmentStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
  return { values, storage };
}
async function caseInput(api: DevelopmentApi, index = 0) {
  const bootstrap = await api.bootstrap();
  const watch = bootstrap.watches[index];
  const pairs = await api.comparisonPairs(watch);
  return { bootstrap, watch, pair: pairs.comparisonPairs[0] };
}
async function startCase(api: DevelopmentApi, requestId: string, index = 0, intent: 'check' | 'reanalyze' = 'check') {
  const { bootstrap, watch, pair } = await caseInput(api, index);
  return api.start(watch.id, intent, requestId, bootstrap.csrfToken, pair.id);
}
function persisted(storage: DevelopmentStorage): { epoch: string; watches: Watch[]; runs: Run[]; requests: { watchId: string; requestId: string; runId: string }[] } {
  return JSON.parse(storage.getItem(DEVELOPMENT_STORAGE_KEY)!) as ReturnType<typeof persisted>;
}
function identifierValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(identifierValues);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, entry]: [string, unknown]) => {
    const own = key === 'id' || key.endsWith('Id') ? (typeof entry === 'string' ? [entry] : []) : key.endsWith('Ids') && Array.isArray(entry) ? entry.filter((id): id is string => typeof id === 'string') : [];
    return [...own, ...identifierValues(entry)];
  });
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network is permitted in fictional development'); })); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('fictional question-scoped local development API', () => {
  it.each(['drawings', 'support', 'next'] as const)('saves the immutable %s question with a fixed fictional answer and zero AI usage', async (id: AnalysisQuestionId) => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api);
    const run = await api.start(watch.id, 'check', `kds_fixture_question_${id}`, bootstrap.csrfToken, pair.id, analysisQuestion(id));
    expect(decodeRun(run)).toEqual(run);
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Expected a fictional question result');
    expect(run.input.analysisQuestion).toEqual(analysisQuestion(id));
    expect(run.versions).toEqual({ model: 'fictional-development-replay', prompt: 'kds_fixture_local_question_v1', schema: '2.5.0' });
    expect(Object.values(run.usage)).toEqual([0, 0, 0, 0]);
    expect(run.signal.questionAnswer.questionId).toBe(id);
    expect(run.signal.questionAnswer.status).toBe(id === 'support' ? 'insufficient' : 'answered');
    expect(run.signal.questionAnswer.text).not.toBeNull();
    const savedIds = [...run.signal.designFacts, ...run.signal.visualObservations, ...run.signal.officialFacts].map((entry) => entry.id);
    expect(run.signal.questionAnswer.evidenceIds.length).toBeGreaterThan(0);
    expect(run.signal.questionAnswer.evidenceIds.every((entry) => savedIds.includes(entry))).toBe(true);
    const reloaded = createDevelopmentApi({ storage, delayMs: 0 });
    expect(await reloaded.run(run.id)).toEqual(run);
    expect(await reloaded.requestRun(watch.id, `kds_fixture_question_${id}`)).toEqual(run);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reuses only the same watch, pair, and question while preserving questionless history', async () => {
    const { storage } = memoryStorage(); const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api);
    const legacy = await api.start(watch.id, 'check', 'kds_fixture_old', bootstrap.csrfToken, pair.id);
    const drawings = await api.start(watch.id, 'check', 'kds_fixture_drawings', bootstrap.csrfToken, pair.id, analysisQuestion('drawings'));
    const support = await api.start(watch.id, 'check', 'kds_fixture_support', bootstrap.csrfToken, pair.id, analysisQuestion('support'));
    const drawingsAgain = await api.start(watch.id, 'check', 'kds_fixture_drawings_again', bootstrap.csrfToken, pair.id, analysisQuestion('drawings'));
    const legacyAgain = await api.start(watch.id, 'check', 'kds_fixture_old_again', bootstrap.csrfToken, pair.id);
    expect(legacy.schemaVersion).toBe('2.2.0'); expect(drawings.schemaVersion).toBe('2.5.0');
    expect(new Set([legacy.id, drawings.id, support.id]).size).toBe(3);
    expect(drawingsAgain).toEqual(drawings); expect(legacyAgain).toEqual(legacy);
    const reloaded = createDevelopmentApi({ storage, delayMs: 0 });
    expect((await reloaded.runs(watch.id)).map((run) => run.id)).toEqual([support.id, drawings.id, legacy.id]);
    expect(persisted(storage).runs).toHaveLength(3); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects a changed question for the same request ID without adding or replacing a result', async () => {
    const { storage } = memoryStorage(); const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api);
    const run = await api.start(watch.id, 'check', 'kds_fixture_same_request', bootstrap.csrfToken, pair.id, analysisQuestion('drawings'));
    const saved = storage.getItem(DEVELOPMENT_STORAGE_KEY);
    await expect(api.start(watch.id, 'check', 'kds_fixture_same_request', bootstrap.csrfToken, pair.id, analysisQuestion('support'))).rejects.toMatchObject({ code: '409', requestNotSent: true });
    await expect(api.start(watch.id, 'check', 'kds_fixture_same_request', bootstrap.csrfToken, pair.id)).rejects.toMatchObject({ code: '409' });
    expect(storage.getItem(DEVELOPMENT_STORAGE_KEY)).toBe(saved); expect(await api.requestRun(watch.id, 'kds_fixture_same_request')).toEqual(run);
  });
  it('snapshots a question before a delayed start and does not expose mutable saved input', async () => {
    vi.useFakeTimers(); const { storage } = memoryStorage(); const api = createDevelopmentApi({ storage, delayMs: 300 });
    const { bootstrap, watch, pair } = await caseInput(api); const question = analysisQuestion('drawings');
    const promise = api.start(watch.id, 'check', 'kds_fixture_mutation', bootstrap.csrfToken, pair.id, question);
    question.text = 'kds_fixture_caller_change'; await vi.runAllTimersAsync(); const run = await promise;
    if (run.schemaVersion !== '2.5.0') throw new Error('Expected a question result');
    expect(run.input.analysisQuestion).toEqual(analysisQuestion('drawings'));
    run.input.analysisQuestion.text = 'kds_fixture_result_change';
    const restored = await api.run(run.id);
    if (restored.schemaVersion !== '2.5.0') throw new Error('Expected a question result');
    expect(restored.input.analysisQuestion).toEqual(analysisQuestion('drawings'));
  });
  it('rejects a noncanonical caller question before any local storage access', async () => {
    const { storage } = memoryStorage(); const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api); vi.mocked(storage.getItem).mockClear();
    const invalid = { ...analysisQuestion('drawings'), text: 'kds_fixture_changed' } as AnalysisQuestion;
    await expect(api.start(watch.id, 'check', 'kds_fixture_invalid', bootstrap.csrfToken, pair.id, invalid)).rejects.toMatchObject({ code: 'invalid-question', requestNotSent: true });
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps opposing fixture evidence separate from supporting evidence', async () => {
    const { storage } = memoryStorage(); const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api, 1);
    const run = await api.start(watch.id, 'check', 'kds_fixture_opposing', bootstrap.csrfToken, pair.id, analysisQuestion('support'));
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Expected a question result');
    expect(run.signal.questionAnswer.supportingEvidenceIds).toEqual([]);
    expect(run.signal.questionAnswer.opposingEvidenceIds).toEqual([run.signal.officialFacts[0].id]);
    expect(run.signal.questionAnswer.status).toBe('insufficient'); expect(fetch).not.toHaveBeenCalled();
  });
  it('fails closed if a stored question or its fixed answer is relabeled', async () => {
    const { storage } = memoryStorage(); const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api);
    await api.start(watch.id, 'check', 'kds_fixture_tampered', bootstrap.csrfToken, pair.id, analysisQuestion('drawings'));
    const state = persisted(storage); const run = state.runs[0];
    if (run.schemaVersion !== '2.5.0' || !run.signal) throw new Error('Expected a question result');
    run.input.analysisQuestion = analysisQuestion('support');
    run.signal.questionAnswer.questionId = 'support';
    const raw = JSON.stringify(state); storage.setItem(DEVELOPMENT_STORAGE_KEY, raw);
    await expect(api.runs(watch.id)).rejects.toMatchObject({ code: 'development-storage' });
    expect(storage.getItem(DEVELOPMENT_STORAGE_KEY)).toBe(raw); expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fictional local development API', () => {
  it('loads two coherent decoder-validated cases with no saved results or implicit execution', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const bootstrap = await api.bootstrap();
    expect(decodeBootstrap(bootstrap)).toEqual(bootstrap);
    expect(bootstrap.schemaVersion).toBe('2.5.0');
    expect(bootstrap.analysisMode).toBe('standard');
    expect(bootstrap.analysisQuestionVersion).toBe('1.0.0');
    expect(bootstrap.dataMode).toBe('fictional');
    expect(bootstrap.watches).toHaveLength(2);
    for (const watch of bootstrap.watches) {
      const pairs = await api.comparisonPairs(watch);
      expect(pairs.schemaVersion).toBe('2.3.0');
      expect(pairs.comparisonPairs).toHaveLength(1);
      expect(pairs.comparisonPairs[0].media.map((media) => media.role)).toEqual(['comparisonA', 'comparisonB']);
      expect(await api.runs(watch.id)).toEqual([]);
    }
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('explicitly starts a fixture with exact cross-references, fake metadata, zero AI usage, and unknown announcement date', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const run = await startCase(api, 'first-explicit-request');
    expect(decodeRun(run)).toEqual(run);
    expect(run.versions).toEqual({ model: 'fictional-development-replay', prompt: 'kds_fixture_local_display_v1', schema: '2.2.0' });
    expect(Object.values(run.usage)).toEqual([0, 0, 0, 0]);
    expect(run.signal?.toolEvents).toEqual([]);
    expect(run.signal?.sources[0].publishedAt).toBeNull();
    if (run.schemaVersion === '1.0.0') throw new Error('Expected v2 result');
    expect(run.signal?.sources[0].updatedAt).toBe('2026-09-20');
    expect(run.signal?.sources[0].releaseAt).toBeNull();
    const fact = run.signal!.officialFacts[0];
    const source = run.signal!.sources.find((entry) => entry.id === fact.sourceId)!;
    expect(Array.from(source.excerpt).slice(fact.start, fact.end).join('')).toBe(fact.quote);
    expect(run.signal!.visualObservations[0].mediaIds).toEqual(run.signal!.media.map((media) => media.id));
    for (const id of identifierValues({ run, state: persisted(storage) })) expect(id).toMatch(/^(?:FIXTURE-|kds_fixture_)/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('restores local history after a new adapter and retains all earlier results when reanalyzing', async () => {
    const { storage } = memoryStorage();
    const firstApi = createDevelopmentApi({ storage, delayMs: 0 });
    const first = await startCase(firstApi, 'start-one');
    const second = await startCase(firstApi, 'start-two', 0, 'reanalyze');
    expect(second.id).not.toBe(first.id);
    const reloaded = createDevelopmentApi({ storage, delayMs: 0 });
    expect((await reloaded.runs(first.watchId)).map((run) => run.id)).toEqual([second.id, first.id]);
    expect(await reloaded.run(first.id)).toEqual(first);
    expect(await reloaded.run(second.id)).toEqual(second);
    expect(await reloaded.requestRun(first.watchId, 'start-one')).toEqual(first);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reuses the saved result for the same watch and pair on check, with a recoverable new request association', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const first = await startCase(api, 'first-request');
    const repeated = await startCase(api, 'second-request');
    expect(repeated).toEqual(first);
    expect(await api.requestRun(first.watchId, 'second-request')).toEqual(first);
    expect(persisted(storage).runs).toHaveLength(1);
    expect(persisted(storage).requests).toHaveLength(2);
  });

  it('returns the same run for repeated request IDs even if reanalyze is clicked twice', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const first = await startCase(api, 'duplicate-request', 0, 'reanalyze');
    const again = await startCase(api, 'duplicate-request', 0, 'reanalyze');
    expect(again).toEqual(first);
    expect(persisted(storage).runs).toHaveLength(1);
    expect(persisted(storage).requests).toHaveLength(1);
  });

  it('keeps cases separate and exposes unrelated quote as opposition only in the second case', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const first = await startCase(api, 'case-one-request');
    const second = await startCase(api, 'case-two-request', 1);
    expect(first.watchId).not.toBe(second.watchId);
    expect(await api.runs(first.watchId)).toEqual([first]);
    expect(await api.runs(second.watchId)).toEqual([second]);
    if (second.schemaVersion === '1.0.0' || first.schemaVersion === '1.0.0') throw new Error('Expected v2 result');
    expect(first.signal!.relationships[0].supportingEvidenceIds).toHaveLength(2);
    expect(second.signal!.relationships[0].relation).toBe('unrelated_or_conflicting');
    expect(second.signal!.relationships[0].supportingEvidenceIds).toEqual([]);
    expect(second.signal!.relationships[0].opposingEvidenceIds).toEqual([second.signal!.officialFacts[0].id]);
    expect(second.signal!.officialFacts[0].quote).toContain('本社を移転');
    expect(second.signal!.questionsForHuman.join(' ')).toContain('形状と製品');
  });

  it('saves an additional fictional watch, reloads it, and runs the matching template for that watch', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api);
    const input = { name: watch.name, entityId: watch.entityId, categoryId: watch.categoryId, beforeDatasetId: watch.beforeDatasetId, afterDatasetId: watch.afterDatasetId, sourceProfileId: watch.sourceProfileId };
    const saved = await api.saveWatch({ ...input, name: '架空の追加確認条件' }, bootstrap.csrfToken);
    expect(saved.id).toMatch(/^kds_fixture_watch_/);
    const reloaded = createDevelopmentApi({ storage, delayMs: 0 });
    expect((await reloaded.bootstrap()).watches).toContainEqual(saved);
    const run = await reloaded.start(saved.id, 'check', 'additional-watch-request', bootstrap.csrfToken, pair.id);
    expect(run.watchId).toBe(saved.id);
    expect(run.input.watch).toEqual(saved);
    expect(decodeRun(run)).toEqual(run);
  });

  it('does not return mutable references to templates, history, or saved conditions', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const before = await api.bootstrap();
    before.watches[0].name = 'mutated'; before.catalog.entities[0].name = 'mutated';
    expect((await api.bootstrap()).watches[0].name).not.toBe('mutated');
    const original = await startCase(api, 'immutable-result');
    const returned = await api.run(original.id);
    returned.input.watch.name = 'mutated'; returned.signal!.hypotheses[0].text = 'mutated';
    expect(await api.run(original.id)).toEqual(original);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects missing/wrong pair, unknown watches/runs/requests, mismatched catalog scope, and invalid requests without saving', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const { bootstrap, watch, pair } = await caseInput(api);
    await expect(api.start(watch.id, 'check', 'no-pair', bootstrap.csrfToken)).rejects.toMatchObject({ code: '400', requestNotSent: true });
    await expect(api.start(watch.id, 'check', 'wrong-pair', bootstrap.csrfToken, 'FIXTURE-WRONG-PAIR')).rejects.toMatchObject({ code: '400' });
    await expect(api.start('watch-real-unknown', 'check', 'unknown-watch', bootstrap.csrfToken, pair.id)).rejects.toMatchObject({ code: '404' });
    await expect(api.run('run-real-unknown')).rejects.toMatchObject({ code: '404' });
    await expect(api.requestRun(watch.id, 'missing-request')).rejects.toMatchObject({ code: '404' });
    await expect(api.start(watch.id, 'check', 'invalid request', bootstrap.csrfToken, pair.id)).rejects.toMatchObject({ code: '400' });
    const input = { name: watch.name, entityId: watch.entityId, categoryId: watch.categoryId, beforeDatasetId: watch.beforeDatasetId, afterDatasetId: watch.afterDatasetId, sourceProfileId: watch.sourceProfileId };
    await expect(api.saveWatch({ ...input, categoryId: bootstrap.watches[1].categoryId }, bootstrap.csrfToken)).rejects.toMatchObject({ code: '400' });
    await expect(api.start(watch.id, 'check', 'bad-token', 'real-csrf-token', pair.id)).rejects.toMatchObject({ code: '403' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each(['{ broken', '{"version":1,"watches":[],"runs":[],"requests":[]}', '{"version":1,"watches":[],"runs":[],"requests":[],"extra":true}'])('fails explicitly on corrupt local storage without replacing it or contacting the API: %s', async (raw) => {
    const { values, storage } = memoryStorage({ [DEVELOPMENT_STORAGE_KEY]: raw });
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await expect(api.bootstrap()).rejects.toMatchObject({ code: 'development-storage', requestNotSent: true });
    expect(values.get(DEVELOPMENT_STORAGE_KEY)).toBe(raw);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects stored identifiers or result text changed away from its own fixed fictional templates', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await startCase(api, 'validated-fixture');
    const state = persisted(storage);
    state.runs[0].signal!.hypotheses[0].text = 'Any text presented as a real result';
    const raw = JSON.stringify(state); storage.setItem(DEVELOPMENT_STORAGE_KEY, raw);
    await expect(api.bootstrap()).rejects.toMatchObject({ code: 'development-storage' });
    expect(storage.getItem(DEVELOPMENT_STORAGE_KEY)).toBe(raw);
    state.runs[0].id = 'run_real_old_saved';
    const identifiersRaw = JSON.stringify(state); storage.setItem(DEVELOPMENT_STORAGE_KEY, identifiersRaw);
    await expect(api.bootstrap()).rejects.toMatchObject({ code: 'development-storage' });
    expect(storage.getItem(DEVELOPMENT_STORAGE_KEY)).toBe(identifiersRaw);
  });

  it('rejects invalid quote provenance on reload rather than displaying a partial fixture', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await startCase(api, 'provenance-request');
    const state = persisted(storage);
    state.runs[0].signal!.officialFacts[0].end += 1;
    storage.setItem(DEVELOPMENT_STORAGE_KEY, JSON.stringify(state));
    await expect(api.run(state.runs[0].id)).rejects.toMatchObject({ code: 'development-storage' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never enumerates, reads, clears, or overwrites production pending/results keys', async () => {
    const productionPendingKey = 'kiriko-design-signals-pending-request';
    const productionOtherKey = 'kiriko-design-signals-pending-request:real-watch:real-request';
    const { values, storage } = memoryStorage({ [productionPendingKey]: 'real-private-pending', [productionOtherKey]: 'real-other-pending' });
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const run = await startCase(api, 'isolated-request');
    await api.run(run.id); await api.runs(run.watchId); await api.bootstrap();
    await api.resetLocalData();
    expect(values.get(productionPendingKey)).toBe('real-private-pending');
    expect(values.get(productionOtherKey)).toBe('real-other-pending');
    expect(storage.getItem).toHaveBeenCalled();
    for (const call of vi.mocked(storage.getItem).mock.calls) expect(call).toEqual([DEVELOPMENT_STORAGE_KEY]);
    for (const call of vi.mocked(storage.setItem).mock.calls) expect(call[0]).toBe(DEVELOPMENT_STORAGE_KEY);
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(await api.runs(run.watchId)).toEqual([]);
  });

  it('reports storage access/write denial explicitly and never falls back to memory or real API', async () => {
    const denied = createDevelopmentApi({ storage: { getItem: () => { throw new Error('denied'); }, setItem: vi.fn(), removeItem: vi.fn() }, delayMs: 0 });
    await expect(denied.bootstrap()).rejects.toBeInstanceOf(SignalApiError);
    const { storage } = memoryStorage();
    storage.setItem = vi.fn(() => { throw new Error('quota'); });
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await expect(startCase(api, 'quota-request')).rejects.toMatchObject({ code: 'development-storage', requestNotSent: true });
    expect(await api.runs((await api.bootstrap()).watches[0].id)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a lost storage update instead of reporting an unsaved result as saved', async () => {
    const { storage } = memoryStorage();
    storage.setItem = vi.fn();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await expect(startCase(api, 'lost-update')).rejects.toMatchObject({ code: 'development-storage' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps overlapping adapter starts idempotent for the same request without an async overwrite gap', async () => {
    const { storage } = memoryStorage();
    const firstApi = createDevelopmentApi({ storage, delayMs: 1 });
    const secondApi = createDevelopmentApi({ storage, delayMs: 1 });
    const [first, second] = await Promise.all([startCase(firstApi, 'overlap-request', 0, 'reanalyze'), startCase(secondApi, 'overlap-request', 0, 'reanalyze')]);
    expect(second).toEqual(first);
    expect(persisted(storage).runs).toHaveLength(1);
    expect(persisted(storage).requests).toHaveLength(1);
  });

  it('reports a failed explicit reset and does not remove any other local data', async () => {
    const { values, storage } = memoryStorage({ [DEVELOPMENT_STORAGE_KEY]: 'corrupted', real: 'preserved' });
    storage.setItem = vi.fn();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await expect(api.resetLocalData()).rejects.toThrow('架空のローカル保存を確認できません');
    expect(values.get('real')).toBe('preserved');
    expect(values.get(DEVELOPMENT_STORAGE_KEY)).toBe('corrupted');
  });

  it('uses collision-free request associations for plain and already-prefixed input IDs', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    const plain = await startCase(api, 'request-name', 0, 'reanalyze');
    const prefixed = await startCase(api, 'kds_fixture_request_request-name', 0, 'reanalyze');
    expect(prefixed.id).not.toBe(plain.id);
    expect(await api.requestRun(plain.watchId, 'request-name')).toEqual(plain);
    expect(await api.requestRun(plain.watchId, 'kds_fixture_request_request-name')).toEqual(prefixed);
  });

  it('cancels a delayed explicit start when reset occurs and does not repopulate the reset storage', async () => {
    vi.useFakeTimers();
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 300 });
    const { watch, bootstrap, pair } = await caseInput(api);
    const pending = api.start(watch.id, 'check', 'reset-pending', bootstrap.csrfToken, pair.id);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'development-reset', requestNotSent: true });
    const reset = api.resetLocalData();
    await vi.runAllTimersAsync(); await rejected; await reset;
    expect(persisted(storage).runs).toEqual([]);
    expect(persisted(storage).epoch).toMatch(/^kds_fixture_epoch_/);
    expect(await api.runs(watch.id)).toEqual([]);
  });

  it('makes reset from a second adapter finish after an already-queued delayed start and leaves no saved result', async () => {
    vi.useFakeTimers();
    const { storage } = memoryStorage();
    const first = createDevelopmentApi({ storage, delayMs: 300 });
    const second = createDevelopmentApi({ storage, delayMs: 300 });
    const { watch, bootstrap, pair } = await caseInput(first);
    const start = first.start(watch.id, 'check', 'another-adapter-reset', bootstrap.csrfToken, pair.id);
    const reset = second.resetLocalData();
    await vi.runAllTimersAsync();
    await start; await reset;
    expect(persisted(storage).runs).toEqual([]);
    expect(await first.runs(watch.id)).toEqual([]);
    expect(await second.runs(watch.id)).toEqual([]);
  });

  it('keeps a relabeled result from entering another fictional case history', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await startCase(api, 'wrong-watch-request');
    const state = persisted(storage);
    state.runs[0].watchId = state.watches[1].id;
    state.runs[0].input.watch.id = state.watches[1].id;
    storage.setItem(DEVELOPMENT_STORAGE_KEY, JSON.stringify(state));
    await expect(api.runs(state.watches[1].id)).rejects.toMatchObject({ code: 'development-storage' });
  });

  it('serializes real browser local storage mutations with only a dedicated fictional Web Lock', async () => {
    const { storage } = memoryStorage();
    let preceding = Promise.resolve();
    const lock = vi.fn((_name: string, _options: { mode: string }, action: () => unknown) => {
      const operation = preceding.then(action);
      preceding = operation.then(() => {}, () => {});
      return operation;
    });
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('navigator', { locks: { request: lock } });
    const first = createDevelopmentApi({ delayMs: 1 });
    const second = createDevelopmentApi({ delayMs: 1 });
    const [left, right] = await Promise.all([startCase(first, 'browser-request', 0, 'reanalyze'), startCase(second, 'browser-request', 0, 'reanalyze')]);
    expect(right).toEqual(left);
    expect(persisted(storage).runs).toHaveLength(1);
    await first.resetLocalData();
    for (const [name, options] of lock.mock.calls) {
      expect(name).toBe('kds_fixture_signals_local_development_lock_v1');
      expect(options).toEqual({ mode: 'exclusive' });
    }
  });

  it('allows fictional viewing but rejects writes if browser Web Locks are unavailable', async () => {
    const { storage } = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('navigator', {});
    const api = createDevelopmentApi({ delayMs: 0 });
    expect((await api.bootstrap()).watches).toHaveLength(2);
    await expect(startCase(api, 'no-lock')).rejects.toMatchObject({ code: 'development-storage', requestNotSent: true });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('invalidates another adapter operation queued behind reset with a new own-key epoch', async () => {
    vi.useFakeTimers();
    const { storage } = memoryStorage();
    const first = createDevelopmentApi({ storage, delayMs: 300 });
    const second = createDevelopmentApi({ storage, delayMs: 300 });
    const { watch, bootstrap, pair } = await caseInput(first);
    const occupying = first.start(watch.id, 'check', 'occupying-start', bootstrap.csrfToken, pair.id);
    const reset = first.resetLocalData();
    const queued = second.start(watch.id, 'check', 'queued-before-reset-completes', bootstrap.csrfToken, pair.id);
    const occupyingRejected = expect(occupying).rejects.toMatchObject({ code: 'development-reset' });
    const queuedRejected = expect(queued).rejects.toMatchObject({ code: 'development-reset' });
    await vi.runAllTimersAsync();
    await occupyingRejected; await reset; await queuedRejected;
    expect(persisted(storage).runs).toEqual([]);
    expect(persisted(storage).epoch).toMatch(/^kds_fixture_epoch_/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a built-in fictional condition relabeled to the other case scope', async () => {
    const { storage } = memoryStorage();
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await startCase(api, 'built-in-scope-request');
    const state = persisted(storage);
    state.watches[0] = { ...state.watches[1], id: state.watches[0].id, name: state.watches[0].name };
    const raw = JSON.stringify(state); storage.setItem(DEVELOPMENT_STORAGE_KEY, raw);
    await expect(api.bootstrap()).rejects.toMatchObject({ code: 'development-storage' });
    expect(storage.getItem(DEVELOPMENT_STORAGE_KEY)).toBe(raw);
  });

  it('explicit reset recovers a corrupt own-key state without touching other data', async () => {
    const { values, storage } = memoryStorage({ [DEVELOPMENT_STORAGE_KEY]: 'corrupt', real: 'preserved' });
    const api = createDevelopmentApi({ storage, delayMs: 0 });
    await expect(api.bootstrap()).rejects.toMatchObject({ code: 'development-storage' });
    await api.resetLocalData();
    expect((await api.bootstrap()).watches).toHaveLength(2);
    expect((await api.runs((await api.bootstrap()).watches[0].id))).toEqual([]);
    expect(values.get('real')).toBe('preserved');
  });
});
