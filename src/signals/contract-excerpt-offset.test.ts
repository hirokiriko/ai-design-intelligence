import { describe, expect, it } from 'vitest';
import fixture from './backend-run-v2.5.fixture.json';
import { ContractError, decodeRun, decodeRuns, type RunV25 } from './contract';

const prefix = '前😀e\u0301。';
const quote = '架空資料の開口は円形です。';
const excerpt = `${prefix}${quote}後半。`;
const length = (value: string) => Array.from(value).length;

function selectedWindow() {
  const run = decodeRun(structuredClone(fixture)) as RunV25;
  if (!run.signal) throw new Error('Fictional fixture must contain a saved signal');
  const fact = run.signal.officialFacts[0];
  const source = run.signal.sources.find((item) => item.id === fact.sourceId);
  if (!source) throw new Error('Fictional fixture must contain the quoted source');
  source.excerpt = excerpt;
  source.excerptStart = 37;
  source.extractedChars = source.excerptStart + length(excerpt) + 40;
  source.modelVisibleChars = length(excerpt);
  source.truncated = true;
  fact.quote = quote;
  fact.start = source.excerptStart + length(prefix);
  fact.end = fact.start + length(quote);
  return { run, source, fact };
}

describe('saved source windows use absolute Unicode code-point offsets', () => {
  it('accepts a nonzero window and preserves exact offsets in detail and history decoding', () => {
    const { run, source, fact } = selectedWindow();
    expect(fact.end).toBeGreaterThan(source.modelVisibleChars);
    expect(decodeRun(structuredClone(run))).toEqual(run);
    expect(decodeRuns({ schemaVersion: '2.5.0', runs: [structuredClone(run)] })).toEqual([run]);
  });

  it('accepts a quote ending exactly at the model-visible boundary', () => {
    const { run, source, fact } = selectedWindow();
    source.modelVisibleChars = fact.end - source.excerptStart;
    expect(decodeRun(run)).toBe(run);
  });

  it('accepts a window ending exactly at the extracted-text boundary', () => {
    const { run, source } = selectedWindow();
    source.extractedChars = source.excerptStart + length(source.excerpt);
    expect(decodeRun(run)).toBe(run);
  });

  it('rejects a window extending one code point beyond extracted text', () => {
    const { run, source } = selectedWindow();
    source.extractedChars = source.excerptStart + length(source.excerpt) - 1;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid excerptStart %s', (start) => {
    const { run, source } = selectedWindow();
    source.excerptStart = start;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it('rejects an individually safe start whose window overflows the extracted bound', () => {
    const { run, source } = selectedWindow();
    source.excerptStart = Number.MAX_SAFE_INTEGER;
    source.extractedChars = Number.MAX_SAFE_INTEGER;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it('rejects a quote starting before the selected window', () => {
    const { run, source, fact } = selectedWindow();
    fact.start = source.excerptStart - 1;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it('rejects an exact saved quote extending one code point beyond model visibility', () => {
    const { run, source, fact } = selectedWindow();
    source.modelVisibleChars = fact.end - source.excerptStart - 1;
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it.each([
    ['UTF-16 units', (value: string) => value.length],
    ['UTF-8 bytes', (value: string) => new TextEncoder().encode(value).length],
  ] as const)('rejects quote offsets measured in %s', (_label, wrongLength) => {
    const { run, source, fact } = selectedWindow();
    fact.start = source.excerptStart + wrongLength(prefix);
    fact.end = fact.start + wrongLength(quote);
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it('rejects a quotation that differs from the exact saved substring', () => {
    const { run, fact } = selectedWindow();
    fact.quote = '架空資料の開口は角形です。';
    expect(() => decodeRun(run)).toThrow(ContractError);
  });

  it('preserves existing zero-offset fixture decoding', () => {
    expect(decodeRun(structuredClone(fixture))).toEqual(fixture);
  });
});
