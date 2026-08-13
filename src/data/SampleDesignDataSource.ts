import dataset from './sample-designs.json';
import { DESIGN_KIND_LABELS } from '../domain/labels';
import type { AnalysisRequest, DesignRecord, Period, SampleDesignDataset } from '../domain/types';

const sampleDataset = dataset as SampleDesignDataset;
const datasetErrors = validateDesignDataset(sampleDataset);

if (datasetErrors.length > 0) {
  throw new Error(`デモ用サンプルデータに不整合があります: ${datasetErrors.join(' / ')}`);
}

export interface DesignDataSource {
  query(req: AnalysisRequest): Promise<DesignRecord[]>;
  getDataAsOf(): string;
  getAllRecords(): DesignRecord[];
}

export class SampleDesignDataSource implements DesignDataSource {
  query(req: AnalysisRequest): Promise<DesignRecord[]> {
    const fromDate = getPeriodStart(sampleDataset.dataAsOf, req.period);
    const fromDateIso = formatIsoDate(fromDate);
    const productQuery = normalize(req.productDomain ?? '');
    const companies =
      req.scope.mode === 'companies'
        ? req.scope.companies.map((company) => company.trim()).filter(Boolean)
        : [];

    const records = sampleDataset.records
      .filter((record) => record.gazetteDate >= fromDateIso && record.gazetteDate <= sampleDataset.dataAsOf)
      .filter((record) => req.designKinds.includes(record.designKind))
      .filter((record) => companies.length === 0 || companies.includes(record.applicant))
      .filter((record) => (productQuery ? matchesProductDomain(record, productQuery) : true))
      .sort((left, right) => right.gazetteDate.localeCompare(left.gazetteDate));

    return Promise.resolve(records);
  }

  getDataAsOf(): string {
    return sampleDataset.dataAsOf;
  }

  getAllRecords(): DesignRecord[] {
    return [...sampleDataset.records].sort((left, right) => right.gazetteDate.localeCompare(left.gazetteDate));
  }
}

export function getPeriodStart(dataAsOf: string, period: Period): Date {
  const start = parseIsoDate(dataAsOf);
  if (!start) throw new Error(`dataAsOfが正しい日付ではありません: ${dataAsOf}`);
  const originalMonth = start.getUTCMonth();
  start.setUTCFullYear(start.getUTCFullYear() - (period === 'last_1y' ? 1 : 2));
  if (start.getUTCMonth() !== originalMonth) start.setUTCDate(0);
  return start;
}

export function validateDesignDataset(candidate: SampleDesignDataset): string[] {
  const errors: string[] = [];
  const dataAsOf = parseIsoDate(candidate.dataAsOf);
  if (!dataAsOf) errors.push(`dataAsOfが正しい日付ではありません: ${candidate.dataAsOf}`);

  const ids = new Set<string>();
  const registrationNumbers = new Set<string>();
  for (const record of candidate.records) {
    if (!record.id.trim()) errors.push('空のidがあります。');
    if (ids.has(record.id)) errors.push(`重複idがあります: ${record.id}`);
    ids.add(record.id);

    if (record.registrationNumber) {
      if (registrationNumbers.has(record.registrationNumber)) {
        errors.push(`同一登録番号が重複しています: ${record.registrationNumber}`);
      }
      registrationNumbers.add(record.registrationNumber);
    }

    if (!record.applicant.trim()) errors.push(`企業名が空です: ${record.id}`);
    if (!parseIsoDate(record.gazetteDate)) errors.push(`公報発行日が正しい日付ではありません: ${record.id}`);
    if (dataAsOf && record.gazetteDate > candidate.dataAsOf) {
      errors.push(`dataAsOfより後の公報発行日があります: ${record.id}`);
    }
    for (const [field, value] of [
      ['sourceUpdateDate', record.sourceUpdateDate],
      ['applicationDate', record.applicationDate],
      ['registrationDate', record.registrationDate],
    ] as const) {
      if (!value) continue;
      if (!parseIsoDate(value)) errors.push(`${field}が正しい日付ではありません: ${record.id}`);
      if (dataAsOf && value > candidate.dataAsOf) errors.push(`dataAsOfより後の${field}があります: ${record.id}`);
    }
  }
  return errors;
}

function matchesProductDomain(record: DesignRecord, query: string): boolean {
  const target = [
    record.businessDomain,
    DESIGN_KIND_LABELS[record.designKind],
    record.articleName,
    record.designClass,
    record.classLabel,
    record.summary,
    ...record.keywords,
    ...record.designFeatures,
  ]
    .filter(Boolean)
    .map((value) => normalize(String(value)))
    .join(' ');

  return query
    .split(/\s+|\/|、|・/)
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => target.includes(token));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ja-JP');
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || formatIsoDate(date) !== value ? null : date;
}

function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
