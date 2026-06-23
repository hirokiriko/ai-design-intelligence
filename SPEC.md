# SPEC.md — AI Design Intelligence（意匠インテリジェンス）

## 0. このドキュメントの位置づけ
- 本書は **Codex（Coding Agent）向けの「何を作るか（プロダクト仕様）」**。
- 「どう作るか（作業規約・技術スタック・完了条件）」は `AGENTS.md`、実装上の落とし穴は `GOTCHAS.md` を参照。
- 出典：細江氏のコンセプト資料「AI Design Intelligence」＋ 2026年6月のメール指示。
- ベース資産：既存の **GENBA Search**（現場のことばで探す特許検索／静的GitHub Pagesデモ）を beachhead とする想定。ただし、実装前に必ず現在のリポジトリ構成を調査し、既存構成が存在する場合はそれに合わせて拡張する。

---

## 1. プロダクト概要

意匠情報を活用した **「先行商品戦略・知財戦略 支援AI分析アプリ」**。

従来の意匠検索（＝意匠出願前の「類似する先行意匠」チェック）とは **目的が根本的に異なる**。本アプリは、案件によっては特許の出願公開より早期に把握できる可能性がある意匠情報から、競合企業の **DX商品開発動向・デザイン変化・意匠ポートフォリオ** を読み取り、**商品企画／経営企画／研究開発／デザイン／知財** の各部門の意思決定を支援する。

- キャッチコピー：**「意匠情報を、先行商品戦略＆知財戦略へ活用」**
- 本質：*意匠を「検索」するのではなく、意匠情報から「読む」ためのアプリ*。

---

## 2. スコープ（依頼主＝細江氏の明確な指示。**最優先・逸脱禁止**）

メールでの指示を以下の4点に固定する。Codexはこの範囲を超えて機能を勝手に拡張しないこと。

1. **データソースは「意匠情報のみ」に限定する。**
   WEB情報・プレスリリース・新聞情報・株主総会情報は、利用許諾契約など法律面が重くなるため **実装しない**。
   → ただし UI 上には項目として**表示し、「準備中」ラベルで非活性（disabled）**にしておく（将来拡張の意思表示）。

2. **「軽く・費用も安く」。**
   静的ホスティング（GitHub Pages）で動き、ランニングコストがほぼゼロになる構成を最優先する。重いバックエンドや有料常時稼働サービスに依存しない。

3. **調査期間は「直近1〜2年」に特化する。**
   案件によっては特許の出願公開より早期に把握できる可能性がある意匠情報を活用し、最新動向の把握に振り切る。デフォルトは **直近1年**、オプションで **過去2年（トレンド分析）**。Phase 0 ではサンプルデータに設ける `dataAsOf` を基準日とし、直近1年・2年を計算する。

4. **目的は「商品化戦略・出願戦略の支援」。**
   出力は「類似意匠の列挙」ではなく、**戦略示唆（動向・変化・ポートフォリオ・知財コメント）** であること。

---

## 3. 画面仕様

単一画面のSPA。上段（または左カラム）に「分析設定パネル」、下段（または右カラム）に「分析結果エリア」。日本語UI・UTF-8。

### 3.0 ヘッダー
- アプリ名：**AI Design Intelligence**
- サブコピー：**意匠情報を、先行商品戦略＆知財戦略へ活用**
- 常時表示ラベル：**デモ用サンプルデータ**、**ルールベース分析**

### 3.1 分析設定パネル

**① 分析対象選択**
- **分析範囲**（ラジオ：いずれか1つ）
  - ○ **全意匠分類から分析（推奨）** … 市場全体の意匠動向／新商品領域／企業動向を分析
  - ○ **企業指定分析（オプション）**
    - 企業名入力（テキスト）＋「＋追加」ボタンで **複数企業を追加可能**
    - 複数企業のときは **企業別に分析結果を表示**
- **商品・事業領域**（テキスト）
  - placeholder 例：`家電 / 映像機器 / AI・IoT / 医療機器 等`

**② 対象期間**（ラジオ：いずれか1つ）
- ○ **最新意匠動向（直近1年）※推奨**（デフォルト選択）
- ○ 過去2年（トレンド分析）
- 補足テキスト：「案件によっては特許の出願公開より早期に把握できる可能性がある意匠情報を活用するため、最新動向を重視」

**③ 調査範囲**
- **意匠情報（現在利用）** … セクション見出し ☑ **デモ用意匠情報**
  - □ **物品意匠**（製品形状・外観デザイン）
  - □ **画像意匠**（アプリ起動用GUI・操作表示・バーチャル空間画面等）
  - □ **空間・内装意匠**（店舗・施設・空間デザイン等）
  - ※少なくとも1つは選択必須
- **企業公開情報（将来拡張）** … **全項目を非活性（disabled）＋「準備中」バッジ**
  - ■ WEB情報（準備中）
  - ■ 企業プレスリリース（準備中）
  - ■ 新聞情報（準備中）
  - ■ 株主総会情報・事業方針（準備中）
- 補足テキスト：「現在版ではデモ用意匠情報を中心にルールベース分析」

**④ 分析目的（複数選択可・チェックボックス）**
- □ 市場・商品トレンド分析
- □ 企業動向分析
- □ 競合意匠動向
- □ DX商品開発動向分析
- □ デザイン変化分析
- □ 画像意匠（UI）分析
- □ 意匠ポートフォリオ分析
- □ 出願戦略検討

**⑤ 出力部門選択（複数選択可・チェックボックス）**
- □ 経営企画 / □ 商品企画 / □ 技術企画 / □ 研究開発 / □ デザイン部門 / □ 知財部門
- ※選択部門に応じて、結果の言い回し・強調点を寄せる（例：知財部門→知財戦略コメントを厚く、デザイン部門→デザイン変化を厚く）

**［AI分析開始］ボタン** … 押下で結果エリアにローディング→結果表示。

**バリデーション**
- 企業指定分析を選択している場合、企業が0件ならエラー。
- 意匠種別が0件ならエラー。
- 分析目的が0件ならエラー。
- 出力部門が0件ならエラー。
- エラーがある場合は「AI分析開始」を実行せず、該当箇所に日本語で理由を表示する。

### 3.2 分析結果エリア

選択した分析範囲で出し分ける。

**企業別分析カード**（企業A、企業B … の単位で繰り返し）
- **意匠動向**：最近の意匠展開領域 ／ 形状変化 ／ デザイン方向
- **DX商品開発動向**：画像意匠の増加領域 ／ デジタルサービス展開 ／ AI・IoT関連傾向
- **デザイン変化分析**：大型化／小型化 ／ 薄型化 ／ 操作性変化 ／ UI変化
- **意匠ポートフォリオ分析**：集中領域 ／ 強化領域 ／ 未開拓領域
- **AI知財戦略コメント**：
  - 今後検討すべき **意匠保護領域**
  - 意匠出願戦略の方向性
  - 特許出願検討への参考情報
  - 商標保護検討への参考情報
  - 著作権保護検討への参考情報
- 各分析示唆には、文章だけでなく **evidenceIds**、**metric**、**confidence** を持たせる。
- （透明性のため）**参照した意匠ID** を併記する。

**市場全体ビュー**（「全意匠分類から分析」選択時のみ）
- 市場・商品トレンド ／ 新商品領域 ／ 企業動向
- 各示唆には evidenceIds、metric、confidence を持たせる。

### 3.3 フッター（アプリの考え方）
> 意匠を検索するだけではなく、意匠情報から企業のDX商品開発・市場変化・競合動向を読み、商品戦略・企画戦略・知財戦略へ活用するAI分析アプリ。

### 3.4 注意表示（常時）
- 出力は **デモ用サンプルデータ** と **ルールベース分析** による参考情報であり、法的助言ではない旨を画面下部に明記。
- 画面内に **デモ用サンプルデータ**、**ルールベース分析** の表示を常設し、実データ・LLM生成と誤認されないようにする。

---

## 4. データモデル（TypeScript 型として定義）

> 実装の中核となる型。`DesignDataSource` と `AnalysisEngine` のインターフェースは `AGENTS.md` を参照。

```ts
type DesignKind = 'article' | 'image' | 'interior';   // 物品 / 画像 / 内装
type Period = 'last_1y' | 'last_2y';                   // 直近1年 / 過去2年
type AnalysisPurpose =
  | 'market_trend' | 'company_trend' | 'competitor_design' | 'dx_dev'
  | 'design_change' | 'ui_design' | 'portfolio' | 'filing_strategy';
type Department =
  | 'mgmt_planning' | 'product_planning' | 'tech_planning'
  | 'rnd' | 'design' | 'ip';

interface SampleDesignDataset {
  dataAsOf: string;               // サンプルデータの基準日(ISO)。直近1年/2年計算はこの日付を基準にする
  records: DesignRecord[];
}

// 画面入力 → 分析リクエスト
interface AnalysisRequest {
  scope:
    | { mode: 'all_classes' }
    | { mode: 'companies'; companies: string[] };
  productDomain?: string;          // 商品・事業領域（自由入力）
  period: Period;                  // 既定: 'last_1y'
  designKinds: DesignKind[];       // article/image/interior から1つ以上
  purposes: AnalysisPurpose[];     // 1つ以上
  departments: Department[];       // 1つ以上
  // 注: WEB/プレス/新聞/株主総会は「準備中」につきリクエストに含めない
}

// 意匠1件（Phase 0 はサンプルデータ。実画像は使わない）
interface DesignRecord {
  id: string;
  registrationNumber?: string;     // 意匠登録番号
  applicationNumber?: string;      // 出願番号
  gazetteNumber?: string;          // 公報番号
  gazetteDate: string;             // 公報発行日(ISO) — 期間フィルタの対象フィールド
  applicant: string;               // 出願人 / 企業名
  businessDomain: string;          // 事業領域
  designKind: DesignKind;
  articleName: string;             // 物品名 / 用途
  designClass: string;             // 意匠分類（日本意匠分類 or ロカルノ）
  classLabel?: string;             // 分類の和名
  keywords: string[];              // 分析用キーワード
  designFeatures: string[];        // 形状・UI・空間などの特徴
  summary?: string;                // 創作の要点等（任意）
  imageRef?: string;               // 図のプレースホルダ参照（実画像は不可）
  sourceLabel: string;             // 例: デモ用意匠情報
  isSample: true;                  // サンプルデータ明示フラグ（Phase 0）
}

interface InsightMetric {
  label: string;                   // 例: 対象件数、画像意匠比率、増加件数
  value: number;
  unit?: string;                   // 例: 件、%
  comparison?: string;             // 例: dataAsOf基準の直近1年
}

interface AnalysisInsight {
  text: string;
  evidenceIds: string[];           // 根拠にした DesignRecord.id
  metric: InsightMetric;
  confidence: 'low' | 'medium' | 'high';
}

// 分析結果
interface CompanyAnalysis {
  company: string;
  designTrend:  { domains: AnalysisInsight; shapeChange: AnalysisInsight; designDirection: AnalysisInsight };
  dxDevTrend:   { imageDesignGrowth: AnalysisInsight; digitalService: AnalysisInsight; aiIotTrend: AnalysisInsight };
  designChange: { sizeTrend: AnalysisInsight; thinning: AnalysisInsight; usability: AnalysisInsight; uiChange: AnalysisInsight };
  portfolio:    { focusAreas: AnalysisInsight; strengthening: AnalysisInsight; whitespace: AnalysisInsight };
  ipStrategy: {
    designProtectionAreas: AnalysisInsight; // 検討すべき意匠保護領域
    designFilingDirection: AnalysisInsight; // 意匠出願戦略の方向性
    patentReference: AnalysisInsight;       // 特許出願検討への参考
    trademarkReference: AnalysisInsight;    // 商標保護検討への参考
    copyrightReference: AnalysisInsight;    // 著作権保護検討への参考
  };
}

interface MarketAnalysis {
  trends: AnalysisInsight;
  emergingDomains: AnalysisInsight;
  companyMoves: AnalysisInsight;
}

interface AnalysisResult {
  request: AnalysisRequest;
  dataAsOf: string;
  market?: MarketAnalysis;         // scope=all_classes のとき
  companies: CompanyAnalysis[];    // scope=companies、または全分類時の主要企業
  generatedBy: 'rules' | 'llm';
  disclaimer: string;              // サンプル/参考情報である旨
}
```

---

## 5. サンプルデータ要件（Phase 0）

- `src/data/sample-designs.json` に `dataAsOf` と `records` を持つ `SampleDesignDataset` を投入。
- `dataAsOf` はサンプルデータの基準日であり、直近1年・2年の期間計算は実行日ではなく `dataAsOf` を基準にする。
- `records` は **30〜60件**。
- カバレッジ：3種別（物品／画像／内装）をすべて含み、例として **家電・映像機器 / AI・IoT / 医療機器** の3領域程度。
- 企業は **3〜5社**（実在社名を避け「企業A／企業B…」等の明示サンプル名を推奨）。
- `gazetteDate` は `dataAsOf` から見て **直近約24か月**に分布させ、期間フィルタ（1年/2年）の差が出るようにする。
- 図（imageRef）は **実製品画像を使わない**。簡易プレースホルダ or 自作の抽象図のみ（著作権・権利関係の回避）。
- 全レコードに `businessDomain`、`keywords`、`designFeatures`、`gazetteNumber`、`sourceLabel`、`isSample: true` を持たせる。
- `sourceLabel` は Phase 0 では **デモ用意匠情報** とする。

---

## 6. フェーズ計画

- **Phase 0（今回のゴール／MVP・ルールベースデモ再構築）**
  - 上記UIを完全実装。`SampleDesignDataSource` ＋ `RuleBasedAnalysisEngine` で **無料・オフライン・静的** に最後まで動く。
  - Phase 0 では LLM連携、APIキー入力、`USE_LLM` による切替を実装しない。
  - `AnalysisEngine` インターフェースだけを将来拡張点として残す。
  - `AnalysisResult.generatedBy` は Phase 0 では常に `'rules'`。
  - GitHub Pages にデプロイ可能な状態。完了条件は `AGENTS.md` の Definition of Done を参照。
- **Phase 1（実データ・後日）**
  - `JpoBulkDataSource`：特許庁の **特許情報標準データ／一括ダウンロード** から意匠公報を取り込み、分類・企業・公報発行日で横断検索可能な軽量データを生成する。
  - Phase 1 の一括データ処理はブラウザ内で行わず、オフライン処理またはビルド処理で軽量データを生成し、静的サイトから読み込む構成にする。
  - `JpoApiEnricher`：取得済み出願番号を **特許情報取得API**（要・利用者登録、日次アクセス上限あり）で補完する場合に検討する。
  - 注意点・制約は `GOTCHAS.md` を参照。
- **Phase 2（将来拡張）**
  - WEB／プレス／新聞／株主総会のデータソース（**準備中の項目を活性化**）。利用許諾・著作権の整理が前提。
  - LLM連携は、コスト・キー管理・利用規約・安全な出力検証の方針が固まってから検討する。
