# KIRIKO Design Signals

競合企業・商品分野の動向を調べる担当者の、資料探し、意匠の整理、変化の確認、企業情報との照合、社内説明を支援します。初期の代表利用者は知財担当者で、企画・開発部門へ根拠のある検討材料を届ける仕事を対象にします。

提供を目指す価値は、企業・商品分野の俯瞰から個別根拠へ進めること、意匠の観察と企業公式情報を照合できること、同じ対象を更新後も追い過去の根拠と結果へ戻れることです。製品定義と評価基準の正本は[SPEC §1](SPEC.md#1-現行製品定義)です。

Vite / React / TypeScript のSPAで、保存条件→差分→画像観察候補→登録公式資料→根拠付きシグナル→保存履歴の画面を、同一originのBackend APIへ接続する構成です。

`VITE_APP_MODE=signals`で新しい画面、未指定または`standard`で従来のサンプル・Contract・ルール分析を起動します。利用者認証、永続保存、実行権限、予算、AI呼出、公式サイトの有限探索はBackendが担当します。FrontendへAPIキーやGoogle credentialを設定しません。

保存結果だけを公開する閲覧用ビルドでは、`VITE_APP_MODE=signals` と `VITE_SIGNALS_READ_ONLY=true` を指定します。この設定では分析開始・再分析・条件作成を表示せず、保存結果・図面・出典・履歴のGETを使います。未指定の通常ビルドは明示的な開始操作を保ちます。これは画面の機能設定で、Backendの受付状態を推測するものではありません。閲覧用の配信先でも書き込みAPIを拒否してください。

このbranchの技術仕様は[Signal UI実装](docs/architecture/signal-ui.md)を参照してください。目指す価値、実装、検証したデータ・モード、実際の公開版は別の状態です。最新の候補SHA・証拠・未達・公開状態は対応するGitHub IssueとPRで確認し、文書やビルドの存在を実資料での価値実証・公開完了とは扱いません。

## 製品紹介LP

`/lp/` に独立した製品紹介ページがあります。`pnpm install --frozen-lockfile` 後に `pnpm run dev` を起動し、表示されたローカルURLの末尾へ `/lp/` を付けて開きます。既存アプリの `/` と `VITE_APP_MODE` は変更しません。

LPは「Design Signals」名義で、企業の知財・企画・開発が抱える資料整理、公式情報との照合、前回比較、社内説明の仕事を紹介します。出典付き公報図面2点の確認・拡大、公式情報と次の調査への切替、FAQ、相談フォームを用意しています。実AI・Backend・外部資料の新規取得は呼び出しません。

公報図面は、2026-10-25にユーザーが公開リポジトリ・Previewへの掲載を明示承認したヘアドライヤーの正面図2点に限定します。出典・公報日・公報記載の出願人と原図の同一性は[src/landing/assets/README.md](src/landing/assets/README.md)に記録しています。過去の保存AI結果や実行記録は含まず、掲載企業との直接の製品対応や導入・推奨を主張しません。

相談フォームは入力内容を確認した後、`h.sato@kiriko.tech` 宛の本文付きメールを利用者のメールアプリで開きます。最終送信はメールアプリで行います。コピーの代替操作も利用できます。サーバーからのメール送信、入力内容の保存、送信成功の仮表示は行いません。

訴求は現行SPEC §1に合わせ、企業・商品分野の俯瞰、意匠画像と企業公式情報の照合、同じ対象の継続追跡を軸にしています。意匠調査ワークベンチとは、動向把握と企画説明／案件調査の記録と引渡しという仕事の中心を比較します。製品設計上の価値を説明するもので、実資料での効果実証や一般提供の完了を示すものではありません。

`pnpm run build` は既存アプリと `dist/lp/index.html` を同時に出力します。相対アセット参照を維持しているため、リポジトリ名配下の静的配置にも対応します。公開・Production反映は別承認です。

## 従来のstandard画面の方針（Phase 0）

- Vite + React + TypeScript + Tailwind CSS
- GitHub Pages 向け `base: './'`
- デモ用サンプルデータのみ
- RuleBasedAnalysisEngine によるルールベース分析
- LLM、外部API、バックエンド、スクレイピングは未接続

## 従来のサンプル公開URL版（standard）

公開URLで共有する版は、`src/data/sample-designs.json` のサンプルデータだけで動作します。

- 公開URL版はサンプルデータ版です
- サンプルはすべて架空データです
- 実在企業名、実在登録番号、実在出願番号、公報XML由来データ、画像ファイル名は含めません
- 特許庁実データを用いた検証版はローカル検証版として扱い、必要な場合は画面共有で説明します
- 公報・図面画像本体と外部リンクは未接続です
- 分析結果は参考情報であり、法的助言ではありません

## 従来のサンプル版を説明する際の運用

サンプル公開URLは画面イメージの確認用です。実データを使う検証や外部説明は、その資料の利用範囲と対応Issueの承認に従い、サンプル版の動作確認と区別します。

## 開発運用

ChatGPT、Codex、ユーザー間の開発は、GitHub Issue、Draft Pull Request、PRコメントを正本として進めます。役割分担、最短メッセージ、CI・Preview・Productionの境界は[GitHubを正本とする開発運用](docs/development/github-workflow.md)を参照してください。

## コマンド

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run check:no-real-data
pnpm run build
pnpm run dev
```

## 従来のstandard画面のVercelデプロイ

Vercel は `vercel.json` に従い、pnpm の固定ロックファイルで `pnpm run build` を実行して `dist` を配信します。全パスはルートの `middleware.ts` で HTTP Basic 認証を必須にしています。

Vercel の Preview と Production の両環境へ、次の値を暗号化された環境変数として設定してください。実値はリポジトリや `VITE_*` 変数へ保存しません。

- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD`

認証情報を変更した後は再デプロイし、リダイレクトを追従しないHTTP検査で「未認証 401・誤認証 401・正しい認証 200」を確認します。

## 従来のstandard画面とDB取込構成（履歴）

Phase 0 は静的SPAとして動作し、DB・バックエンド・外部APIには接続しません。

将来のバックエンドまたはオフライン取込処理では、DB 名を `AI意匠ver2_DB` として管理する予定です。DB 側プロジェクトは、ローカルでは app と同じ親フォルダにある `../特許ダウンロード手順_0` を参照します。

DB 側の引継ぎ資料は `../特許ダウンロード手順_0/AGENT_ASSIGNMENT_BRIEF.md` です。特許庁一括ダウンロードデータの実作業領域はローカルDB側で管理し、元データは app リポジトリと Git 管理外として扱います。

ローカル設定の雛形は `.env.example` に置いています。DB 接続情報や認証情報はブラウザへ公開される `VITE_*` 変数に入れないでください。

## standard画面のローカル実データJSON読込（開発用）

公開デモの既定は、従来どおり `src/data/sample-designs.json` のデモ用サンプルデータです。実データは app リポジトリへコピーせず、`src/data`、`public`、`dist`、Git管理下には置きません。

開発時だけ、画面左側の「ローカル実データJSONを読み込む（開発用）」から DB 側で生成済みの統合JSONを選択します。ブラウザの File API で読み込み、データはメモリ上だけで保持します。localStorage、IndexedDB、public 配下への保存は行いません。

読込対象は、DB 側で生成した日次・週次・月次プレビューの統合JSONです。具体的な保存場所やファイル名はローカル環境側で管理し、app リポジトリには記載・同梱しません。

読み込んだ実データは `LocalJpoJsonDataSource` で既存の `DesignRecord` に変換し、既存の `RuleBasedAnalysisEngine` で分析します。意匠種別が明示されていない場合は、`designClass`、`articleName`、説明文から物品意匠・画像意匠・空間意匠を暫定推定します。

一部のローカル検証JSONでは公報・図面メタデータを表示できます。ただし、公報・図面画像本体と外部リンクは未接続です。

`unresolvedApplicants` または `unresolvedRightHolders` がある場合、申請人コードが正式名称に補完できていない状態として画面に警告します。この解消は DB 側の申請人マスタ拡充・名寄せ課題です。

実データ混入チェック:

```bash
pnpm run check:no-real-data
```

`pnpm run build` の前後にも同じチェックを実行し、公開ビルド対象に実データ由来のファイル名、ローカル作業パス、実在企業名、実在番号らしき値、公報XML由来らしき参照がないことを確認します。

## 注意

signals のローカル閲覧では、`VITE_SIGNALS_READ_ONLY=true` と `VITE_SIGNALS_LOCAL_PRODUCT_SUMMARY=true` を明示してビルドした場合に限り、ループバック上で保存資料の候補一覧を表示できます。企業・分野と見る理由から一件を選び、その資料の根拠へ進みます。既存の同一origin固定GET経路を使い、比較要約はGit・公開ビルドに同梱しません。通常配備ではこのローカル用フラグを設定しません。商品資料・公報・保存AI結果は選択に応じて表示し、原文の照合状態は保存資料の版に従います。

今回取得した原文との照合記録を含む比較資料 v2 では、照合日時と値ごとの短い保存引用・取得日時・出典を表示します。v1 は従来どおり未再照合の保存要約として表示します。この追加はローカル比較資料の形式に限り、保存Run/APIの契約は変更しません。元サイトを自動取得せず、原本文や実際の比較資料をGit・配信ビルドへ含めません。

standardのサンプル分析は架空データに基づく参考情報です。signalsでは保存結果のデータ区分と分析状態を確認してください。いずれも法的助言や企業戦略の断定を行うものではありません。

### Local saved comparison candidates

Private editorial version 3 preserves version 2 evidence and adds exact `discovery` metadata (`productKind`, editorial `selectionReason`, `comparisonBasis: "same_capture_products"`, `previousCaptureAt: null`) and a required display `label` per quote. Versions 1 and 2 remain compatible. The local read-only entry loads one saved comparison candidate (two products), then waits for explicit selection before showing the comparison. Acquisition times come from saved quotation metadata; missing prior captures remain unassessed. The independent gazette result retains its own scope.

Selecting a candidate and returning to its list reuse the decoded data. Meaningful quotation links remember their originating comparison cell; the return action restores focus and scroll to that cell. Reloading starts with the candidate unselected. This remains behind the existing explicit local flag and loopback gate, introduces no Run/API fields, and never fetches official sites or starts an analysis. Real candidate data and original sources stay outside the repository and client bundle.

The local discovery draft also lists individually saved `newly_observed` record facts only when the collection counts are comparable and consistent. Selecting one shows that record's metadata and available drawings; a missing drawing or date remains missing. Registered watch choices switch the saved classification and collection scope explicitly. They do not create a monitoring history. Collection input totals, target additions, product-to-product specifications, and same-record changes remain separate concepts. Saved analysis and history are secondary disclosures; Workbench remains the separate application for deeper product judgment and reporting. This local draft still requires execution and browser verification before replacing a working preview.

The optional [local saved observation comparison](docs/development/local-saved-observations.md) separately validates two actual acquisition records. It reports changes only within the saved candidate subset, keeps omitted candidates and missing full bodies visible, and separates excerpt equality from article-body equality. Its fixed loopback-only GET carries private runtime data outside Git and the bundle. Source acquisition, scheduling, production APIs and model execution are not initiated by this screen.
