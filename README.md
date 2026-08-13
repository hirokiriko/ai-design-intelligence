# AI Design Intelligence

意匠情報を、先行商品戦略と知財戦略へ活用する Phase 0 の静的SPAです。

## 方針

- Vite + React + TypeScript + Tailwind CSS
- GitHub Pages 向け `base: './'`
- デモ用サンプルデータのみ
- RuleBasedAnalysisEngine によるルールベース分析
- LLM、外部API、バックエンド、スクレイピングは未接続

## 公開URL版

公開URLで共有する版は、`src/data/sample-designs.json` のサンプルデータだけで動作します。

- 公開URL版はサンプルデータ版です
- サンプルはすべて架空データです
- 実在企業名、実在登録番号、実在出願番号、公報XML由来データ、画像ファイル名は含めません
- 特許庁実データを用いた検証版はローカル検証版として扱い、必要な場合は画面共有で説明します
- 公報・図面画像本体と外部リンクは未接続です
- 分析結果は参考情報であり、法的助言ではありません

## 外部説明時の運用メモ

パナソニック本社部門向けには、公開URLを先に送らず、特許庁実データを用いたローカル検証版を画面共有で説明します。公開URLはサンプルデータ版として、画面イメージ確認・関係先紹介用に使います。

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

## Vercel デプロイ

Vercel は `vercel.json` に従い、pnpm の固定ロックファイルで `pnpm run build` を実行して `dist` を配信します。全パスはルートの `middleware.ts` で HTTP Basic 認証を必須にしています。

Vercel の Preview と Production の両環境へ、次の値を暗号化された環境変数として設定してください。実値はリポジトリや `VITE_*` 変数へ保存しません。

- `BASIC_AUTH_USER`
- `BASIC_AUTH_PASSWORD`

認証情報を変更した後は再デプロイし、リダイレクトを追従しないHTTP検査で「未認証 401・誤認証 401・正しい認証 200」を確認します。

## DB 方針

Phase 0 は静的SPAとして動作し、DB・バックエンド・外部APIには接続しません。

将来のバックエンドまたはオフライン取込処理では、DB 名を `AI意匠ver2_DB` として管理する予定です。DB 側プロジェクトは、ローカルでは app と同じ親フォルダにある `../特許ダウンロード手順_0` を参照します。

DB 側の引継ぎ資料は `../特許ダウンロード手順_0/AGENT_ASSIGNMENT_BRIEF.md` です。特許庁一括ダウンロードデータの実作業領域はローカルDB側で管理し、元データは app リポジトリと Git 管理外として扱います。

ローカル設定の雛形は `.env.example` に置いています。DB 接続情報や認証情報はブラウザへ公開される `VITE_*` 変数に入れないでください。

## ローカル実データJSON読込（開発用）

公開デモの既定は、従来どおり `src/data/sample-designs.json` のデモ用サンプルデータです。実データは app リポジトリへコピーせず、`src/data`、`public`、`dist`、Git管理下には置きません。

開発時だけ、画面左側の「ローカル実データJSONを読み込む（開発用）」からJSONを選択します。ブラウザの File API で読み込み、データはメモリ上だけで保持します。localStorage、IndexedDB、public 配下への保存は行いません。

読込対象は、DB 側で生成した日次・週次・月次プレビューの統合JSONです。具体的な保存場所やファイル名はローカル環境側で管理し、app リポジトリには記載・同梱しません。

入力経路は明示的に分離しています。

- `contractVersion` を持つ Backend Contract export は、専用の `BackendContractDataSource` で exact `0.1.0` を検証します。unsupported version、contract違反、unsafe provenanceはdataset単位でfail closedとし、legacy loaderへfallbackしません。
- versionを持たない従来JSONだけを `LocalJpoJsonDataSource` で既存の `DesignRecord` に変換します。このlegacy経路では、意匠種別が明示されていない場合に `designClass`、`articleName`、説明文から物品意匠・画像意匠・空間意匠を暫定推定します。

Contract経路の分析基準日は envelope `sourceUpdatedAt` のUTC日付です。`gazetteDate: null`、基準日より未来の日付、`designType: unknown`、quarantined recordはsource値を補完・再推定せず分析から除外し、画面上のsummaryに件数を表示します。企業指定はresolved applicantの `(role, resolvedEntityId)`、分類集計はrepeatableな `(scheme, code)` をidentityとして扱います。

手動確認用の `fixtures/backend-contract-v0.1.0/design-export-fictional.json` は完全架空の互換fixtureです。実データやBackend内部情報を含まず、`pnpm run check:no-real-data` の検査対象です。

一部のローカル検証JSONでは公報・図面メタデータを表示できます。ただし、公報・図面画像本体と外部リンクは未接続です。

`unresolvedApplicants` または `unresolvedRightHolders` がある場合、申請人コードが正式名称に補完できていない状態として画面に警告します。この解消は DB 側の申請人マスタ拡充・名寄せ課題です。

実データ混入チェック:

```bash
pnpm run check:no-real-data
```

`pnpm run build` の前後にも同じチェックを実行し、公開ビルド対象に実データ由来のファイル名、ローカル作業パス、実在企業名、実在番号らしき値、公報XML由来らしき参照がないことを確認します。

## 注意

分析結果は架空のサンプルデータに基づく参考情報であり、法的助言ではありません。
