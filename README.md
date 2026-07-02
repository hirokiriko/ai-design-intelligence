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

## コマンド

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev
```

## DB 方針

Phase 0 は静的SPAとして動作し、DB・バックエンド・外部APIには接続しません。

将来のバックエンドまたはオフライン取込処理では、DB 名を `AI意匠ver2_DB` として管理する予定です。DB 側プロジェクトは、ローカルでは app と同じ親フォルダにある `../特許ダウンロード手順_0` を参照します。

DB 側の引継ぎ資料は `../特許ダウンロード手順_0/AGENT_ASSIGNMENT_BRIEF.md` です。特許庁一括ダウンロードデータの実作業領域はローカルDB側で管理し、元データは app リポジトリと Git 管理外として扱います。

ローカル設定の雛形は `.env.example` に置いています。DB 接続情報や認証情報はブラウザへ公開される `VITE_*` 変数に入れないでください。

## ローカル実データJSON読込（開発用）

公開デモの既定は、従来どおり `src/data/sample-designs.json` のデモ用サンプルデータです。実データは app リポジトリへコピーせず、`src/data`、`public`、`dist`、Git管理下には置きません。

開発時だけ、画面左側の「ローカル実データJSONを読み込む（開発用）」から DB 側で生成済みの統合JSONを選択します。ブラウザの File API で読み込み、データはメモリ上だけで保持します。localStorage、IndexedDB、public 配下への保存は行いません。

読込対象は、DB 側で生成した日次・週次・月次プレビューの統合JSONです。具体的な保存場所やファイル名はローカル環境側で管理し、app リポジトリには記載・同梱しません。

読み込んだ実データは `LocalJpoJsonDataSource` で既存の `DesignRecord` に変換し、既存の `RuleBasedAnalysisEngine` で分析します。意匠種別が明示されていない場合は、`designClass`、`articleName`、説明文から物品意匠・画像意匠・空間意匠を暫定推定します。

一部のローカル検証JSONでは公報・図面メタデータを表示できます。ただし、公報・図面画像本体と外部リンクは未接続です。

`unresolvedApplicants` または `unresolvedRightHolders` がある場合、申請人コードが正式名称に補完できていない状態として画面に警告します。この解消は DB 側の申請人マスタ拡充・名寄せ課題です。

実データ混入チェック:

```bash
npm run check:no-real-data
```

`npm run build` の前後にも同じチェックを実行し、公開ビルド対象に実データ由来のファイル名、ローカル作業パス、実在企業名、実在番号らしき値、公報XML由来らしき参照がないことを確認します。

## 注意

分析結果は架空のサンプルデータに基づく参考情報であり、法的助言ではありません。
