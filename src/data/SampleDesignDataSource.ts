import dataset from './sample-designs.json';
import type { AnalysisRequest, DesignRecord, Period, SampleDesignDataset } from '../domain/types';

const sampleDataset = dataset as SampleDesignDataset;

export interface DesignDataSource {
  query(req: AnalysisRequest): Promise<DesignRecord[]>;
  getDataAsOf(): string;
  getAllRecords(): DesignRecord[];
}

export class SampleDesignDataSource implements DesignDataSource {
  query(req: AnalysisRequest): Promise<DesignRecord[]> {
    const fromDate = getPeriodStart(sampleDataset.dataAsOf, req.period);
    const productQuery = normalize(req.productDomain ?? '');
    const companies =
      req.scope.mode === 'companies'
        ? req.scope.companies.map((company) => company.trim()).filter(Boolean)
        : [];

    const records = sampleDataset.records
      .filter((record) => new Date(record.gazetteDate) >= fromDate)
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
  const start = new Date(`${dataAsOf}T00:00:00`);
  start.setFullYear(start.getFullYear() - (period === 'last_1y' ? 1 : 2));
  return start;
}

function matchesProductDomain(record: DesignRecord, query: string): boolean {
  const target = [
    record.businessDomain,
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
