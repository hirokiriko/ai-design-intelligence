# AGENTS.md — AI Design Intelligence 作業規約（Codex向け）

> 「何を作るか」は `SPEC.md`、落とし穴は `GOTCHAS.md`。本書は **作り方・制約・完了条件**。

## 1. 役割と最優先原則
あなた（Codex）は本リポジトリの実装担当。以下を順守する。
1. **`SPEC.md` §2 のスコープを逸脱しない。** 機能を勝手に増やさない。WEB/プレス/新聞/株主総会は実装せず「準備中」固定。
2. **軽く・安く。** 静的ホスティング（GitHub Pages）で動き、常時稼働の有料バックエンドに依存しない。
3. **Phase 0 はルールベース分析で完結させる。** LLM連携、APIキー入力、`USE_LLM` による切替は実装しない。
4. **まず動くものを通しで。** Phase 0 を end-to-end で完成させてからリファクタや装飾に進む。
5. **既存資産（GENBA Search）に追従する。** ただし、現在のリポジトリに既存コードが無い場合は推奨スタックを採用する。

## 2. 着手前にやること（既存リポの調査）
本プロジェクトは GENBA Search を beachhead に拡張する想定。**新スタックを独断で導入しない。**
1. リポジトリ直下と `package.json`（または同等）を確認し、既存の言語・ビルドツール・デプロイ設定（GitHub Pages 設定、`base` パス等）を把握する。
2. 既存の画面、命名規約、ディレクトリ構成、Lint/Format 設定に合わせる。
3. **既存スタックが判明した場合はそれに従う。** 不明・新規の場合のみ、下記「推奨スタック」を採用する。
4. 既存の `AGENTS.md` が別に存在する場合は上書きせず、既存規約と本書の規約を統合する。競合がある場合は、ユーザーに確認する前に競合箇所を明示する。
5. 着手前に、検出したスタックと採用方針を1段落で要約し、必要に応じて `AGENTS.local.md` に記録（人間レビュー用）。ただし、ユーザーが成果物を限定している場合は、その指示を優先する。

## 3. 推奨スタック（新規・フォールバック時のみ）
- **Vite + React + TypeScript + Tailwind CSS**（静的ビルド）。
- 状態管理は React の `useState`/`useReducer` で十分。重いライブラリは入れない。
- 多言語不要（日本語のみ）。アイコンが必要なら軽量なものを最小限。
- ルーティング不要（単一画面）。
- GitHub Pages 配布を前提に、Vite の `base` はリポジトリ名配下デプロイに耐える設定にする。

## 4. ディレクトリ構成（目安）
```
src/
  main.tsx
  App.tsx
  components/
    SettingsPanel/              # ①〜⑤ の入力UI
    ResultsArea/                # 企業別カード / 市場ビュー
    common/                     # バッジ(準備中)、カード等
  domain/
    types.ts                    # SPEC §4 の型をそのまま定義
    labels.ts                   # 日本語ラベル定数
  data/
    sample-designs.json         # dataAsOf + サンプル意匠データ（SPEC §5）
    SampleDesignDataSource.ts
  analysis/
    AnalysisEngine.ts           # interface
    RuleBasedAnalysisEngine.ts  # 既定（無料・決定論的）
```

Phase 0 では `LlmAnalysisEngine.ts`、LLM用設定、APIキー入力UI、`USE_LLM` フラグを作らない。将来の差し替え点は `AnalysisEngine` インターフェースに限定する。

## 5. 中核インターフェース（厳守）
SPEC §4 の型に対し、データ取得と分析を**抽象化**する。差し替え可能にすることで Phase 1（実データ）や将来の LLM を後付けできる。

```ts
// データソース：リクエスト条件で意匠レコードを返す
interface DesignDataSource {
  query(req: AnalysisRequest): Promise<DesignRecord[]>;
}
// Phase 0: SampleDesignDataSource … bundled JSON を dataAsOf/designKinds/period/companies/productDomain で絞る
// Phase 1: JpoBulkDataSource      … 一括DLデータからオフラインまたはビルド処理で生成した軽量データを読む
//          JpoApiEnricher         … 出願番号ベースで特許情報取得APIから補完する場合のみ検討

// 分析エンジン：レコード集合 → 構造化された戦略示唆
interface AnalysisEngine {
  analyze(req: AnalysisRequest, records: DesignRecord[], dataAsOf: string): Promise<AnalysisResult>;
}
// Phase 0既定: RuleBasedAnalysisEngine … 集計＋テンプレートで決定論的に AnalysisResult を生成
// 将来拡張:    LLM実装を追加する場合も AnalysisEngine を満たし、generatedBy: 'llm' を返す
```

`App` は Phase 0 では常に `RuleBasedAnalysisEngine` を使う。`AnalysisResult.generatedBy` は `'rules' | 'llm'` だが、Phase 0 の値は常に `'rules'`。

## 6. RuleBasedAnalysisEngine の作り方（重要）
LLM なしでも「それらしく有用な」戦略示唆を返すこと。乱数ではなく **レコードからの集計＋ルール** で導出する。例：
- `designTrend.domains` … 対象企業・期間で件数の多い `businessDomain`/`designClass`/`articleName` 上位。
- `dxDevTrend.imageDesignGrowth` … `designKind === 'image'` の件数比・期間差分から文章化。
- `designChange.uiChange` … 画像意匠の `articleName`/`summary`/`keywords`/`designFeatures` の傾向から文章化。
- `portfolio.focusAreas / strengthening / whitespace` … 分類別件数の集中/増加/空白から導出。
- `ipStrategy.*` … 集中・空白領域と選択 `departments`/`purposes` に応じた定型テンプレへ差し込み。
- 各示唆は必ず `text`、`evidenceIds`、`metric`、`confidence` を持つ `AnalysisInsight` として返す。
- `evidenceIds` は各示唆の根拠にした `DesignRecord.id` を格納する。
- `metric` は件数、比率、増加件数など、示唆の根拠となる数値を入れる。
- `confidence` はレコード件数や根拠の厚みに応じて `low` / `medium` / `high` を決定する。
- 入力（企業・期間・種別・目的・部門）を変えると出力が**目に見えて変わる**こと（デモの説得力）。

## 7. LLM連携（Phase 0では実装しない）
Phase 0 では以下を実装しない。
- LLM API呼び出し。
- APIキー入力欄。
- APIキーの保存、読み込み、検証。
- `USE_LLM` などのフラグによるエンジン切替。
- LLM用プロンプト、レスポンスパーサ、フォールバック処理。

将来 LLM 連携を検討する場合も、静的サイトのキー管理、コスト、安全なJSON検証、利用規約を別途整理してから実装する。Phase 0 で残すのは `AnalysisEngine` インターフェースだけ。

## 8. UI実装の要点
- `SPEC.md` §3 の **①〜⑤ と結果カードの構造を1:1で再現**する（項目の追加・削除をしない）。
- 画面には **デモ用サンプルデータ** と **ルールベース分析** を常時表示する。
- Phase 0 の意匠情報ラベルは **デモ用意匠情報** に統一し、公的機関が直接提供する実データであるかのような表示にしない。
- 「準備中」項目は `disabled` ＋視覚的に淡色＋バッジ。クリックしても何も起きない。
- 「企業指定」選択時のみ企業名入力＋「＋追加」を表示。「全意匠分類」時は市場全体ビューを出す。
- バリデーション：企業指定時の企業0件、意匠種別0件、分析目的0件、出力部門0件はエラーにする。
- ローディング表示と、結果の段階表示（あれば）を用意する。
- レスポンシブ（PC優先で可。設定パネルと結果を縦積みできること）。

## 9. コーディング規約
- TypeScript strict。`any` を避ける。SPEC §4 の型を単一の真実とする。
- 関数・コンポーネントは小さく。ドメインロジック（集計・分析）は `analysis/` に集約し、UI と分離。
- 文言は日本語定数として `domain/labels.ts` 等に集約（①〜⑤やカード見出しのラベル）。
- コメントは日本語で要点のみ。
- 実在の製品画像・企業ロゴ・権利処理が必要な素材を同梱しない。

## 10. Definition of Done（Phase 0）
- [ ] `npm install && npm run build` が成功し、静的成果物が出力される。
- [ ] ローカルで `npm run dev`（または既存リポの同等コマンド）で全画面が動作。
- [ ] `RuleBasedAnalysisEngine` ＋ `SampleDesignDataSource` で **APIキー無し・LLM無し・オフライン**で分析結果が出る。
- [ ] LLM連携、APIキー入力、`USE_LLM` 切替が実装されていない。
- [ ] `AnalysisEngine` インターフェースは将来拡張点として存在する。
- [ ] `AnalysisResult.generatedBy` は `'rules' | 'llm'` 型で、Phase 0 では `'rules'` を返す。
- [ ] 「全意匠分類」と「企業指定（複数）」の両モードが動作し、出力が切り替わる。
- [ ] 企業指定時の企業0件、意匠種別0件、分析目的0件、出力部門0件がバリデーションエラーになる。
- [ ] 期間（1年/2年）は `sample-designs.json` の `dataAsOf` を基準に計算され、切替で結果が変化する。
- [ ] 各分析示唆が `evidenceIds`、`metric`、`confidence` を持つ。
- [ ] `DesignRecord` に `businessDomain`、`keywords`、`designFeatures`、`gazetteNumber`、`sourceLabel` がある。
- [ ] 「準備中」項目はすべて非活性で表示されている。
- [ ] 画面に「デモ用サンプルデータ」「ルールベース分析」が常時表示されている。
- [ ] 画面下部に「サンプルデータ／参考情報」注記がある。
- [ ] GitHub Pages 用の `base` パス等のデプロイ設定が既存リポ流儀で整っている。
- [ ] README に起動・ビルド・デプロイ手順を記載する。`USE_LLM` の切替方法は Phase 0 では記載しない。

## 11. やってはいけないこと（禁止事項）
- ❌ Phase 0 で LLM 連携、APIキー入力、`USE_LLM` 切替を実装する。
- ❌ J-PlatPat の Web UI を自動取得・自動スクレイピングする実装。
- ❌ 実在の製品意匠画像／企業ロゴをリポジトリに同梱する。
- ❌ APIキー・トークンをコードや公開設定にハードコードする。
- ❌ WEB/プレス/新聞/株主総会のデータ取得を実装する（準備中固定）。
- ❌ Phase 1 の一括データ処理をブラウザ内で実行する。
- ❌ スコープ外機能の追加、重い依存の導入、常時稼働の有料バックエンド前提の設計。

## 12. 進め方（Phase 0 実装手順）
1. 既存リポ調査 → スタック・Pages設定・既存画面の有無を確認。
2. 既存スタックが無ければ Vite + React + TypeScript + Tailwind CSS で最小構成を作る。
3. `domain/types.ts`・`labels.ts` を定義し、`generatedBy`、`AnalysisInsight`、拡張 `DesignRecord` を反映する。
4. `sample-designs.json` に `dataAsOf` と 30〜60件のサンプルを作成する。
5. `SampleDesignDataSource` で `dataAsOf` 基準の期間・企業・種別・領域フィルタを実装する。
6. `RuleBasedAnalysisEngine` を実装し、各示唆に `evidenceIds`、`metric`、`confidence` を付与する。
7. UI（設定パネル→結果エリア）を実装し、常時ラベル、準備中表示、バリデーションを配線する。
8. README、ビルド設定、GitHub Pages 設定を整える。
9. `npm install && npm run build`、`npm run dev`、DoD を確認する。
