import type { DemoShowcaseRecord } from '../domain/types';
import { normalizeDisplayText } from './LocalJpoJsonDataSource';

export interface DemoShowcaseLoadSuccess {
  ok: true;
  fileName: string;
  records: DemoShowcaseRecord[];
  warnings: string[];
}

export interface DemoShowcaseLoadFailure {
  ok: false;
  fileName: string;
  errors: string[];
  warnings: string[];
}

export type DemoShowcaseLoadResult = DemoShowcaseLoadSuccess | DemoShowcaseLoadFailure;

export function loadDemoShowcaseJson(value: unknown, fileName = 'demo-showcase.json'): DemoShowcaseLoadResult {
  const warnings: string[] = [];
  if (!isObject(value) && !Array.isArray(value)) {
    return { ok: false, fileName, errors: ['JSONの最上位がオブジェクトではありません。'], warnings };
  }

  const sourceRecords = Array.isArray(value) ? value : Array.isArray(value.records) ? value.records : [];
  if (sourceRecords.length === 0) {
    return { ok: false, fileName, errors: ['records配列が見つかりません。'], warnings };
  }

  const records = sourceRecords.map((record) => toDemoShowcaseRecord(record)).filter((record): record is DemoShowcaseRecord => record !== null);
  const declaredCount = isObject(value) && typeof value.recordCount === 'number' ? value.recordCount : undefined;
  if (declaredCount !== undefined && declaredCount !== sourceRecords.length) {
    warnings.push(`recordCount (${declaredCount}) と records.length (${sourceRecords.length}) が一致しません。`);
  }
  if (records.length !== sourceRecords.length) {
    warnings.push(`idまたは物品名がない候補 ${sourceRecords.length - records.length}件を読み飛ばしました。`);
  }

  return { ok: true, fileName, records, warnings };
}

function toDemoShowcaseRecord(value: unknown): DemoShowcaseRecord | null {
  if (!isObject(value)) return null;
  const id = safeText(value.id);
  const articleName = safeText(value.articleName);
  if (!id || !articleName) return null;

  const drawingLabels = toStringList(value.drawingLabels).map((label) => safeText(label)).filter((label): label is string => Boolean(label));

  return {
    id,
    articleName,
    partyLabel: partyLabel(value),
    registrationNumber: safeText(value.registrationNumber),
    applicationNumber: safeText(value.applicationNumber),
    gazetteDate: safeText(value.gazetteDate),
    designClass: safeText(value.designClass),
    drawingRefCount: toOptionalNumber(value.drawingRefCount) ?? drawingLabels.length,
    drawingLabels,
    sourceXmlFile: safeRelativePath(value.sourceXmlFile) ?? null,
    whyDemoFriendly: safeText(value.whyDemoFriendly),
  };
}

function partyLabel(value: Record<string, unknown>): string | undefined {
  return (
    toStringList(value.applicantsDisplay).map(safeText).find(Boolean) ??
    toStringList(value.rightHolders).map(safeText).find(Boolean) ??
    toStringList(value.applicants).map(safeText).find(Boolean)
  );
}

function toStringList(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return compactUnique(value.flatMap((item) => toStringList(item)));
  if (typeof value === 'string') return [normalizeDisplayText(value)].filter(Boolean);
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (isObject(value)) {
    const preferredKeys = ['displayName', 'normalizedNameCandidate', 'name', 'rawName', 'englishNameCandidate', 'code'];
    for (const key of preferredKeys) {
      const extracted = value[key];
      if (typeof extracted === 'string' && extracted.trim()) return [normalizeDisplayText(extracted)];
      if (typeof extracted === 'number') return [String(extracted)];
    }
  }
  return [];
}

function safeText(value: unknown): string | undefined {
  const text = typeof value === 'string' ? normalizeDisplayText(value).trim() : typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
  if (!text || hasUnsafeReference(text)) return undefined;
  return text;
}

function safeRelativePath(value: unknown): string | undefined {
  const text = safeText(value)?.replace(/\\/g, '/');
  if (!text || text.startsWith('/') || text.includes('../') || text.startsWith('../') || hasUnsafeReference(text)) return undefined;
  return text;
}

function hasUnsafeReference(value: string): boolean {
  return /https?:\/\//i.test(value) || /^[a-z]:[\\/]/i.test(value) || /^data:/i.test(value) || hasEmbeddedDataToken(value);
}

function hasEmbeddedDataToken(value: string): boolean {
  return value.toLocaleLowerCase('en-US').includes(['base', '64'].join(''));
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function compactUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
