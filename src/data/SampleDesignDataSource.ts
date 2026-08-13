import dataset from './sample-designs.json';
import { companySelectorMatchesMembership, type AnalysisReadyDesignRecord } from '../domain/analysisRecords';
import type { AnalysisRequest, DesignRecord, Period, SampleDesignDataset } from '../domain/types';
import { projectSampleDesignRecord, type ProjectedLegacyDesignRecord } from '../analysis/projectLegacyDesignRecord';

const sampleDataset = dataset as SampleDesignDataset;
const sampleAnalysisRecords = sampleDataset.records.map(projectSampleDesignRecord);

export interface DesignDataSource {
  query(req: AnalysisRequest): Promise<AnalysisReadyDesignRecord[]>;
  getDataAsOf(): string;
  getAllRecords(): AnalysisReadyDesignRecord[];
  getViewRecords(): DesignRecord[];
}

export class SampleDesignDataSource implements DesignDataSource {
  query(req: AnalysisRequest): Promise<ProjectedLegacyDesignRecord[]> {
    const fromDate = getPeriodStart(sampleDataset.dataAsOf, req.period);
    const productQuery = normalize(req.productDomain ?? '');
    const companySelectors =
      req.scope.mode === 'companies'
        ? req.scope.companySelectors.filter((selector) => selector.origin === 'sample')
        : [];

    const records = sampleAnalysisRecords
      .filter((record) => new Date(record.gazetteDate) >= fromDate)
      .filter((record) => req.designKinds.includes(record.designKind))
      .filter(
        (record) =>
          req.scope.mode === 'all_classes' ||
          companySelectors.some((selector) =>
            record.companyMemberships.some((membership) => companySelectorMatchesMembership(selector, membership)),
          ),
      )
      .filter((record) => (productQuery ? matchesProductDomain(record, productQuery) : true))
      .sort((left, right) => right.gazetteDate.localeCompare(left.gazetteDate));

    return Promise.resolve(records);
  }

  getDataAsOf(): string {
    return sampleDataset.dataAsOf;
  }

  getAllRecords(): ProjectedLegacyDesignRecord[] {
    return [...sampleAnalysisRecords].sort((left, right) => right.gazetteDate.localeCompare(left.gazetteDate));
  }

  getViewRecords(): DesignRecord[] {
    return [...sampleDataset.records].sort((left, right) => right.gazetteDate.localeCompare(left.gazetteDate));
  }
}

export function getPeriodStart(dataAsOf: string, period: Period): Date {
  const start = new Date(`${dataAsOf}T00:00:00`);
  start.setFullYear(start.getFullYear() - (period === 'last_1y' ? 1 : 2));
  return start;
}

function matchesProductDomain(record: ProjectedLegacyDesignRecord, query: string): boolean {
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
