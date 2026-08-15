# KIRIKO Design Signals

> 意匠情報から、市場・企業・商品化領域の先行シグナルを捉える

意匠情報を俯瞰し、市場動向、企業動向、商品化領域、デザイン変化の検討材料を得るための静的SPAです。分析結果から対応する根拠意匠へ戻れます。結果は将来や企業戦略を断定するものではなく、他の知財情報、商品情報、事業情報等と組み合わせて検討するための参考情報です。

## 現在版

- Vite + React + TypeScript + Tailwind CSS
- GitHub Pages向け `base: './'`
- `RuleBasedAnalysisEngine` による決定論的なルールベース分析
- 公開版は完全な架空サンプルデータのみ
- Backend Contract `0.1.0` JSONと従来JSONを、File APIで手動選択する限定検証
- 企業、分類、物品名、意匠種別等の集計
- 結果とランキングの件数から根拠意匠一覧への絞り込み
- 取得済みの公報・図面情報の表示
- LLM、外部情報、リモートBackend API、DB、スクレイピングは未接続

リモートBackend APIやDBへの常時接続はありません。一方、BackendがContract `0.1.0`として出力したJSONは、ブラウザのFile APIで読み込み、検証済みのanalysis-ready subsetを分析できます。

## 画面の流れ

画面とDOMは次の6段階を同じ順序で構成します。

1. 分析対象を決める — 市場全体、特定業界、特定企業
2. 見たい領域を決める — 用意された領域または任意入力
3. 対象となる意匠情報を決める — 物品意匠、画像意匠、空間意匠、全対象。分析目的に応じた自動設定と手動変更に対応
4. 対象期間を決める — 現状把握の直近1年、傾向把握の直近2年
5. 分析目的を選ぶ — 市場動向、商品化領域、企業動向、デザイン変化、画像意匠の動向
6. 結果と根拠を確認する — 分析対象意匠数、注目トレンド、商品化領域のヒント、企業動向、追加分析、根拠意匠

推奨デモ条件はプリセットで設定できます。出力部門は初回の必須入力ではなく、分析目的からの自動設定または詳細設定内の任意項目です。詳細設定を開かなくてもサンプルデータによる分析を完了できます。実行ボタンの表示は「分析を開始」です。

## 結果と根拠

分析完了後は、次の順序で表示します。

1. 今回の分析対象意匠数
2. 注目トレンド
3. 商品化領域のヒント
4. 企業動向
5. 必要に応じたデザイン変化・画像意匠等の追加分析

件数を選択すると、その結果に対応する既存のレコードIDで根拠意匠一覧を絞り込みます。根拠のない示唆は表示せず、0件の場合は条件を見直す案内を表示します。`confidence` は内部データとして保持できますが、ユーザー向け画面には表示しません。

## データ入力モード

| モード | 入力 | 境界 |
| --- | --- | --- |
| 公開サンプル | アプリ同梱の架空サンプル | 公開Previewと公開ビルドで利用可能 |
| Backend Contract | Contract `0.1.0` JSONをFile APIで手動選択 | exact-version検証後のaccepted recordsだけを分析 |
| 従来JSON | versionを持たない従来JSONをFile APIで手動選択 | legacy変換規則を適用し、Contract失敗時のfallbackには使用しない |
| リモートデータ | Backend API、DB、外部API | 現在版では未接続 |

File APIで選択したJSONはブラウザのメモリ上だけで扱います。localStorage、IndexedDB、`public`、`dist`、リポジトリへ保存しません。

## Backend Contract 0.1.0の安全境界

- `contractVersion` はexact `0.1.0`だけを受理します。
- malformed JSON、unsupported version、envelopeまたはrecordのcontract違反、unsafe provenanceを検出した場合はdataset単位でfail closedとします。
- Contract検証に失敗した入力を従来JSON loaderへfallbackしません。
- 分析対象は `adapterDisposition.status === 'accepted'` のレコードだけです。quarantined record、分析不能な意匠種別、分析基準日を満たさないレコードは除外し、summaryへ件数を残します。
- 分析基準日はenvelopeの `sourceUpdatedAt` をUTC日付へ変換して使用します。レコード側の日付から推測しません。
- 企業指定と企業集計では、resolved partyだけをmembershipへ変換し、applicantの `(role, resolvedEntityId)` をidentityとして扱います。未解決partyを別企業として合成しません。
- 分類はrepeatableな `(scheme, code)` をidentityとして扱い、全classification membershipを保持します。単一のprimary classificationへ潰しません。
- evidenceにはaccepted recordsの既存stable IDだけを使用し、除外レコードのIDを混ぜません。
- 完全架空のContract互換fixtureでexact-version、accepted-only、除外理由、企業・分類identity、根拠IDを回帰検証します。fixtureに実データやBackend内部情報は含めません。

## 公開版と限定ローカル検証の境界

公開URLで共有する版は、架空サンプルデータだけで動作します。

- 実在企業名、実在登録番号、実在出願番号、公報原本、実在画像を含めない
- 公開Preview、Production、公開ビルドへ実データを含めない
- 実データや顧客固有情報をIssue、PR、CIログ、資料、スクリーンショットへ記載しない
- 図面画像本体と外部リンクが未接続であることを画面で明示する
- 分析結果は参考情報であり、法的助言、類否判断、侵害判断、登録可能性判断ではない

限定ローカル検証は、利用承認済みJSONを利用者がFile APIで手動選択した場合だけ行います。安全な配信経路、認証、監査、削除手順が未整備のため、実データ配備状態は `BLOCKED_REAL_DATA_DEPLOY` です。Preview確認はProductionへの反映や昇格を意味しません。

## 5分デモ

初回提案では、目的、条件設定、分析結果、根拠確認、現在版と将来構想の境界を5分で説明します。

- [5分デモガイド](docs/demo/5min-demo-guide.md)
- [プレゼンテーション台本](docs/demo/presentation-script.md)
- [現在版と将来構想](docs/demo/current-vs-future.md)

公開Previewは架空サンプルだけで確認します。限定ローカル検証の入力や画面を公開Preview、公開資料、Git管理対象へ移しません。

## 開発運用

ChatGPT、Codex、ユーザー間の開発は、GitHub Issue、Draft Pull Request、PRコメントを正本として進めます。役割分担、CI・Preview・Productionの境界は[GitHubを正本とする開発運用](docs/development/github-workflow.md)を参照してください。

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

## Vercelデプロイと認証

Vercelは固定ロックファイルでbuildし、静的成果物を配信します。全パスはルートmiddlewareでHTTP Basic認証を必須にしています。

認証値は暗号化された環境変数で管理し、リポジトリやブラウザへ公開される変数へ保存しません。認証情報を変更した後は再デプロイし、リダイレクトを追従しないHTTP検査で「未認証401・誤認証401・正しい認証200」を確認します。

## 実データ混入チェック

```bash
pnpm run check:no-real-data
```

buildの前後にも同じ検査を実行し、公開ビルド対象に実データ由来の内容、ローカル環境の情報、実在企業名、実在番号らしき値、公報原本由来らしき参照がないことを確認します。

## 注意

分析結果は参考情報であり、法的助言ではありません。公開版と限定ローカル検証、現在版と将来構想を混同しないでください。
