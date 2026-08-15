import type { AnalysisEngine } from './AnalysisEngine';
import { DEPARTMENT_LABELS, DESIGN_KIND_LABELS, PURPOSE_LABELS } from '../domain/labels';
import {
  classificationMembershipKey,
  companyMembershipKey,
  companySelectorFromMembership,
  companySelectorKey,
  companySelectorMatchesMembership,
  type AnalysisReadyDesignRecord,
  type ClassificationMembership,
  type CompanyMembership,
  type CompanySelector,
} from '../domain/analysisRecords';
import type {
  AnalysisInsight,
  AnalysisRequest,
  AnalysisResult,
  CompanyAnalysis,
  DesignKind,
  InsightMetric,
  MarketAnalysis,
} from '../domain/types';

const DOMAIN_UNIVERSE = ['家電・映像機器', 'AI・IoT', '医療機器', '店舗・施設', 'モビリティサービス'];
const SHAPE_TERMS = ['薄型', '小型', '大型', '曲面', '丸み', '透明', '折りたたみ', '可搬', '低重心'];
const UI_TERMS = ['カード', 'ダッシュボード', '通知', '進捗', '提案', '地図', '音声', 'AR', '多言語'];
const DIGITAL_TERMS = ['AI', 'IoT', '遠隔', 'クラウド', 'センサー', '自動化', '予兆', 'ダッシュボード'];
const NO_MATCH_MESSAGE = '現在のデータと条件では検出されませんでした。';

interface CompanyTarget {
  selector: CompanySelector;
  displayLabel: string;
}

interface RecordGroup {
  label: string;
  recordIds: Set<string>;
}

interface ClassificationLabelSummary {
  primary: string[];
  supplemental: string[];
}

export class RuleBasedAnalysisEngine implements AnalysisEngine {
  analyze(
    req: AnalysisRequest,
    records: AnalysisReadyDesignRecord[],
    dataAsOf: string,
  ): Promise<AnalysisResult> {
    const companyTargets =
      req.scope.mode === 'companies'
        ? requestedCompanyTargets(req.scope.companySelectors, records)
        : topCompanyTargets(records, 3);

    const result: AnalysisResult = {
      request: req,
      dataAsOf,
      market: req.scope.mode !== 'companies' ? this.createMarketAnalysis(records, dataAsOf) : undefined,
      companies: companyTargets.map((target) =>
        this.createCompanyAnalysis(
          target,
          records.filter((record) =>
            record.companyMemberships.some((membership) =>
              companySelectorMatchesMembership(target.selector, membership),
            ),
          ),
          req,
          dataAsOf,
        ),
      ),
      generatedBy: 'rules',
      disclaimer:
        'この結果は対象データをルールベースで集計した参考情報です。法的助言ではありません。',
    };

    return Promise.resolve(result);
  }

  private createMarketAnalysis(records: AnalysisReadyDesignRecord[], dataAsOf: string): MarketAnalysis {
    const areaGroups = topAreaGroups(records, 3);
    const domains = areaGroups.map((group) => group.label);
    const focusRecordIds = new Set(areaGroups.slice(0, 2).flatMap((group) => [...group.recordIds]));
    const focusRecords = records.filter((record) => focusRecordIds.has(record.id));
    const productNames = topArticleNames(focusRecords, 3);
    const companies = topCompanyTargets(records, 3);
    const companyCount = countApplicantCompanies(records);
    const companyCountSummary = companies
      .map((company) => `${company.displayLabel} ${countRecordsForCompanyTarget(records, company)}件`)
      .join('、');
    const focusSummary = [...domains.slice(0, 2), ...productNames].join('、');

    return {
      trends: makeInsight({
        records,
        text:
          records.length === 0
            ? NO_MATCH_MESSAGE
            : `${domains.length > 0 ? `${domains.join('、')}を中心に` : '今回の対象では'}意匠情報が確認されました。商品領域と企業の動きを継続して比較するための参考傾向です。`,
        metric: metric('分析対象意匠数', records.length, '件', `${dataAsOf}基準`),
      }),
      emergingDomains: makeInsight({
        records: focusRecords,
        text:
          focusRecords.length === 0
            ? NO_MATCH_MESSAGE
            : `${focusSummary}が商品化領域を考える手掛かりとして確認されました。`,
        metric: metric('検出意匠数', focusRecords.length, '件', `${dataAsOf}基準`),
      }),
      companyMoves: makeInsight({
        records,
        text:
          companies.length === 0
            ? NO_MATCH_MESSAGE
            : companyCount === 1
              ? `今回の対象データでは${companyCountSummary}の意匠が確認されました。`
              : `今回の対象データの対象${companyCount}社では、${companyCountSummary}が件数上位として確認されました。`,
        metric: metric('対象意匠数', records.length, '件', `対象${companyCount}社`),
      }),
    };
  }

  private createCompanyAnalysis(
    target: CompanyTarget,
    records: AnalysisReadyDesignRecord[],
    req: AnalysisRequest,
    dataAsOf: string,
  ): CompanyAnalysis {
    const company = target.displayLabel;
    const recentRecords = filterRecentMonths(records, dataAsOf, 12);
    const olderRecords = records.filter((record) => !recentRecords.includes(record));
    const topDomains = topAreaLabels(records, 3);
    const classificationSummary = topClassificationLabelSummary(records, 3);
    const classificationGuidance = formatClassificationSummary(classificationSummary);
    const shapeRecords = findRecordsByTerms(records, SHAPE_TERMS);
    const uiRecords = records.filter((record) => record.designKind === 'image');
    const uiChangeRecords = findRecordsByTerms(uiRecords, UI_TERMS);
    const digitalRecords = findRecordsByTerms(records, DIGITAL_TERMS);
    const purposeLabels = req.purposes.map((purpose) => PURPOSE_LABELS[purpose]).join('、');
    const departmentLabels = req.departments.map((department) => DEPARTMENT_LABELS[department]).join('、');
    const departmentGuidance = departmentLabels
      ? `${departmentLabels}向けには、この領域の継続監視が有効です。`
      : '';
    const designDirectionKeywords = topKeywords(records, 4);
    const meaningfulKeywordCount = uniqueKeywords(records).length;
    const designDirectionRecords =
      meaningfulKeywordCount >= 3 ? records.filter((record) => recordHasAnyKeyword(record, designDirectionKeywords)) : [];

    return {
      companyKey: companySelectorKey(target.selector),
      company,
      designTrend: {
        domains: makeInsight({
          records,
          text:
            records.length === 0
              ? NO_MATCH_MESSAGE
              : `${company}は${topDomains.join('、')}で意匠展開が相対的に多い傾向が見られます。${classificationGuidance ? `分類は${classificationGuidance}として確認できます。` : ''}`,
          metric: metric('企業別対象件数', records.length, '件'),
        }),
        shapeChange: makeInsight({
          records: shapeRecords,
          fallbackRecords: records,
          text:
            shapeRecords.length === 0
              ? '形状変化を示す特徴語は限定的です。'
              : `${topTerms(shapeRecords, SHAPE_TERMS).join('、')}などの形状特徴が参考傾向として見られます。`,
          metric: metric('形状特徴の該当件数', shapeRecords.length, '件'),
        }),
        designDirection: makeInsight({
          records: designDirectionRecords,
          text:
            designDirectionRecords.length === 0
              ? '有効な特徴語が少ないため、デザイン方向は参考表示を控えています。'
              : `${designDirectionKeywords.join('、')}を軸に、利用シーンに寄せたデザイン方向の可能性があります。追加期間での確認が必要です。`,
          metric: metric('抽出キーワード数', designDirectionRecords.length > 0 ? meaningfulKeywordCount : 0, '語'),
        }),
      },
      dxDevTrend: {
        imageDesignGrowth: makeInsight({
          records: uiRecords,
          fallbackRecords: records,
          text: describeImageTrend(uiRecords.length, records.length, recentRecords, olderRecords),
          metric: metric('画像意匠比率', ratio(uiRecords.length, records.length), '%'),
        }),
        digitalService: makeInsight({
          records: digitalRecords,
          fallbackRecords: records,
          text:
            digitalRecords.length === 0
              ? 'デジタルサービス接点を示す対象データは限定的です。'
              : `遠隔・クラウド・操作画面などの接点が${digitalRecords.length}件あり、サービス化の兆候が見られます。`,
          metric: metric('デジタル接点の該当件数', digitalRecords.length, '件'),
        }),
        aiIotTrend: makeInsight({
          records: findRecordsByTerms(records, ['AI', 'IoT', 'センサー', '予兆']),
          fallbackRecords: records,
          text:
            findRecordsByTerms(records, ['AI', 'IoT', 'センサー', '予兆']).length === 0
              ? 'AI・IoT関連の明示的な示唆は限定的です。'
              : 'AI・IoT、センサー、予兆検知に関する意匠があり、機能価値を外観・画面で伝える方向の可能性があります。',
          metric: metric('AI・IoT関連件数', findRecordsByTerms(records, ['AI', 'IoT', 'センサー', '予兆']).length, '件'),
        }),
      },
      designChange: {
        sizeTrend: makeInsight({
          records: findRecordsByTerms(records, ['小型', '大型', '低重心', '可搬']),
          fallbackRecords: records,
          text: describeTermDirection(records, ['小型', '大型', '低重心', '可搬'], 'サイズ・可搬性'),
          metric: metric('サイズ関連特徴件数', findRecordsByTerms(records, ['小型', '大型', '低重心', '可搬']).length, '件'),
        }),
        thinning: makeInsight({
          records: findRecordsByTerms(records, ['薄型', '透明', 'スリム']),
          fallbackRecords: records,
          text: describeTermDirection(records, ['薄型', '透明', 'スリム'], '薄型化・軽快感'),
          metric: metric('薄型関連特徴件数', findRecordsByTerms(records, ['薄型', '透明', 'スリム']).length, '件'),
        }),
        usability: makeInsight({
          records: findRecordsByTerms(records, ['片手', 'ステップ', '大きな', '確認', '誘導', '握り']),
          fallbackRecords: records,
          text: describeTermDirection(records, ['片手', 'ステップ', '大きな', '確認', '誘導', '握り'], '操作性'),
          metric: metric('操作性関連特徴件数', findRecordsByTerms(records, ['片手', 'ステップ', '大きな', '確認', '誘導', '握り']).length, '件'),
        }),
        uiChange: makeInsight({
          records: uiChangeRecords,
          text:
            uiChangeRecords.length === 0
              ? NO_MATCH_MESSAGE
              : `${topTerms(uiChangeRecords, UI_TERMS).join('、')}を中心に、情報の比較・提案・通知を重視するUI変化が見られます。`,
          metric: metric('UI関連画像意匠件数', uiChangeRecords.length, '件'),
        }),
      },
      portfolio: {
        focusAreas: makeInsight({
          records,
          text:
            topDomains.length === 0
              ? '集中領域は確認できません。'
              : `集中領域の参考候補は${topDomains.join('、')}です。${departmentGuidance}`,
          metric: metric('集中領域数', topDomains.length, '領域'),
        }),
        strengthening: makeInsight({
          records: recentRecords,
          fallbackRecords: records,
          text: describeStrengthening(recentRecords, olderRecords),
          metric: metric('直近1年の件数', recentRecords.length, '件'),
        }),
        whitespace: makeInsight({
          records: [],
          text: describeWhitespace(records),
          metric: metric('未出現領域数', 0, '領域'),
        }),
      },
      ipStrategy: {
        designProtectionAreas: makeInsight({
          records,
          text:
            records.length === 0
              ? NO_MATCH_MESSAGE
              : `${topDomains.join('、')}の外観・画面・空間接点を意匠保護領域として整理する余地があります。`,
          metric: metric('検討対象件数', records.length, '件'),
        }),
        designFilingDirection: makeInsight({
          records: recentRecords,
          fallbackRecords: records,
          text: `${purposeLabels}の目的では、このデータ範囲で相対的に多い領域を参考に、物品・画像・空間の組み合わせ出願を検討する構成が考えられます。追加期間での確認が必要です。`,
          metric: metric('直近1年の出願検討材料', recentRecords.length, '件'),
        }),
        patentReference: makeInsight({
          records: digitalRecords,
          fallbackRecords: records,
          text: '技術機能そのものではなく、意匠で把握できる画面・筐体・利用場面を起点に、関連する技術テーマの特許調査を検討できます。',
          metric: metric('特許調査の参照候補', digitalRecords.length, '件'),
        }),
        trademarkReference: makeInsight({
          records,
          text: 'サービス接点や画面名が前面に出る領域では、ブランド表示・サービス名称の商標保護を別途確認する余地があります。',
          metric: metric('商標観点の参照候補', records.length, '件'),
        }),
        copyrightReference: makeInsight({
          records: uiRecords,
          fallbackRecords: records,
          text: '画像意匠の画面構成や表示素材は、著作権の観点でも権利帰属と再利用条件を確認する対象になります。',
          metric: metric('著作権観点の参照候補', uiRecords.length, '件'),
        }),
      },
    };
  }
}

function requestedCompanyTargets(
  selectors: CompanySelector[],
  records: AnalysisReadyDesignRecord[],
): CompanyTarget[] {
  const targets = new Map<string, CompanyTarget>();
  for (const selector of selectors) {
    const key = companySelectorKey(selector);
    if (targets.has(key)) continue;
    targets.set(key, {
      selector,
      displayLabel: selectorDisplayLabel(selector, records),
    });
  }
  return [...targets.values()];
}

function selectorDisplayLabel(
  selector: CompanySelector,
  records: AnalysisReadyDesignRecord[],
): string {
  const selectorLabel = 'displayLabel' in selector ? selector.displayLabel.trim() : '';
  if (selectorLabel) return selectorLabel;

  for (const record of records) {
    const membership = record.companyMemberships.find((candidate) =>
      companySelectorMatchesMembership(selector, candidate),
    );
    if (membership?.displayLabel.trim()) return membership.displayLabel;
  }

  return selector.origin === 'backend' ? selector.resolvedEntityId : selector.localKey;
}

function topCompanyTargets(records: AnalysisReadyDesignRecord[], limit: number): CompanyTarget[] {
  const groups = new Map<
    string,
    { selector: CompanySelector; displayLabel: string; recordIds: Set<string> }
  >();

  for (const record of records) {
    const seenForRecord = new Set<string>();
    for (const membership of record.companyMemberships) {
      if (!isApplicantAggregationMembership(membership)) continue;
      const key = companyMembershipKey(membership);
      if (seenForRecord.has(key)) continue;
      seenForRecord.add(key);

      const current = groups.get(key);
      if (current) {
        current.recordIds.add(record.id);
      } else {
        groups.set(key, {
          selector: companySelectorFromMembership(membership),
          displayLabel: membership.displayLabel,
          recordIds: new Set([record.id]),
        });
      }
    }
  }

  return [...groups.values()]
    .sort(
      (left, right) =>
        right.recordIds.size - left.recordIds.size ||
        left.displayLabel.localeCompare(right.displayLabel, 'ja-JP'),
    )
    .slice(0, limit)
    .map(({ selector, displayLabel }) => ({ selector, displayLabel }));
}

function countApplicantCompanies(records: AnalysisReadyDesignRecord[]): number {
  const keys = new Set<string>();
  for (const record of records) {
    for (const membership of record.companyMemberships) {
      if (isApplicantAggregationMembership(membership)) keys.add(companyMembershipKey(membership));
    }
  }
  return keys.size;
}

function countRecordsForCompanyTarget(
  records: AnalysisReadyDesignRecord[],
  target: CompanyTarget,
): number {
  return records.filter((record) =>
    record.companyMemberships.some((membership) =>
      companySelectorMatchesMembership(target.selector, membership),
    ),
  ).length;
}

function isApplicantAggregationMembership(membership: CompanyMembership): boolean {
  if (membership.role !== 'applicant') return false;
  return membership.origin === 'backend' || membership.isPrimaryApplicant;
}

function makeInsight({
  records,
  fallbackRecords = [],
  text,
  metric,
}: {
  records: AnalysisReadyDesignRecord[];
  fallbackRecords?: AnalysisReadyDesignRecord[];
  text: string;
  metric: InsightMetric;
}): AnalysisInsight {
  const evidenceSource = records.length > 0 ? records : metric.value > 0 ? fallbackRecords : [];
  const evidenceIds = [...new Set(evidenceSource.map((record) => record.id))];

  return {
    title: metric.label,
    text,
    evidenceIds,
    metric,
    confidence: confidenceFor(evidenceSource.length, metric.value, evidenceIds.length),
  };
}

function metric(label: string, value: number, unit?: string, comparison?: string): InsightMetric {
  return { label, value, unit, comparison };
}

function confidenceFor(count: number, metricValue: number, evidenceIdCount: number): AnalysisInsight['confidence'] {
  if (metricValue === 0 || count === 0 || evidenceIdCount === 0) return 'low';
  if (count >= 20 && metricValue >= 5 && evidenceIdCount >= 5) return 'high';
  if (count >= 5 && evidenceIdCount >= 3) return 'medium';
  return 'low';
}

function countBy<T>(items: T[], getKey: (item: T) => string): Map<string, number> {
  return items.reduce((map, item) => {
    const key = getKey(item);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
}

function topEntries(map: Map<string, number>, limit: number): [string, number][] {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ja-JP'))
    .slice(0, limit);
}

function topLabels(map: Map<string, number>, limit: number): string[] {
  return topEntries(map, limit).map(([label]) => label);
}

function topAreaLabels(records: AnalysisReadyDesignRecord[], limit: number): string[] {
  return topAreaGroups(records, limit).map((group) => group.label);
}

function topAreaGroups(records: AnalysisReadyDesignRecord[], limit: number): RecordGroup[] {
  const primaryGroups = new Map<string, RecordGroup>();
  const supplementalGroups = new Map<string, RecordGroup>();
  for (const record of records) {
    const businessDomain = record.businessDomain?.trim();
    if (businessDomain) {
      addRecordGroup(primaryGroups, `business-domain:${businessDomain}`, businessDomain, record.id);
      continue;
    }

    const seenForRecord = new Set<string>();
    for (const membership of record.classificationMemberships) {
      const key = classificationMembershipKey(membership);
      if (seenForRecord.has(key)) continue;
      seenForRecord.add(key);
      addRecordGroup(
        membership.isPrimary ? primaryGroups : supplementalGroups,
        key,
        classificationDisplayLabel(membership),
        record.id,
      );
    }
  }

  for (const key of primaryGroups.keys()) supplementalGroups.delete(key);
  return [...rankRecordGroups(primaryGroups), ...rankRecordGroups(supplementalGroups)].slice(0, limit);
}

function topClassificationLabelSummary(
  records: AnalysisReadyDesignRecord[],
  limit: number,
): ClassificationLabelSummary {
  const primaryGroups = new Map<string, RecordGroup>();
  const supplementalGroups = new Map<string, RecordGroup>();
  for (const record of records) {
    const seenForRecord = new Set<string>();
    for (const membership of record.classificationMemberships) {
      const key = classificationMembershipKey(membership);
      if (seenForRecord.has(key)) continue;
      seenForRecord.add(key);
      addRecordGroup(
        membership.isPrimary ? primaryGroups : supplementalGroups,
        key,
        classificationDisplayLabel(membership),
        record.id,
      );
    }
  }

  for (const key of primaryGroups.keys()) supplementalGroups.delete(key);
  return {
    primary: topRecordGroupLabels(primaryGroups, limit),
    supplemental: topRecordGroupLabels(supplementalGroups, limit),
  };
}

function formatClassificationSummary(summary: ClassificationLabelSummary): string {
  return [
    summary.primary.length > 0 ? `主分類：${summary.primary.join('、')}` : '',
    summary.supplemental.length > 0 ? `補足分類：${summary.supplemental.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('／');
}

function topArticleNames(records: AnalysisReadyDesignRecord[], limit: number): string[] {
  const articleNames = records
    .map((record) => record.articleName?.trim())
    .filter((value): value is string => Boolean(value));
  return topLabels(countBy(articleNames, (value) => value), limit);
}

function addRecordGroup(
  groups: Map<string, RecordGroup>,
  key: string,
  label: string,
  recordId: string,
): void {
  const current = groups.get(key);
  if (current) {
    current.recordIds.add(recordId);
  } else {
    groups.set(key, { label, recordIds: new Set([recordId]) });
  }
}

function topRecordGroupLabels(
  groups: Map<string, RecordGroup>,
  limit: number,
): string[] {
  return rankRecordGroups(groups)
    .slice(0, limit)
    .map((group) => group.label);
}

function rankRecordGroups(groups: Map<string, RecordGroup>): RecordGroup[] {
  return [...groups.values()]
    .sort(
      (left, right) =>
        right.recordIds.size - left.recordIds.size || left.label.localeCompare(right.label, 'ja-JP'),
    );
}

function classificationDisplayLabel(membership: ClassificationMembership): string {
  const label = membership.label?.trim();
  if (label) return label;
  if (membership.scheme === 'sample-design-class' || membership.scheme === 'legacy-design-class') {
    return membership.code;
  }
  return `${membership.scheme}:${membership.code}`;
}

function recordTerms(record: AnalysisReadyDesignRecord): string[] {
  return [
    record.articleName ?? '',
    record.description ?? '',
    record.articleDescription ?? '',
    record.businessDomain ?? '',
    ...record.classificationMemberships.flatMap((membership) => [
      membership.scheme,
      membership.code,
      membership.label ?? '',
    ]),
    ...(record.keywords ?? []),
    ...(record.designFeatures ?? []),
  ].filter(Boolean);
}

function topKeywords(records: AnalysisReadyDesignRecord[], limit: number): string[] {
  return topLabels(
    countBy(
      records
        .flatMap((record) => [...(record.keywords ?? []), ...(record.designFeatures ?? [])])
        .filter((value) => !isStopWord(value)),
      (value) => value,
    ),
    limit,
  );
}

function uniqueKeywords(records: AnalysisReadyDesignRecord[]): string[] {
  return [
    ...new Set(
      records
        .flatMap((record) => [...(record.keywords ?? []), ...(record.designFeatures ?? [])])
        .filter((value) => !isStopWord(value)),
    ),
  ];
}

function recordHasAnyKeyword(record: AnalysisReadyDesignRecord, keywords: string[]): boolean {
  const terms = [...(record.keywords ?? []), ...(record.designFeatures ?? [])].filter(
    (value) => !isStopWord(value),
  );
  return keywords.some((keyword) => terms.includes(keyword));
}

function findRecordsByTerms(
  records: AnalysisReadyDesignRecord[],
  terms: string[],
): AnalysisReadyDesignRecord[] {
  return records.filter((record) => {
    const haystack = recordTerms(record).join(' ');
    return terms.some((term) => haystack.includes(term));
  });
}

function topTerms(records: AnalysisReadyDesignRecord[], terms: string[]): string[] {
  const counts = new Map<string, number>();
  for (const term of terms) {
    const count = findRecordsByTerms(records, [term]).length;
    if (count > 0) counts.set(term, count);
  }
  return topLabels(counts, 3);
}

function filterRecentMonths(
  records: AnalysisReadyDesignRecord[],
  dataAsOf: string,
  months: number,
): AnalysisReadyDesignRecord[] {
  const from = new Date(`${dataAsOf}T00:00:00`);
  from.setMonth(from.getMonth() - months);
  return records.filter((record) => new Date(record.gazetteDate) >= from);
}

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

function describeImageTrend(
  imageCount: number,
  totalCount: number,
  recentRecords: AnalysisReadyDesignRecord[],
  olderRecords: AnalysisReadyDesignRecord[],
): string {
  if (totalCount === 0) return '画像意匠の傾向は判断できません。';
  const recentImage = recentRecords.filter((record) => record.designKind === 'image').length;
  const olderImage = olderRecords.filter((record) => record.designKind === 'image').length;
  const direction = recentImage >= olderImage ? '直近側でも確認できます' : '過去側の比重が高く見えます';
  return `画像意匠は${imageCount}件（${ratio(imageCount, totalCount)}%）で、${direction}。追加期間での確認が必要です。`;
}

function describeTermDirection(
  records: AnalysisReadyDesignRecord[],
  terms: string[],
  label: string,
): string {
  const matched = findRecordsByTerms(records, terms);
  if (matched.length === 0) return `${label}を示す明確な特徴語は限定的です。`;
  return `${label}では${topTerms(records, terms).join('、')}に関する特徴が見られます。`;
}

function describeStrengthening(
  recentRecords: AnalysisReadyDesignRecord[],
  olderRecords: AnalysisReadyDesignRecord[],
): string {
  if (recentRecords.length === 0) return '直近1年で相対的に多い領域は確認できません。';
  const recentTop = topAreaLabels(recentRecords, 2);
  const olderTop = topAreaLabels(olderRecords, 2);
  const shifted = recentTop.filter((domain) => !olderTop.includes(domain));
  if (shifted.length > 0) {
    return `このデータ範囲では${shifted.join('、')}が相対的に多く確認できます。追加期間での確認が必要です。`;
  }
  return `直近1年でも${recentTop.join('、')}が参考傾向として確認できます。継続観察が必要です。`;
}

function whitespaceDomains(records: AnalysisReadyDesignRecord[]): string[] {
  const existing = new Set(
    records
      .map((record) => record.businessDomain?.trim())
      .filter((domain): domain is string => Boolean(domain)),
  );
  return DOMAIN_UNIVERSE.filter((domain) => !existing.has(domain));
}

function describeWhitespace(records: AnalysisReadyDesignRecord[]): string {
  if (records.length === 0) return '対象データがないため、確認できない領域の参考候補は判断できません。';
  if (records.every((record) => !record.businessDomain?.trim())) {
    return '事業領域のsource factがないため、確認できない領域の参考表示は控えています。';
  }
  const whitespace = whitespaceDomains(records);
  if (whitespace.length === 0) {
    return 'このデータ範囲では主要候補領域を広く確認できます。確認できない領域の参考表示は控えています。';
  }
  return `${whitespace.join('、')}はこのデータ範囲では確認できませんでしたが、出願がないこと自体を既存record.idで裏付けられないため参考表示を控えています。`;
}

const STOP_WORDS = new Set([
  '部分',
  '意匠登録',
  '本物品',
  '実線',
  '参考図',
  '正面図',
  '背面図',
  '左側面図',
  '右側面図',
  '平面図',
  '底面図',
  '状態',
  '使用状態',
  '図',
  '画像図',
  '変化',
  '形状',
  '特定',
  'in',
  'on',
  'of',
  'for',
  'to',
  'and',
  'or',
  'the',
  'a',
  'an',
  'as',
  'by',
  'with',
  'from',
  'show',
  'design',
  'characteristic',
  'portion',
  'thereof',
  'outermost',
  'view',
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
  'figure',
  'fig',
  'perspective',
  'shown',
  'solid',
  'broken',
  'line',
  'lines',
]);

function isStopWord(value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase('en-US');
  return STOP_WORDS.has(normalized) || /^\d+$/.test(normalized);
}

export function countByDesignKind(records: AnalysisReadyDesignRecord[]): Record<DesignKind, number> {
  return {
    article: records.filter((record) => record.designKind === 'article').length,
    image: records.filter((record) => record.designKind === 'image').length,
    interior: records.filter((record) => record.designKind === 'interior').length,
  };
}

export function designKindSummary(records: AnalysisReadyDesignRecord[]): string {
  const counts = countByDesignKind(records);
  return Object.entries(counts)
    .map(([kind, count]) => `${DESIGN_KIND_LABELS[kind as DesignKind]} ${count}件`)
    .join(' / ');
}
