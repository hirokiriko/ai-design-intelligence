import type { AnalysisEngine } from './AnalysisEngine';
import { DEPARTMENT_LABELS, DESIGN_KIND_LABELS, PURPOSE_LABELS } from '../domain/labels';
import type {
  AnalysisInsight,
  AnalysisRequest,
  AnalysisResult,
  CompanyAnalysis,
  DesignKind,
  DesignRecord,
  InsightMetric,
  MarketAnalysis,
} from '../domain/types';

const DOMAIN_UNIVERSE = ['家電・映像機器', 'AI・IoT', '医療機器', '店舗・施設', 'モビリティサービス'];
const SHAPE_TERMS = ['薄型', '小型', '大型', '曲面', '丸み', '透明', '折りたたみ', '可搬', '低重心'];
const UI_TERMS = ['カード', 'ダッシュボード', '通知', '進捗', '提案', '地図', '音声', 'AR', '多言語'];
const DIGITAL_TERMS = ['AI', 'IoT', '遠隔', 'クラウド', 'センサー', '自動化', '予兆', 'ダッシュボード'];

export class RuleBasedAnalysisEngine implements AnalysisEngine {
  analyze(req: AnalysisRequest, records: DesignRecord[], dataAsOf: string): Promise<AnalysisResult> {
    const companies =
      req.scope.mode === 'companies'
        ? req.scope.companies
        : topCompanyLabels(records, 3);

    const result: AnalysisResult = {
      request: req,
      dataAsOf,
      market: req.scope.mode === 'all_classes' ? this.createMarketAnalysis(records, dataAsOf) : undefined,
      companies: companies.map((company) =>
        this.createCompanyAnalysis(company, records.filter((record) => record.applicant === company), req, dataAsOf),
      ),
      generatedBy: 'rules',
      disclaimer:
        'この結果はデモ用サンプルデータをルールベースで集計した参考情報です。法的助言ではありません。',
    };

    return Promise.resolve(result);
  }

  private createMarketAnalysis(records: DesignRecord[], dataAsOf: string): MarketAnalysis {
    const domains = topLabels(countBy(records, (record) => record.businessDomain), 3);
    const companies = topCompanyLabels(records, 3);
    const imageRecords = records.filter((record) => record.designKind === 'image');
    const imageCount = imageRecords.length;

    return {
      trends: makeInsight({
        records,
        text:
          records.length === 0
            ? '対象条件に合う市場全体のサンプル意匠はありません。'
            : `${domains.join('、')}を中心に、画像意匠を含むデジタル接点の意匠に参考傾向が見られます。継続観察が必要です。`,
        metric: metric('対象意匠件数', records.length, '件', `${dataAsOf}基準`),
      }),
      emergingDomains: makeInsight({
        records: imageRecords,
        text:
          imageCount === 0
            ? '画像意匠の該当は少なく、物品・空間意匠中心の傾向です。'
            : `画像意匠が${imageCount}件あり、AI・IoTや遠隔操作に関わる画面意匠の探索余地がある可能性があります。`,
        metric: metric('画像意匠件数', imageCount, '件', `${dataAsOf}基準`),
      }),
      companyMoves: makeInsight({
        records,
        text:
          companies.length === 0
            ? '企業別の動きは確認できません。'
            : `${companies.join('、')}がサンプル内で相対的に多く、複数領域へ意匠展開している可能性があります。`,
        metric: metric('対象企業数', new Set(records.map((record) => record.applicant)).size, '社'),
      }),
    };
  }

  private createCompanyAnalysis(
    company: string,
    records: DesignRecord[],
    req: AnalysisRequest,
    dataAsOf: string,
  ): CompanyAnalysis {
    const recentRecords = filterRecentMonths(records, dataAsOf, 12);
    const olderRecords = records.filter((record) => !recentRecords.includes(record));
    const topDomains = topLabels(countBy(records, (record) => record.businessDomain), 3);
    const topClasses = topLabels(countBy(records, (record) => record.classLabel ?? record.designClass), 3);
    const shapeRecords = findRecordsByTerms(records, SHAPE_TERMS);
    const uiRecords = records.filter((record) => record.designKind === 'image');
    const digitalRecords = findRecordsByTerms(records, DIGITAL_TERMS);
    const purposeLabels = req.purposes.map((purpose) => PURPOSE_LABELS[purpose]).join('、');
    const departmentLabels = req.departments.map((department) => DEPARTMENT_LABELS[department]).join('、');
    const designDirectionKeywords = topKeywords(records, 4);
    const meaningfulKeywordCount = uniqueKeywords(records).length;
    const designDirectionRecords =
      meaningfulKeywordCount >= 3 ? records.filter((record) => recordHasAnyKeyword(record, designDirectionKeywords)) : [];

    return {
      company,
      designTrend: {
        domains: makeInsight({
          records,
          text:
            records.length === 0
              ? `${company}の該当サンプル意匠はありません。`
              : `${company}は${topDomains.join('、')}で意匠展開が相対的に多い傾向が見られ、${topClasses.join('、')}が確認できます。`,
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
              ? 'デジタルサービス接点を示すサンプルは限定的です。'
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
          records: findRecordsByTerms(uiRecords, UI_TERMS),
          fallbackRecords: uiRecords.length > 0 ? uiRecords : records,
          text:
            uiRecords.length === 0
              ? '画像意匠の該当がなく、UI変化は評価対象外です。'
              : `${topTerms(uiRecords, UI_TERMS).join('、')}を中心に、情報の比較・提案・通知を重視するUI変化が見られます。`,
          metric: metric('UI関連画像意匠件数', uiRecords.length, '件'),
        }),
      },
      portfolio: {
        focusAreas: makeInsight({
          records,
          text:
            topDomains.length === 0
              ? '集中領域は確認できません。'
              : `集中領域の参考候補は${topDomains.join('、')}です。${departmentLabels}向けには、この領域の継続監視が有効です。`,
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
              ? '意匠保護領域の検討材料はありません。'
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

function makeInsight({
  records,
  fallbackRecords = [],
  text,
  metric,
}: {
  records: DesignRecord[];
  fallbackRecords?: DesignRecord[];
  text: string;
  metric: InsightMetric;
}): AnalysisInsight {
  const evidenceSource = records.length > 0 ? records : metric.value > 0 ? fallbackRecords : [];
  const evidenceIds = evidenceSource.slice(0, 5).map((record) => record.id);

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
  return [...map.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ja-JP')).slice(0, limit);
}

function topLabels(map: Map<string, number>, limit: number): string[] {
  return topEntries(map, limit).map(([label]) => label);
}

function topCompanyLabels(records: DesignRecord[], limit: number): string[] {
  const namedCompanies = topLabels(countBy(records.filter((record) => !isUnresolvedParty(record.applicant)), (record) => record.applicant), limit);
  if (namedCompanies.length >= limit) return namedCompanies;

  const unresolvedCompanies = topLabels(countBy(records.filter((record) => isUnresolvedParty(record.applicant)), (record) => record.applicant), limit);
  return [...namedCompanies, ...unresolvedCompanies].slice(0, limit);
}

function isUnresolvedParty(value: string): boolean {
  return /^未解決コード:\s*\d{5,}$/i.test(value.trim()) || /^(code:)?\d{5,}$/i.test(value.trim());
}

function topKeywords(records: DesignRecord[], limit: number): string[] {
  return topLabels(countBy(records.flatMap((record) => [...record.keywords, ...record.designFeatures]).filter((value) => !isStopWord(value)), (value) => value), limit);
}

function uniqueKeywords(records: DesignRecord[]): string[] {
  return [...new Set(records.flatMap((record) => [...record.keywords, ...record.designFeatures]).filter((value) => !isStopWord(value)))];
}

function recordHasAnyKeyword(record: DesignRecord, keywords: string[]): boolean {
  const terms = [...record.keywords, ...record.designFeatures].filter((value) => !isStopWord(value));
  return keywords.some((keyword) => terms.includes(keyword));
}

function findRecordsByTerms(records: DesignRecord[], terms: string[]): DesignRecord[] {
  return records.filter((record) => {
    const haystack = [
      record.articleName,
      record.businessDomain,
      record.classLabel,
      record.summary,
      ...record.keywords,
      ...record.designFeatures,
    ].join(' ');
    return terms.some((term) => haystack.includes(term));
  });
}

function topTerms(records: DesignRecord[], terms: string[]): string[] {
  const counts = new Map<string, number>();
  for (const term of terms) {
    const count = findRecordsByTerms(records, [term]).length;
    if (count > 0) counts.set(term, count);
  }
  return topLabels(counts, 3);
}

function filterRecentMonths(records: DesignRecord[], dataAsOf: string, months: number): DesignRecord[] {
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
  recentRecords: DesignRecord[],
  olderRecords: DesignRecord[],
): string {
  if (totalCount === 0) return '画像意匠の傾向は判断できません。';
  const recentImage = recentRecords.filter((record) => record.designKind === 'image').length;
  const olderImage = olderRecords.filter((record) => record.designKind === 'image').length;
  const direction = recentImage >= olderImage ? '直近側でも確認できます' : '過去側の比重が高く見えます';
  return `画像意匠は${imageCount}件（${ratio(imageCount, totalCount)}%）で、${direction}。追加期間での確認が必要です。`;
}

function describeTermDirection(records: DesignRecord[], terms: string[], label: string): string {
  const matched = findRecordsByTerms(records, terms);
  if (matched.length === 0) return `${label}を示す明確な特徴語は限定的です。`;
  return `${label}では${topTerms(records, terms).join('、')}に関する特徴が見られます。`;
}

function describeStrengthening(recentRecords: DesignRecord[], olderRecords: DesignRecord[]): string {
  if (recentRecords.length === 0) return '直近1年で相対的に多い領域は確認できません。';
  const recentTop = topLabels(countBy(recentRecords, (record) => record.businessDomain), 2);
  const olderTop = topLabels(countBy(olderRecords, (record) => record.businessDomain), 2);
  const shifted = recentTop.filter((domain) => !olderTop.includes(domain));
  if (shifted.length > 0) {
    return `このデータ範囲では${shifted.join('、')}が相対的に多く確認できます。追加期間での確認が必要です。`;
  }
  return `直近1年でも${recentTop.join('、')}が参考傾向として確認できます。継続観察が必要です。`;
}

function whitespaceDomains(records: DesignRecord[]): string[] {
  const existing = new Set(records.map((record) => record.businessDomain));
  return DOMAIN_UNIVERSE.filter((domain) => !existing.has(domain));
}

function describeWhitespace(records: DesignRecord[]): string {
  const whitespace = whitespaceDomains(records);
  if (records.length === 0) return '対象データがないため、確認できない領域の参考候補は判断できません。';
  if (whitespace.length === 0) return 'このデータ範囲では主要候補領域を広く確認できます。確認できない領域の参考表示は控えています。';
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

export function countByDesignKind(records: DesignRecord[]): Record<DesignKind, number> {
  return {
    article: records.filter((record) => record.designKind === 'article').length,
    image: records.filter((record) => record.designKind === 'image').length,
    interior: records.filter((record) => record.designKind === 'interior').length,
  };
}

export function designKindSummary(records: DesignRecord[]): string {
  const counts = countByDesignKind(records);
  return Object.entries(counts)
    .map(([kind, count]) => `${DESIGN_KIND_LABELS[kind as DesignKind]} ${count}件`)
    .join(' / ');
}
