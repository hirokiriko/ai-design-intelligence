# KIRIKO Design Signals

> 意匠情報から、市場・企業・商品化領域の先行シグナルを捉える

意匠情報を俯瞰し、市場動向、企業動向、商品化領域、デザイン変化の検討材料を得るための静的SPAです。分析結果から対応する根拠意匠へ戻れます。結果は将来や企業戦略を断定するものではなく、他の知財情報、商品情報、事業情報等と組み合わせて検討するための参考情報です。

## 現在版

- Vite + React + TypeScript + Tailwind CSS
- GitHub Pages向け `base: './'`
- `RuleBasedAnalysisEngine` による決定論的なルールベース分析
- 公開版は完全な架空サンプルデータのみ
- Backend Contract `0.1.0` JSONと従来JSONを、File APIで手動選択する限定検証
- 認証後に同一originからBackend Contractを自動取得する、明示的な限定試用モード
- 企業、分類、物品名、意匠種別等の集計
- 結果とランキングの件数から根拠意匠一覧への絞り込み
- 取得済みの公報・図面情報の表示
- LLM、外部情報、DB、スクレイピングは未接続

通常の`standard`モードにはリモートBackend APIやDBへの常時接続はありません。BackendがContract `0.1.0`として出力したJSONをブラウザのFile APIで読み込み、検証済みのanalysis-ready subsetを分析できます。

限定試用の`trial`モードは、認証済みセッションで固定の同一origin pathからContractを自動取得します。同一origin requestはVercelのserver-side proxyだけが固定のBackend endpointへ中継し、ブラウザへBackend URLやBearerを渡しません。取得成功前にサンプル画面へ遷移せず、失敗時もサンプルへfallbackしません。このpublic repositoryはBackend本体、実データ、credential、期限の正本を提供しません。

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
| 認証付き限定試用 | 同一originの`GET /api/trial/design-export`から自動取得 | `trial`を明示した非Production環境だけ。File API・承認UI・sample fallbackなし |
| その他のリモートデータ | DB、外部API | 現在版では未接続 |

File APIで選択したJSONはブラウザのメモリ上だけで扱います。localStorage、IndexedDB、`public`、`dist`、リポジトリへ保存しません。

Backend Contractの適合確認とデータ利用承認は別の境界です。読込成功だけで実データとは判定せず、画面表示は次の3分類を使います。

- `fictional_contract_fixture`: `meta.exportId` が `FIXTURE-` 名前空間の完全架空fixture。ローカル承認より優先し、実データ用表示へ変更しません。
- `approved_public_design_demo`: 非fixture Contractについて、利用者が正式runの利用承認をローカル画面で明示確認した場合だけ選択します。
- `unclassified_contract`: それ以外の有効なContractの既定値。実データとは断定しません。

ローカル承認はファイルごとのブラウザメモリ状態であり、別ファイルの選択や再読込へ引き継ぎません。個別の実データexport ID、hash、ファイル名、ローカルpathはコードや公開GitHubへ固定しません。

`trial`モードでは、Backend側で認証・期限・配信承認を通過した非fixture Contractだけを自動的に`approved_public_design_demo`として扱います。`FIXTURE-`名前空間はこの経路でも必ず`fictional_contract_fixture`を維持します。取得したContractはブラウザメモリだけで扱い、localStorage、IndexedDB、service workerへ保存せず、再読込時に再取得します。

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

`VITE_APP_MODE`が未設定または`standard`の公開URLは、従来どおり架空サンプルデータで起動します。`trial`は認証付きの非Production限定試用環境でのみ明示的に有効化するモードです。

- 実在企業名、実在登録番号、実在出願番号、公報原本、実在画像を含めない
- 公開Preview、Production、公開ビルドへ実データを含めない
- 実データや顧客固有情報をIssue、PR、CIログ、資料、スクリーンショットへ記載しない
- 図面画像本体と外部リンクが未接続であることを画面で明示する
- 分析結果は参考情報であり、法的助言、類否判断、侵害判断、登録可能性判断ではない

限定ローカル検証は、利用承認済みJSONを利用者がFile APIで手動選択し、画面上でも承認済み分類を明示した場合だけ行います。限定試用モードはファイル選択や承認チェックを表示せず、Backend側の認証・期限・配信承認を境界として同一originから自動取得します。

このrepositoryには`/api/trial/design-export`のserver-side proxyだけを含み、Backend本体や実データは含めません。proxyはGET・queryなし・固定pathだけを受理し、ブラウザのAuthorization、Cookie、Origin、bodyをBackendへ転送しません。Backend error bodyも顧客画面やconsoleへ転載せず、401/403、404、410、422、5xx・timeoutを安全な顧客向け状態へ分類してfail closedとします。Preview確認はProductionへの反映や昇格を意味しません。

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
pnpm run check:client-bundle
pnpm run dev
```

## Vercelデプロイと認証

Vercelは固定ロックファイルでSPAをbuildし、`api/trial/design-export.ts`をNode.js Functionとして配信します。全パスはルートmiddlewareでHTTP Basic認証を必須にしており、trial proxyも同じ境界の内側です。GitHub Pages等の静的配信ではserver-side proxyがないため、`trial`モードを有効にしません。

認証値は暗号化された環境変数で管理し、リポジトリやブラウザへ公開される変数へ保存しません。認証情報を変更した後は再デプロイし、リダイレクトを追従しないHTTP検査で「未認証401・誤認証401・正しい認証200」を確認します。

公開クライアント変数`VITE_APP_MODE`は`standard`または`trial`だけを受理し、未設定は`standard`です。不正値はサンプルへfallbackせず停止します。この変数にはモード名以外を設定しません。

proxyはserver-onlyの`KIRIKO_TRIAL_BACKEND_BASE_URL`と`KIRIKO_TRIAL_BACKEND_BEARER`を使用します。base URLはpath・query・fragmentを持たないHTTPS origin（ローカル検証だけloopback HTTP可）に限定し、コードで`/v1/trial/design-export`を固定します。Bearer値は32〜512 byteの表示可能ASCIIだけを受理します。BackendのVercel Deployment Protectionをserver-to-server通信で通過する必要がある場合だけ、任意のserver-only `KIRIKO_TRIAL_BACKEND_PROTECTION_BYPASS`を設定できます。有効な値は固定Backend requestの`x-vercel-protection-bypass`だけへ追加し、未設定時はheaderを送りません。browserが同名headerを送っても転送せず、不正な設定値はBackendへ接続せずfail closedとします。Bearerとprotection bypassはbrowser request、client bundle、HTML、source map、response、logへ出しません。これらを`VITE_*`へ置かないでください。`trial`環境の有効化、server-only環境変数の設定、Backend runtime接続、実データ配置、Production変更はそれぞれ別の明示承認対象です。このPRではいずれのリモート環境変数も設定しません。

## 実データ混入チェック

```bash
pnpm run check:no-real-data
pnpm run check:client-bundle
```

buildの前後にも実データ混入検査を実行し、公開ビルド対象に実データ由来の内容、ローカル環境の情報、実在企業名、実在番号らしき値、公報原本由来らしき参照がないことを確認します。build後はclient bundle safetyも実行し、server-only環境変数名、固定Backend path、設定済みBackend URL/Bearer値が`dist`へ入っていないことを確認します。

## 注意

分析結果は参考情報であり、法的助言ではありません。公開版と限定ローカル検証、現在版と将来構想を混同しないでください。
