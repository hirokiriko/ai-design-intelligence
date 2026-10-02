# SPEC.md — KIRIKO Design Signals

> 現行の製品定義の正本は§1。画面とAPIの技術仕様は[Signal UI実装](docs/architecture/signal-ui.md)を参照する。§2〜6は従来の`standard`画面、§7は初期の移行設計の履歴であり、現在の`signals`画面を禁止・制限する仕様として重ねて適用しない。

## 0. このドキュメントの位置づけ
- §1は実装の判断基準となる恒久的な製品定義。§2〜6は旧Phase 0の動作仕様・当時の拡張計画を保持し、§7と[Frontend移行設計](docs/architecture/google-cloud-frontend.md)は初期設計の経緯として参照する。
- 目指す価値、このbranchにある実装、検証したデータ・モード、実際の公開版を区別する。最新の候補SHA、検証結果、未達、公開状態は対応するGitHub IssueとPRを正本とし、本書の更新を実装・受入・公開の完了と扱わない。
- 本書は **Codex（Coding Agent）向けの「何を作るか（プロダクト仕様）」**。
- 「どう作るか（作業規約・技術スタック・完了条件）」は `AGENTS.md`、実装上の落とし穴は `GOTCHAS.md` を参照。
- 出典：細江氏のコンセプト資料「AI Design Intelligence」＋ 2026年6月のメール指示。
- ベース資産：既存の **GENBA Search**（現場のことばで探す特許検索／静的GitHub Pagesデモ）を beachhead とする想定。ただし、実装前に必ず現在のリポジトリ構成を調査し、既存構成が存在する場合はそれに合わせて拡張する。

---

## 1. 現行製品定義

### 1.1 対象利用者と解決する仕事

KIRIKO Design Signalsは、競合企業・商品分野の動向を調べて企画・開発へ伝える担当者の、資料探し、意匠の整理、変化の確認、企業情報との照合、社内説明を支援する。初期の代表利用者は知財担当者であり、商品企画・経営企画・デザイン・研究開発へ検討材料を提供する仕事を含む。

意匠情報を軸に「どの企業・商品領域の、どの動きを詳しく見るべきか」を見つけ、具体的な意匠・画像・企業公式情報を根拠として確かめ、次の企画検討につなげる。

### 1.2 提供を目指す3つの価値

1. **俯瞰から根拠へ進める。** 収録されている企業・商品分野の注目点を把握し、個別の意匠と根拠に掘り下げる。
2. **意匠と企業公式情報を照合できる。** 画像の観察と企業が発表した商品・事業の情報を確認し、事実、関連仮説、対応が未確認のものを区別する。
3. **同じ対象を継続して追える。** 登録入力の更新後に別の結果を保存し、過去の根拠・日付・結果へ戻って比較する。

評価するのは「競合調査の手間が減った」「詳しく見るべき動きが分かった」「根拠付きで社内説明に使えた」かである。AI要約、画像比較、グラフの存在だけで価値が実証されたとは扱わず、精度・工数削減率・売上効果を未実測で宣伝しない。

### 1.3 画面と結果の判断基準

画面は「対象と今回分かったこと → 画像と観察 → 企業公式発表 → 検討材料と未確認事項 → 必要時に開く収録・処理の詳細」の順で、利用者が結論から根拠へ進めるようにする。登録済みの企業・商品分野を分かる名称で示し、選定した収録範囲と件数の限界を結論の近くに短く残す。

書誌情報だけの比較は画像・記事分析が未実施と分かる表示にする。入力がなく未実施、取得失敗、分析したが判断不能、変化なしを分け、保存された結果から判断できない状態を推測しない。個別意匠と商品の直接対応が未確認でも、確認できた画像観察、独立した公式発表、商品分野の関連はそれぞれ根拠とともに示す。

保存結果の閲覧・履歴・再読込でAIや資料取得を再実行しない。新しい入力による実行は明示操作で別結果として保存し、過去の結果の意味・対象・日付を後から変更しない。技術上の契約と操作は[Signal UI実装](docs/architecture/signal-ui.md)で定める。

### 1.4 製品の境界と完成判定

正式な意匠調査、類否・侵害・登録可能性の判断、企業戦略や未発表商品の断定はしない。画像2枚の比較は根拠確認の一部であり、特定企業専用の処理や固定回答で製品全体を代替しない。未収録の企業・分野を利用可能と見せず、選定した母集団から市場全体や当時の先行予測を主張しない。

文書整合、機能実装・架空統合、実資料での価値実証、利用者本人の業務評価、本番リリースは別々に判定する。技術的な正常終了や書誌限定の保存成功を、画像観察・公式情報照合による価値の達成と数えない。資料不足・変化なしは正しい個別結果として残し、肯定的な仮説を必須にしない。

変更ごとに、解決する利用者の問い、対応Issue、画面・実行結果の証拠、未達の価値を対応付ける。実資料による根拠確認と、本人が対象・変化・公式発表・関係の確かさ・次の確認事項を説明できるかの評価を、架空試験と分けて記録する。初回1ケースの受入を、他社・全分野への対応や商用優位性の証明へ拡張しない。

---

## 2. Phase 0のスコープ（当初指示・サンプル動作で維持）

以下は従来の`standard`画面に適用する当初の指示である。現在の`signals`画面は§1と対応Issue・技術仕様に従い、旧画面の動作を保つ。

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

## 3. Phase 0の画面仕様（standard）

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

## 4. Phase 0のデータモデル（standardのTypeScript型）

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

## 6. 当初のフェーズ計画（履歴・Phase 0の動作を保持）

- **Phase 0（当初のゴール／MVP・ルールベースデモ再構築）**
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

## 7. Google Cloud移行の初期設計（Issue #15時点の履歴）

以下は2026-09-19の[Issue #15](https://github.com/hirokiriko/ai-design-intelligence/issues/15)に基づく初期設計の記録であり、当時の未実装・対象外・文書のみという記述を現在の状態へ読み替えない。初回HTML1件案と実装範囲は後続Issueで更新されている。現在の製品定義は§1、実装の契約は[Signal UI実装](docs/architecture/signal-ui.md)を参照する。費用を抑える原則、データと秘密情報の公開混入禁止、決定的分析の維持は継続する。

### 7.1 基盤と責務

- 画面・API・DB・保存ファイル・主要処理をGoogle Cloud上で完結させ、ローカルPC停止時も利用可能にする。新しい正式URLに自動期限や失効を設けない。
- Vite/Reactを維持し、Cloud Runの同一originでSPAとAPIを配信する案を第一案とする。Cloud SQL for PostgreSQL、Cloud Storage、Vertex AI上のGeminiへはBackendだけがアクセスする。
- Frontendは利用者認証を経由したAPIを呼び、検証できる結果を表示する。Google APIのservice account認証は利用者認証と別であり、移行後の画面とAPIの双方で利用者認証を維持する。
- ローカルADC／Cloud Run service account + IAMをBackendで使用し、APIキー入力・保存UIやSA JSON keyのブラウザ配布は行わない。

### 7.2 既存分析と補足結果の境界

- `RuleBasedAnalysisEngine`による件数・条件・根拠ID・品質判定を維持する。Draft系列のContract Adapter、stable ID、accepted-only分析は統合対象だが、現main実装とは区別する。
- Contract `0.1.0`に公式URL・AI結果・画像binaryを追加しない。補足結果は別のversioned DTOとしてBackendと契約し、構造・参照ID・表示可能な出典URLを検証する。具体的なendpoint・DTO field・schema versionは後続の契約Issueで確定する。
- ルール分析の`generatedBy: 'rules'`を維持し、Geminiは独立した補足結果として表示する。AI失敗時は補足の失敗・未生成を表示し、既存結果は利用可能にする。
- 「デザイン変化」は現時点では特徴語・件数の分析、図面はmetadata表示である。画像比較や画像AIを実装済みとしない。

### 7.3 初回Vertical Sliceの画面導線

1企業・1商品分野の既存シグナルと、承認済みの固定ケースで指定した企業公式HTML1件を照合する。初回は任意URL入力UIを必要としない。導線は「既存結果 → 明示的な照合実行 → 結果と根拠の確認 → 保存結果の再表示」に限定する。

結果では、意匠データ上の事実、公式発表の事実、AI仮説、不明点を分離する。出典URL、公開日（不明なら不明）、取得日、分析日とstable evidence IDを区別し、根拠意匠へ戻れるようにする。AI仮説を企業の確定戦略や法的判断と表示しない。画像を入力しない初回機能で「部位の変化をAIが確認した」と表示しない。

保存済み結果の再表示は認証されたAPIから保存内容を取得し、AIの再実行を伴わない。再実行を将来設ける場合も、通常の表示・reloadと別の明示操作として契約する。取得HTMLやAI応答を生HTMLとして挿入せず、表示用DTOとして検証する。

自動Web検索、複数媒体、画像比較、chat UI、複数モデル切替、ダッシュボード刷新、定期監視、レポート配信は対象外。このIssueでは画面コードを変更せず、「準備中」も解除しない。

### 7.4 完了の区別

本Issueの完了は文書設計・Draft PR・指定検証まで。クラウド作成、実装、デプロイ、実データ配備、利用者認証の変更、既存PR統合は未実施。正式公開の受入は[移行条件](docs/architecture/google-cloud-frontend.md#移行の受入と旧経路の停止条件)に従い、設計完了と公開完了を分けて報告する。
