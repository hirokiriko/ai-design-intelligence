# AI Design Intelligence

意匠情報を、先行商品戦略と知財戦略へ活用する Phase 0 の静的SPAです。

## 現在地と正式サービスの新方針

2026-09-19時点で、mainは下記のPhase 0サンプル動作です。KIRIKO Design SignalsのContract Adapter、5分デモUI、同一originのtrial APIは未マージDraft系列にあり、mainへ統合済みとは扱いません。

正式サービスの新方針はGoogle Cloud上のCloud Run（SPA/API）、Cloud SQL for PostgreSQL、Cloud Storage、Vertex AI上のGeminiです。既存Vite/Reactと決定的なルール分析を維持し、補足AIは別結果として扱います。第一案はCloud Runの同一originでSPAとAPIを配信する構成です。ブラウザにDB接続・Google認証情報・APIキー入力UIを持たせません。

[Issue #15](https://github.com/hirokiriko/ai-design-intelligence/issues/15)は設計・文書のみです。Google Cloudへの実装・公開、利用者認証変更、実データ配備は未実施。main／Draft／新方針の比較、認証を維持する移行案、既存配信の確認範囲は[Frontend移行設計](docs/architecture/google-cloud-frontend.md)と[SPEC §7](SPEC.md#7-google-cloud正式サービス新方針未実装)を参照してください。

## mainのPhase 0方針

- Vite + React + TypeScript + Tailwind CSS
- GitHub Pages 向け `base: './'`
- デモ用サンプルデータのみ
- RuleBasedAnalysisEngine によるルールベース分析
- LLM、外部API、バックエンド、スクレイピングは未接続

## Phase 0のサンプル配信版

公開URLで共有する版は、`src/data/sample-designs.json` のサンプルデータだけで動作します。

- 公開URL版はサンプルデータ版です
- サンプルはすべて架空データです
- 実在企業名、実在登録番号、実在出願番号、公報XML由来データ、画像ファイル名は含めません
- 特許庁実データを用いた検証版はローカル検証版として扱い、必要な場合は画面共有で説明します
- 公報・図面画像本体と外部リンクは未接続です
- 分析結果は参考情報であり、法的助言ではありません

## Phase 0の外部説明時の運用メモ（履歴）

パナソニック本社部門向けには、公開URLを先に送らず、特許庁実データを用いたローカル検証版を画面共有で説明します。公開URLはサンプルデータ版として、画面イメージ確認・関係先紹介用に使います。

## 開発運用

ChatGPT、Codex、ユーザー間の開発は、GitHub Issue、Draft Pull Request、PRコメントを正本として進めます。役割分担、最短メッセージ、CI・Preview・Productionの境界は[GitHubを正本とする開発運用](docs/development/github-workflow.md)を参照してください。

## コマンド

既存のpnpm lockfileを使用します。mise設定がある場合は先に`mise install`し、非対話shellでは`mise exec -- pnpm ...`で選択runtimeを明示します。

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run check:no-real-data
pnpm run build
pnpm run dev
```

## 既存Vercel配信（mainの構成）

Vercel は `vercel.json` に従い、pnpm の固定ロックファイルで `pnpm run build` を実行して `dist` を配信します。全パスはルートの `middleware.ts` で HTTP Basic 認証を必須にしています。

mainのmiddlewareは次のserver-only環境変数を使用します。これは既存構成の説明であり、本Issueで設定・認証・デプロイを変更する手順ではありません。実値はリポジトリや `VITE_*` 変数へ保存しません。

- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD`

将来承認された認証移行では、リダイレクトを追従しないHTTP検査で未認証・誤認証の拒否と正しい利用者の成功を確認します。Vercel Deployment Protectionは別の保護層です。Draft #14の最新middlewareにはmainのBasic判定がないため、過去のPR本文を現在の認証証拠として流用しません。

## 既存GitHub Pages配信設定

`vite.config.ts`の`base: './'`と`.github/workflows/pages.yml`はサンプル用の静的配信設定です。PagesはVercelのmiddlewareやNode Functionを実行しないため、正式サービスの認証/API配信には流用しません。現在の有効URL・配信SHA・稼働状態は[確認表](docs/architecture/google-cloud-frontend.md#配信と認証の確認範囲)を参照してください。手動workflow実行・設定変更・旧経路停止は今回行いません。

## DB 方針

Phase 0 は静的SPAとして動作し、DB・バックエンド・外部APIには接続しません。

従来のローカルDB連携案はPhase 0の開発履歴です。新しい正式サービスではCloud SQL for PostgreSQLをBackendが扱います。内部DB名・接続先・取込データのlocationはBackend側で管理し、Frontend公開文書に転載しません。元データはappリポジトリとGit管理外として扱います。

ローカル設定の雛形は `.env.example` に置いています。DB 接続情報や認証情報はブラウザへ公開される `VITE_*` 変数に入れないでください。

## ローカル実データJSON読込（開発用）

この節はmainのlegacy File API経路です。Contract `0.1.0` Adapterは未マージDraft側にあり、このlegacy loaderと混同しません。ローカル読込の説明はGoogle Cloudへのデータ配備承認を意味しません。

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

分析結果は架空のサンプルデータに基づく参考情報であり、法的助言ではありません。
