# AGENTS.md — KIRIKO Design Signals 作業規約（Codex向け）

> 「何を作るか」は `SPEC.md`、落とし穴は `GOTCHAS.md`。本書は **作り方・制約・完了条件**。

## 1. 役割と最優先原則

あなた（Codex）は本リポジトリの実装担当。以下を順守する。

1. **`SPEC.md` の現在版スコープを逸脱しない。** Web、プレス、新聞、株主総会、IR、商用データベース等の外部情報は実装しない。
2. **軽く・安く。** 静的ホスティングで動き、常時稼働の有料バックエンドに依存しない。
3. **現在版はルールベース分析で完結させる。** LLM連携、APIキー入力、`USE_LLM` 切替を実装しない。
4. **公開版は完全な架空サンプルだけにする。** 実データをGit、Preview、Production、公開ビルドへ含めない。
5. **断定しない。** 結果は将来予測、企業戦略の特定、法的判断ではなく、根拠付きの参考傾向として示す。
6. **まず6段階をend-to-endで通す。** 入力、分析、件数、根拠意匠の確認を完成させてから装飾やリファクタを行う。

## 2. 着手前にやること

1. リポジトリ直下、`package.json`、`pnpm-lock.yaml`、デプロイ設定を確認する。
2. 既存の画面、命名規約、ディレクトリ構成、Lint / Format設定に合わせる。
3. 最新の `origin/main`、Issue本文と最新コメント、既存PR、ローカルのbranch・差分・未追跡状態を確認する。
4. 既存PRを参考にする場合も無条件に取り込まず、対象Issueで承認された変更だけを移植・再実装する。
5. ネストした `AGENTS.md` がある場合は、より近い規約を優先する。競合は明示する。
6. 検出したスタックと採用方針を着手時に簡潔に報告する。

## 3. 現在のスタック

- Vite + React + TypeScript + Tailwind CSS
- Vitest
- `pnpm-lock.yaml` を正本とするpnpm運用
- TypeScript strict
- 単一画面の日本語UI
- GitHub Pages向けの相対 `base`
- Vercel Previewは確認環境であり、Productionとは区別する

重い状態管理、ルーティング、バックエンド、外部APIを追加しない。

## 4. ディレクトリ構成

```text
src/
  main.tsx
  App.tsx
  components/
    SettingsPanel/              # 1〜6の操作導線
    ResultsArea/                # 結論、件数、根拠意匠
    common/
  domain/
    types.ts                    # 型の単一の真実
    labels.ts                   # 日本語ラベル定数
    presets.ts                  # 推奨デモ条件
    selection.ts                # 自動設定と手動変更の判定
  data/
    sample-designs.json         # 完全な架空サンプル
    SampleDesignDataSource.ts
    LocalJpoJsonDataSource.ts   # Git管理外JSONのFile API読込
  analysis/
    AnalysisEngine.ts
    RuleBasedAnalysisEngine.ts
docs/demo/
  5min-demo-guide.md
  presentation-script.md
  current-vs-future.md
```

現在版では `LlmAnalysisEngine.ts`、LLM用設定、APIキー入力UI、`USE_LLM` フラグを作らない。将来の差し替え点は `AnalysisEngine` インターフェースに限定する。

## 5. 中核インターフェース

```ts
interface DesignDataSource {
  query(req: AnalysisRequest): Promise<DesignRecord[]>;
  getDataAsOf(): string;
  getAllRecords(): DesignRecord[];
}

interface AnalysisEngine {
  analyze(
    req: AnalysisRequest,
    records: DesignRecord[],
    dataAsOf: string,
  ): Promise<AnalysisResult>;
}
```

- `SampleDesignDataSource` は `dataAsOf`、期間、意匠種別、企業、業界・領域で架空サンプルを絞る。
- `LocalJpoJsonDataSource` は利用者がFile APIで手動選択したGit管理外JSONだけを変換する。
- `App` は現在版で常に `RuleBasedAnalysisEngine` を使う。
- `AnalysisResult.generatedBy` は型上 `'rules' | 'llm'` でも、現在版では常に `'rules'` を返す。

## 6. RuleBasedAnalysisEngine

乱数ではなく、入力レコードの集計と決定論的なルールで示唆を生成する。

- 各示唆は `title`、`text`、`evidenceIds`、`metric`、`confidence` を持つ。
- `evidenceIds` は根拠にした既存の `DesignRecord.id` だけを格納する。表示都合のIDを生成しない。
- 画面上の件数に対応する全レコードIDを保持し、表示件数と根拠意匠数を一致させる。
- `metric` は対象件数、画像意匠件数、該当件数、比率等の根拠値を持つ。
- `confidence` は内部データとして保持できるが、ユーザー向け画面に表示しない。
- 根拠がない示唆はユーザー向けに表示しない。
- 0件では断定せず、条件を見直す案内を表示する。
- 空白領域や増加傾向を、根拠レコードなしに事実として断定しない。
- departmentsが0件でも分析できる。選択されている場合だけ文言調整に使う。

## 7. UI実装の要点

### 7.1 製品名とメッセージ

- 製品名は **KIRIKO Design Signals** とする。
- 主メッセージは **「意匠情報から、市場・企業・商品化領域の先行シグナルを捉える」** とする。
- 初期画面で意匠と特許の時期を一般化して比較しない。
- 将来予測、企業戦略の特定、LLM実装済み、法的判断が可能と受け取られる表現を使わない。

### 7.2 6段階のDOM順序

JSX / DOMを次の順序にする。CSS `order` 等で見た目だけを並べ替えない。

1. 分析対象を決める — 市場全体、特定業界、特定企業
2. 見たい領域を決める — 選択肢とその他入力
3. 対象となる意匠情報を決める — 物品、画像、空間、全対象
4. 対象期間を決める — 直近1年、直近2年
5. 分析目的を選ぶ — 市場動向、商品化領域、企業動向、デザイン変化、画像意匠の動向
6. 結果と根拠を確認する

- 推奨プリセットを1クリックで適用できるようにする。
- 意匠種別は目的に応じて自動設定し、手動変更を許可する。自動・手動の状態を判別できるようにする。
- 出力部門は分析目的から自動設定するか、詳細設定内の任意項目とする。初回の必須入力にしない。
- 技術情報、データ読込、開発用設定、将来構想は折り畳む。
- 詳細設定を開かなくても架空サンプルで分析を完了できるようにする。
- 実行ボタンは「分析を開始」と表示し、「AI分析開始」は表示しない。

### 7.3 結果から根拠へ

分析完了直後は次の順序にする。

1. 今回の分析対象意匠数
2. 注目トレンド
3. 商品化領域のヒント
4. 企業動向
5. 必要に応じた追加分析

- 件数自体をクリック可能にし、対応する根拠意匠一覧へ絞り込む。
- 企業、分類、物品名、意匠種別等のランキング件数も同様に操作可能にする。
- 同じ目的の確認ボタンを重複配置しない。
- 根拠意匠には、取得できている範囲で企業名、物品名または用途、分類、登録番号、出願番号、公報番号、公報発行日、種別、情報源、説明、図面情報を表示する。
- 欠損値を推測・合成しない。画像本体や外部リンクが未接続なら明示する。
- 技術フィールド名は折り畳み内へ置く。

## 8. データ・セキュリティ境界

- 公開fixtureとPreviewは完全な架空データだけを使う。
- 実データ、実在番号、画像、公報原本、顧客固有情報、認証情報をGit、Issue、PR、CIログ、Preview、スクリーンショットへ含めない。
- 限定検証では、利用承認されたGit管理外JSONをFile APIで手動選択する。
- ローカルJSONはブラウザのメモリ上だけで扱い、localStorage、IndexedDB、`public`、`dist`へ保存しない。
- デモ終了後の保存・削除方針を別途確認する。
- 実データ配備状態は `BLOCKED_REAL_DATA_DEPLOY` のまま維持する。
- 本IssueでBackend、API、DB、GCP、Productionを変更しない。

## 9. コーディング規約

- TypeScript strict。`any` を避け、`src/domain/types.ts` を型の単一の真実とする。
- 関数・コンポーネントは小さくし、ドメインロジックをUIから分離する。
- 日本語文言は `domain/labels.ts` 等へ集約する。
- コメントは日本語で要点だけを書く。
- 実在の製品画像、企業ロゴ、権利処理が必要な素材を同梱しない。
- 既存のレコードIDと取得値を保持し、表示都合で公式情報らしい値を生成しない。

## 10. Definition of Done

- [ ] `pnpm install --frozen-lockfile` が成功する。
- [ ] `pnpm run lint`、`pnpm run typecheck`、`pnpm run test`、`pnpm run check:no-real-data`、`pnpm run build` が成功する。
- [ ] `RuleBasedAnalysisEngine` と各データソースでAPIキー・LLMなしに分析できる。
- [ ] 製品名と主メッセージが現在方針に統一されている。
- [ ] 1から6の画面順序とDOM順序が一致し、CSSで並べ替えていない。
- [ ] 市場全体、特定業界、特定企業が動作する。
- [ ] 見たい領域を選択または入力できる。
- [ ] 分析目的による意匠種別の自動設定と、手動変更後の保持が動作する。
- [ ] 出力部門を入力しなくても分析できる。
- [ ] ユーザー向け画面に「信頼度」と「AI分析開始」を表示しない。
- [ ] 分析対象意匠数、主要結果、ランキングの件数から対応する根拠意匠へ移動できる。
- [ ] 表示件数と根拠意匠数が一致し、重複した確認ボタンがない。
- [ ] 0件時に安全な案内を表示し、根拠のない示唆を表示しない。
- [ ] 根拠意匠の主要情報を表示し、欠損値を推測・合成しない。
- [ ] 架空サンプルモードとローカルJSON読込モードが回帰している。
- [ ] 公開ビルドに実データ、秘密情報、顧客固有情報を含めない。
- [ ] 技術情報と将来構想が初期画面の主メッセージより前面に出ていない。
- [ ] 5分デモ文書と画面が一致する。
- [ ] PC、モバイル、キーボードで5分デモを完走でき、コンソールエラーがない。
- [ ] PreviewがDraft PRの最新head SHAに対応し、Productionを変更していない。

## 11. やってはいけないこと

- ❌ LLM連携、APIキー入力、`USE_LLM` 切替を実装する。
- ❌ J-PlatPatのWeb UIを自動取得・スクレイピングする。
- ❌ 実在の製品意匠画像、企業ロゴ、実データをリポジトリへ含める。
- ❌ APIキー、トークン、パスワード、接続情報をコードや公開設定へ記載する。
- ❌ Web、プレス、新聞、株主総会、IR等の外部情報取得を実装する。
- ❌ 一括データ処理をブラウザ内で行う。
- ❌ Backend、Contract、DB、GCP、Productionを変更する。
- ❌ リポジトリ名、Vercelプロジェクト名、ドメインを変更する。
- ❌ 将来構想を現在の機能として表示する。
- ❌ スコープ外機能、重い依存、常時稼働の有料バックエンドを追加する。

## 12. 進め方

1. 最新main、Issue、コメント、既存PR、worktreeの状態を確認する。
2. 既存PRはread-onlyの参考とし、承認済みの内容だけを現在のmainへ再実装する。
3. 型、ラベル、プリセット、自動選択を整える。
4. 架空サンプルの整合性と、全プリセットが0件にならないことを確認する。
5. 1から6の入力UIとバリデーションを実装する。
6. 結果を所定の順序で表示し、件数から根拠意匠への絞り込みを実装する。
7. 用語、注意表示、5分デモ文書を画面と一致させる。
8. 必須コマンドとブラウザのPC・モバイル・キーボード検証を行う。
9. 架空データ境界、Backend / GCP / Production非変更を確認する。
10. Draft PRを作成し、レビュー前に次フェーズへ進まない。

## 13. GitHubを正本とする開発運用

製品実装規約に加え、次のGitHub運用を恒久ルールとする。詳細は`docs/development/github-workflow.md`を参照する。

1. Codexへの正式な作業指示はGitHub Issue本文と最新コメントを正本とする。
2. 作業開始前に、GitHub上の最新main、Issue、最新コメント、既存PRと、ローカルのbranch・差分・未追跡状態を確認する。
3. 原則として1 Issueにつき1専用ブランチ、1 Draft PRとし、最新`origin/main`から`codex/issue-<issue-number>-<short-description>`形式のブランチを作る。
4. Draft PR本文の先頭付近に`Refs #<issue-number>`を記載し、試運転中は`Closes`でIssueを自動クローズしない。
5. PRコメントとレビューコメントをGitHubから直接読み、未解決のactionableな指摘を作業キューとして扱う。曖昧・競合・範囲外の指摘は推測で実装せず、PRで確認する。
6. 新しいコミットをpushした場合は、最新head SHAと対応する検証、CI、Previewだけを現在の根拠とし、古いSHAの結果を流用しない。
7. Vercel Previewは確認環境であり、Production反映ではない。Draft解除、mainへのマージ、Productionのdeploy・promote・rollbackは、それぞれユーザーの明示承認を必要とする。
8. ChatGPTのレビュー完了や推奨を、Draft解除、mainへのマージ、Production反映の承認と解釈しない。
9. `pnpm-lock.yaml`を尊重し、依存導入と検証にはpnpmを使う。通常の検証はlint、typecheck、test、`check:no-real-data`、buildを含める。
10. 混在worktreeでは`git add -A`を使わず、Issue対象パスだけを明示してステージする。`deliverables/`、`output/`、`local-data/`、実データ、秘密情報、認証情報をステージしない。
11. 公開Issue、PR、コメント、ログには、ローカル未追跡物の個別ファイル名、内容、絶対パスを記載しない。報告はディレクトリ名と件数に限定する。
12. すべての進捗更新と最終報告に「現在の状態」と「次のアクション」を含める。
13. ChatGPTがIssueを作成・更新する場合は、作業の合意状態に応じて次の2経路を使い分ける。
    - 合意済みの作業: GitHubへ書き込む直前に対象リポジトリと実施内容を短く明示し、Issueを直接作成・更新できる。
    - 未合意、仕様が曖昧、または影響が大きい作業: Issueタイトルと本文の最新版全文をユーザーへ提示し、明示承認後に作成・更新する。
14. ユーザーがコピーして使う文章は差分指示ではなく、そのまま全置換できる最新版全文を提示する。GitHubへ直接反映できる場合は、上記の合意状態に応じた経路で直接反映する。
