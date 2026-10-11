import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readPendingRunRequest, readPendingRunRequests, signalApi } from './api';
import { analysisQuestion, type AnalysisQuestion } from './analysis-question';
import { ContractError, type Bootstrap, type RunV22, type RunV25 } from './contract';
import { createDevelopmentApi, type DevelopmentStorage } from './development-api';
import { installPendingLocks } from './pending-locks.test-support';

const pendingKey = 'kiriko-design-signals-pending-request';
let values: Map<string, string>;
let lock: ReturnType<typeof installPendingLocks>;
let fixture: RunV25;
let otherQuestionFixture: RunV25;
let legacyFixture: RunV22;
let bootstrap: Bootstrap;
function scopedKey(requestId = 'kds_fixture_request') { return `${pendingKey}:${encodeURIComponent(fixture.watchId)}:${requestId}`; }
function snapshot(requestId = 'kds_fixture_request', question = analysisQuestion('drawings')) {
  return { watchId: fixture.watchId, requestId, analysisQuestion: question, comparisonPairId: fixture.input.comparisonPair!.id };
}
function start(question: AnalysisQuestion | null = analysisQuestion('drawings'), requestId = 'kds_fixture_request') {
  return signalApi.start(fixture.watchId, 'check', requestId, 'kds_fixture_csrf', fixture.input.comparisonPair!.id, question);
}
function localStore(): DevelopmentStorage {
  const entries = new Map<string, string>();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: (key) => { entries.delete(key); } };
}

beforeEach(async () => {
  lock = installPendingLocks();
  values = new Map();
  vi.stubGlobal('localStorage', {
    get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  });
  const development = createDevelopmentApi({ storage: localStore(), delayMs: 0 });
  bootstrap = await development.bootstrap();
  const watch = bootstrap.watches[0];
  const pair = (await development.comparisonPairs(watch)).comparisonPairs[0];
  fixture = await development.start(watch.id, 'check', 'kds_fixture_seed_question', bootstrap.csrfToken, pair.id, analysisQuestion('drawings')) as RunV25;
  otherQuestionFixture = await development.start(watch.id, 'check', 'kds_fixture_seed_support', bootstrap.csrfToken, pair.id, analysisQuestion('support')) as RunV25;
  legacyFixture = await development.start(watch.id, 'check', 'kds_fixture_seed_legacy', bootstrap.csrfToken, pair.id) as RunV22;
});
afterEach(() => vi.unstubAllGlobals());

describe('analysis-question capability negotiation', () => {
  it('requests the known question version with one read-only GET', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(bootstrap)); vi.stubGlobal('fetch', fetcher);
    expect((await signalApi.bootstrap()).analysisQuestionVersion).toBe('1.0.0');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/bootstrap?analysisQuestionVersion=1.0.0');
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
  });
  it('falls back once to legacy bootstrap only for the exact definite query rejection', async () => {
    const legacy = { ...bootstrap, schemaVersion: '2.4.0' as const }; delete legacy.analysisQuestionVersion;
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_REQUEST' } }, { status: 400 })).mockResolvedValueOnce(Response.json(legacy));
    vi.stubGlobal('fetch', fetcher);
    expect((await signalApi.bootstrap()).schemaVersion).toBe('2.4.0');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/v1/bootstrap?analysisQuestionVersion=1.0.0', '/api/v1/bootstrap']);
    expect(fetcher.mock.calls.every(([, options]) => options.method === undefined)).toBe(true);
  });
  it.each([
    ['authentication', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_REQUEST' } }, { status: 401 })],
    ['permission', () => new Response('', { status: 403 })],
    ['other code', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'OTHER' } }, { status: 400 })],
    ['other version', () => Response.json({ schemaVersion: '2.5.0', error: { code: 'INVALID_REQUEST' } }, { status: 400 })],
    ['extra keys', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_REQUEST', message: 'kds_fixture_private' } }, { status: 400 })],
    ['non JSON', () => new Response('INVALID_REQUEST', { status: 400 })],
    ['malformed JSON', () => new Response('{', { status: 400, headers: { 'Content-Type': 'application/json' } })],
    ['oversized body', () => new Response(' '.repeat(4097), { status: 400, headers: { 'Content-Type': 'application/json' } })],
    ['malformed success', () => Response.json({ schemaVersion: '2.5.0' })],
  ])('does not fall back for %s', async (_name, response) => {
    const fetcher = vi.fn().mockResolvedValue((response as () => Response)()); vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.bootstrap()).rejects.toThrow(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('does not retry a connection failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('kds_fixture_connection')); vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.bootstrap()).rejects.toMatchObject({ code: 'connection' }); expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe('question request identity and uncertain admission', () => {
  it('sends only the selected question ID/version, and clears only its matching terminal response', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture)); vi.stubGlobal('fetch', fetcher);
    expect(await start()).toEqual(fixture);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ intent: 'check', requestId: 'kds_fixture_request', comparisonPairId: fixture.input.comparisonPair!.id, analysisQuestionId: 'drawings', analysisQuestionVersion: '1.0.0' });
    expect(fetcher.mock.calls[0][1].body).not.toContain(analysisQuestion('drawings').text);
    expect(readPendingRunRequest()).toBeNull();
  });
  it.each([
    { ...analysisQuestion('drawings'), text: 'kds_fixture_changed_question' },
    { ...analysisQuestion('drawings'), version: '9.0.0' },
    { ...analysisQuestion('drawings'), extra: true },
    Object.assign(Object.create(analysisQuestion('drawings')), { a: 1, b: 2, c: 3 }),
  ])('rejects an invalid caller question before reserving a lock or sending anything', async (question) => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(start(question as AnalysisQuestion)).rejects.toMatchObject({ code: 'invalid-question', requestNotSent: true });
    expect(lock).not.toHaveBeenCalled(); expect(localStorage.setItem).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('snapshots the selected purpose before asynchronous work and retains it after a lost response', async () => {
    const question = analysisQuestion('drawings');
    const fetcher = vi.fn().mockRejectedValue(new TypeError('kds_fixture_lost_response')); vi.stubGlobal('fetch', fetcher);
    const pending = start(question); question.text = 'kds_fixture_caller_mutation';
    await expect(pending).rejects.toMatchObject({ code: 'connection' });
    expect(readPendingRunRequest()).toEqual(snapshot());
    expect(JSON.parse(values.get(scopedKey())!)).toEqual(snapshot());
    await expect(start(analysisQuestion('support'), 'kds_fixture_second_request')).rejects.toMatchObject({ code: 'pending', requestNotSent: true });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('preserves exact two-key storage and the legacy request body when no question is selected', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('kds_fixture_lost_response')); vi.stubGlobal('fetch', fetcher);
    await expect(start(null)).rejects.toMatchObject({ code: 'connection' });
    expect(readPendingRunRequest()).toEqual({ watchId: fixture.watchId, requestId: 'kds_fixture_request' });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ intent: 'check', requestId: 'kds_fixture_request', comparisonPairId: fixture.input.comparisonPair!.id });
  });
  it('keeps the legacy optional-pair success behavior', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(legacyFixture)));
    expect(await signalApi.start(fixture.watchId, 'check', 'kds_fixture_legacy_request', 'kds_fixture_csrf')).toEqual(legacyFixture);
    expect(readPendingRunRequest()).toBeNull();
  });
  it.each(['other question', 'other pair', 'other watch', 'missing question', 'noncanonical text', 'malformed answer'])('retains pending after a terminal POST containing %s', async (variant) => {
    const received = structuredClone(variant === 'other question' ? otherQuestionFixture : fixture);
    if (variant === 'other pair') received.input.comparisonPair!.id = 'FIXTURE-OTHER-PAIR';
    if (variant === 'other watch') { received.watchId = 'kds_fixture_other_watch'; received.input.watch.id = received.watchId; }
    if (variant === 'missing question') Reflect.deleteProperty(received.input, 'analysisQuestion');
    if (variant === 'noncanonical text') received.input.analysisQuestion.text = 'kds_fixture_changed_question';
    if (variant === 'malformed answer') received.signal!.questionAnswer.evidenceIds = ['FIXTURE-NOT-SAVED'];
    const fetcher = vi.fn().mockResolvedValue(Response.json(received)); vi.stubGlobal('fetch', fetcher);
    await expect(start()).rejects.toBeInstanceOf(ContractError);
    expect(readPendingRunRequest()).toEqual(snapshot()); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('restores the matching question snapshot with GET and never resends POST', async () => {
    const running = { ...structuredClone(fixture), status: 'running', completedAt: null, signal: null };
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('kds_fixture_lost_response')).mockResolvedValueOnce(Response.json(otherQuestionFixture)).mockResolvedValueOnce(Response.json(running)).mockResolvedValueOnce(Response.json(fixture));
    vi.stubGlobal('fetch', fetcher);
    await expect(start()).rejects.toMatchObject({ code: 'connection' });
    await expect(signalApi.requestRun(fixture.watchId, 'kds_fixture_request')).rejects.toBeInstanceOf(ContractError);
    expect(readPendingRunRequest()).toEqual(snapshot());
    expect((await signalApi.requestRun(fixture.watchId, 'kds_fixture_request')).status).toBe('running');
    expect(readPendingRunRequest()).toEqual(snapshot());
    expect(await signalApi.requestRun(fixture.watchId, 'kds_fixture_request')).toEqual(fixture);
    expect(readPendingRunRequest()).toBeNull();
    expect(fetcher.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
    expect(fetcher.mock.calls.slice(1).every(([, options]) => options.method === undefined)).toBe(true);
  });
  it.each([409, 500, 503])('retains a selected snapshot for ambiguous HTTP %s', async (status) => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status })); vi.stubGlobal('fetch', fetcher);
    await expect(start()).rejects.toMatchObject({ code: String(status) });
    expect(readPendingRunRequest()).toEqual(snapshot()); expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([[409, 'RUN_IN_PROGRESS'], [503, 'RUNS_DISABLED'], [400, 'INVALID_ANALYSIS_QUESTION'], [422, 'ANALYSIS_QUESTION_UNAVAILABLE']] as const)('clears the selected snapshot after definite pre-admission rejection %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ schemaVersion: '2.3.0', error: { code } }, { status })));
    await expect(start()).rejects.toMatchObject({ preAdmissionRejected: true }); expect(readPendingRunRequest()).toBeNull();
  });
  it.each([
    ['invalid question with 422', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_ANALYSIS_QUESTION' } }, { status: 422 })],
    ['unavailable question with 400', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'ANALYSIS_QUESTION_UNAVAILABLE' } }, { status: 400 })],
    ['question code with 403', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_ANALYSIS_QUESTION' } }, { status: 403 })],
    ['unknown 400 code', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_REQUEST' } }, { status: 400 })],
    ['unknown 422 code', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'OTHER' } }, { status: 422 })],
    ['extra error key', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_ANALYSIS_QUESTION', message: 'kds_fixture_private' } }, { status: 400 })],
    ['extra envelope key', () => Response.json({ schemaVersion: '2.3.0', error: { code: 'ANALYSIS_QUESTION_UNAVAILABLE' }, detail: 'kds_fixture_private' }, { status: 422 })],
    ['other envelope version', () => Response.json({ schemaVersion: '2.5.0', error: { code: 'INVALID_ANALYSIS_QUESTION' } }, { status: 400 })],
    ['non JSON', () => new Response('INVALID_ANALYSIS_QUESTION', { status: 400 })],
    ['malformed JSON', () => new Response('{', { status: 422, headers: { 'Content-Type': 'application/json' } })],
  ])('retains the selected snapshot for an unproven rejection: %s', async (_name, response) => {
    const fetcher = vi.fn().mockResolvedValue((response as () => Response)()); vi.stubGlobal('fetch', fetcher);
    await expect(start()).rejects.toMatchObject({ preAdmissionRejected: false });
    expect(readPendingRunRequest()).toEqual(snapshot()); expect(localStorage.removeItem).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('keeps legacy generic rejection handling without marking a questionless request as a question rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ schemaVersion: '2.3.0', error: { code: 'INVALID_ANALYSIS_QUESTION' } }, { status: 400 })));
    await expect(start(null)).rejects.toMatchObject({ preAdmissionRejected: false });
    expect(readPendingRunRequest()).toBeNull();
  });
  it('does not clear a same-ID snapshot changed while the response was in flight', async () => {
    let respond!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })); vi.stubGlobal('fetch', fetcher);
    const pending = start(); await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    values.set(scopedKey(), JSON.stringify(snapshot('kds_fixture_request', analysisQuestion('support')))); respond(Response.json(fixture));
    await expect(pending).rejects.toMatchObject({ code: 'pending-storage' });
    expect(readPendingRunRequest()?.analysisQuestion?.id).toBe('support'); expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
  it('does not clear a question snapshot created after a lookup started without one', async () => {
    let respond!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })); vi.stubGlobal('fetch', fetcher);
    const lookup = signalApi.requestRun(fixture.watchId, 'kds_fixture_request');
    values.set(scopedKey(), JSON.stringify(snapshot('kds_fixture_request', analysisQuestion('support')))); respond(Response.json(fixture));
    await lookup; expect(readPendingRunRequest()?.analysisQuestion?.id).toBe('support'); expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
  it('fails closed for conflicting legacy/scoped records or corrupt question metadata', async () => {
    values.set(pendingKey, JSON.stringify({ watchId: fixture.watchId, requestId: 'kds_fixture_request' }));
    values.set(scopedKey(), JSON.stringify(snapshot()));
    expect(() => readPendingRunRequests()).toThrow();
    values.delete(pendingKey); values.set(scopedKey(), JSON.stringify({ ...snapshot(), analysisQuestion: { ...analysisQuestion('drawings'), extra: true } }));
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(signalApi.requestRun(fixture.watchId, 'kds_fixture_request')).rejects.toMatchObject({ code: 'pending-storage' });
    expect(fetcher).not.toHaveBeenCalled(); expect(localStorage.removeItem).not.toHaveBeenCalled();
  });
  it('rejects history and direct results from another watch or run ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ schemaVersion: '2.3.0', runs: [fixture] })).mockResolvedValueOnce(Response.json(fixture)).mockResolvedValueOnce(Response.json(fixture)));
    await expect(signalApi.runs('kds_fixture_other_watch')).rejects.toBeInstanceOf(ContractError);
    await expect(signalApi.run('kds_fixture_other_run')).rejects.toBeInstanceOf(ContractError);
    await expect(signalApi.requestRun('kds_fixture_other_watch', 'kds_fixture_request')).rejects.toBeInstanceOf(ContractError);
  });
});
