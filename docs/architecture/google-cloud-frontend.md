# Google Cloud正式サービスに向けたFrontend移行設計

> この文書はFrontend #15/#16時点の設計記録。Frontend #17 / Backend Delivery #15の現在の実装と採用範囲は[Signal UI実装](signal-ui.md)を参照する。初回HTML1件・画像なしという過去案は今回の最終到達点ではない。以下の未実装表記はこの設計記録の時点を示す。

2026-09-19、[Frontend Issue #15](https://github.com/hirokiriko/ai-design-intelligence/issues/15)に基づく公開可能な設計。全体方針の正本は同Issueから参照する親Issueとし、private Backendの環境識別子、内部location、データや認証情報はここへ転記しない。

現在の状態：文書設計。Google Cloudの構築・デプロイ、アプリコード、依存、workflow、env、認証設定、既存PRの統合は変更していない。次のアクション：この文書専用Draft PRをレビューし、後続の契約・実装・移行Issueで各受入条件を満たす。

## main、Draft、新方針の区別

以下は2026-09-19にGitHubと各headのコードを読み取り確認したスナップショット。以後の作業では最新main・head・コメントを再確認する。

| 区分 | 確認した基準 | 内容と未完了境界 |
| --- | --- | --- |
| main実装 | `d75ffd845f5d957d0be206ae11485f2c01780ded` | Vite/React/TypeScript/Tailwind、サンプルとlegacy File API、決定的ルール分析、Phase 0の①〜⑤入力。Cloud API・DB・Web取得・AI補足は未接続 |
| Draft #6 | `10e4b6a6a1682724c9b67a536bce3a4e4f5b672c` | Contract `0.1.0` Adapter、stable ID、品質判定、accepted-only分析。main未統合 |
| Draft #7 | `6cb2261c90cb43857d7fccf14f6fc17b789cf22c` | 5分デモUI。main未統合 |
| Draft #10 | `1164fa9d09d4bf0af5b30dd7e9222d3848b8088b` | #6/#7の統合系列。#6/#7と機械的に二重採用しない |
| Draft #12 | `e1d1be4e7099af92519dd6a71550dee57b48f5c3` | #10上のtrial UI、同一origin自動Contract取得とserver proxy |
| Draft #14 | `7749aaf91a3fec4837be85117cafabbb8bcc182f` | #12上のstreaming proxy等。最新画面は出力部門を含む7段階。READMEの6段階記述と不一致 |
| 新方針・未実装 | Issue #15 | Cloud Run同一origin配信、Google Cloudで完結する正式サービス、別DTOのGemini補足 |

#1も未マージDraftとして残る。この文書PRで既存PRのcode/base/state/bodyを変更しない。将来統合するときは#10 → #12 → #14の依存系列と#6/#7との重複を評価し、文書差分も含めて改めて整合させる。

#14本文の最終SHAは過去の`e2524b836a8b831a1cd915b92d27fd50fb43be91`であり、最新headと異なる。過去SHAに対するremote E2Eや認証成功を最新headの受入証拠へ流用しない。6/7段階の不一致も後続統合時の修正項目として残し、このmain起点文書でmainのUIを7段階へ読み替えない。

現状の「デザイン変化」は特徴語・件数に基づく分析であり、画像比較ではない。図面はmetadataで、画像binary、登録公報本体、画像AIが接続済みとは扱わない。

## 第一案：Vite/ReactのSPAとAPIをCloud Runの同一originへ

ブラウザ → 利用者認証 → Cloud Run（ビルド済SPAとAPI）という入口を第一案とする。APIからCloud SQL for PostgreSQL、Cloud Storage、Vertex AI上のGeminiへアクセスする。画面・API・DB・保存ファイル・主要処理をGoogle Cloud上で完結させ、ローカルPC停止時も使える固定URLを設ける。新正式サービスへ自動期限・失効URLを設けず、Cloudflare Tunnel / Quick Tunnel / ngrok等の公開経路は採用しない。

既存の相対API呼出とVite成果物を維持でき、別origin用CORSや別BFFを増やす理由が現状ないため、同一origin配信を第一案とする。Next.js、API Gateway、追加proxyサービスを既定で導入しない。実際のコンテナ構成、入口の利用者認証方式、route契約は後続実装Issueで親Issueと整合させる。

| 責務 | Frontend | Backend / Google Cloud側 |
| --- | --- | --- |
| 利用者操作 | 条件、明示的な照合要求、結果・根拠・保存結果の表示 | 画面/APIの利用者認証と権限検査、実行・保存・読取API |
| 決定的分析 | 既存エンジン、Contract検証、accepted-only、stable evidenceへの遷移を維持 | 検証可能なContractを提供し、AIで件数・品質判定を書き換えない |
| DBとファイル | DBへ直接接続せず、内部保存先や原本をbundleへ含めない | Cloud SQL接続、Cloud Storageの原本・画像・export、保存・取得・権限管理 |
| 補足AI | 検証された別DTOの表示と独立した失敗状態 | Gemini呼出、構造検証、保存、結果IDによる再取得 |
| Google認証 | APIキー入力・保存UIなし、SA JSON keyなし | ローカルADC、実行時Cloud Run service account + IAM。最小権限で管理 |

Cloud Runのservice identityはGoogle APIを呼ぶ実行主体であり、人が画面へログインする仕組みではない。Basic認証やDeployment Protectionが担った利用者アクセス制限は、新入口でも独立して維持・検証する。

## 配信と認証の確認範囲

コードから分かる設定、GitHub上のcheck、現在稼働する配信先を区別する。未確認項目を推測で補完しない。

| 対象 | read-onlyで確認した事実 | 未確認・注意 |
| --- | --- | --- |
| main Vercel設定 | `vercel.json`はVite buildと`dist`配信。`middleware.ts`は全パスにBasic認証を要求し、設定不足は503、未認証・誤認証は401 | 現在のactive deployment・alias・配信SHA・Production疎通はコードだけでは分からない |
| Draft #14 middleware | 最新headのmiddlewareはnoindex/no-store headerを設定するが、mainにあるBasic認証判定は含まない | 過去PR本文の「Basic維持」と最新コードは異なる。実配信先の認証を確認するまで、最新DraftでBasic保護済みとはしない |
| Draft #14 API | `GET /api/trial/design-export` → server-only proxy → 固定Backend経路。Bearer/OIDCはserver側、redirect拒否、timeout/cancel、有限byte上限、streaming、safe status mapping、private/no-store | コード存在はliveの接続・データ配置・利用可能性を証明しない。Frontendに内部Backend URLやcredentialを渡さない |
| Deployment Protection / Issue #8 | 独立した保護層。Issue #8最新コメントには専用開発環境による単一認証の方針がある | 方針や承認と実施済みを区別する。本Issueでは保護設定もcredentialも変更しない |
| GitHub Pages設定 | `base: './'`、`pages.yml`にmain pushと手動実行、`gh-pages`への静的成果物配信がある。GitHub APIでpublic / legacy build、source `gh-pages`の`/`、status `built`を確認 | Vercel middlewareやNode Functionは実行されない。成果物とmain source SHAの対応・HTTP疎通は未確認 |

同日のVercel read-only API棚卸しでは、本体projectのProductionはmain `d75ffd845f5d957d0be206ae11485f2c01780ded`、Previewは#14 `7749aaf91a3fec4837be85117cafabbb8bcc182f`に対応するREADY deploymentがあり、aliasも存在することを確認した。これは管理API上の状態であり、各aliasが現在どの画面を返すか、認証が意図どおり拒否するか、主要操作が成功するかは未試験。本体にはDeployment Protection設定があるが、適用範囲ごとのlive確認は残る。Basic環境変数名の存在だけでも認証が有効とは判断しない。

別のtrial配信先もREADYであり、metadata上のsource SHAは#14 `7749aaf91a3fec4837be85117cafabbb8bcc182f`と一致した。ただし本体と同じ認証構成とはみなさない。期限、最新承認、認証設定、実応答を照合するまで利用可能・保護済みとは記載しない。環境識別子や非公開URLは転載せず、詳細な確認状況はIssueの記録で管理する。

GitHub Pagesのlatest buildは成果物commit `94934f7b31f518471646f412439ad85c7af9c71c`、status `built`、更新日時`2026-08-10T14:10:33Z`だった。このSHAは`gh-pages`の成果物commitであり、main source SHAとの対応やHTTP疎通は未確認。Pages設定の有効化とbuild metadataの確認を、現在の画面・認証・API動作の受入とはしない。

active deployment、alias、実配信SHA、認証のread-only結果はIssue #15とこの文書PRの検証記録へ残す。公開できないURLや環境識別子は載せず、確認できない項目は未確認とする。GitHub status SUCCESSを現在の本番疎通確認と読み替えない。

## Vercel依存の置換箇所

| 現在の役割 | Cloud Run側で引き継ぐこと | 移行時の確認 |
| --- | --- | --- |
| Vite静的成果物配信 | 既存`dist`をSPAとして配信 | ルート、asset、直接アクセス、reloadを確認。SPA fallbackがAPIの404/401をHTMLへ変換しない |
| Vercel middlewareのBasic認証・header | 利用者認証を画面とAPIの入口へ実装。no-store等を適切な応答へ付与 | 未認証・誤認証・権限不足は拒否、認証済み利用者のみ主要操作可能。Draft最新の差分も評価 |
| Deployment Protection | 新入口の利用者制限に必要な役割を明示 | service account設定のみで認証完了としない。既存保護を先に解除しない |
| Node Functionの同一origin proxy | 同じoriginのAPI routeで必要な処理を提供 | fixed route/method、入力検証、有限timeout/byte上限、cancel、safe error、private/no-storeを維持 |
| Vercel OIDC / server bearer | Vercel固有中継を外し、必要なGoogle API権限を実行identityで制限 | ブラウザへGoogle tokenや内部保存先を返さない。利用者認証とservice identityを混同しない |
| Vercel function設定 | Cloud Run runtime契約へ合わせたserver起動・port・終了処理 | APIより先にfallbackしない、stream完了・中断を確認。設定値は実装Issueで検証 |
| Preview / Pages | 移行後も必要な確認・サンプル配信の役割を判断 | 旧経路は下記受入後に別承認で整理し、アプリや保存データを自動削除しない |

Viteの`base: './'`をこの文書作業で変更しない。Cloud Runでのroute/asset挙動を確認して必要な差分だけを後続Issueで扱う。

## Contractと補足DTOの表示契約

Contract `0.1.0`、stable evidence ID、決定的な件数・条件・品質判定を維持する。Adapterはstrictに検証し、accepted-only分析、無効Contractのfail-closed、legacyへのsilent fallback禁止を引き継ぐ。公式URL、AI結果、画像binaryをContract `0.1.0`へ黙って追加しない。

補足結果は別のversioned DTOにする。以下は表示に必要な意味の設計であり、field名・schema version・endpointの確定ではない。Backendの契約Issueでschemaと互換性を確定してから実装する。

- 保存結果を再取得するための結果IDと、参照した既存シグナル・stable evidence ID。IDの参照先を検証し、存在しない根拠を合成しない。
- 意匠データ上の事実／公式発表の事実／AI仮説／不明点を混同しない区分。各記述とその出典・根拠の対応。
- 企業公式HTMLの公開可能な出典URLとタイトル、公開日、取得日、分析日。日付不明は不明のまま残す。
- 補足の生成・失敗・未生成を区別できる状態と、保存された結果であることを示す情報。AI障害を既存ルール分析の失敗として扱わない。

Frontendでもschema/versionと参照IDを検証し、安全に表示できる文字列・URLだけを受理する。外部HTMLやAI生成HTMLをそのまま描画せず、credential付きURL、内部location、危険なschemeを出典リンクにしない。AIが提示したURLだけを根拠にせず、Backendで確認済みの公式出典との対応を契約する。

ルール分析は`generatedBy: 'rules'`のまま。Geminiの補足があっても全体を`generatedBy: 'llm'`へ変更しない。Backendの永続保存から結果を読み直し、再表示・reloadではAIを再実行しない。ブラウザ永続領域を保存結果の正本にしない。

## 初回導線と対象外

1. 1企業・1商品分野の既存シグナルと根拠を確認する。
2. 承認済みの固定ケースで指定した企業公式HTML1件について、利用者が明示的に照合を実行する。初回に任意URL入力UIは設けない。
3. 意匠データ上の事実、公式発表の事実、AI仮説、不明点を分けて表示する。
4. 出典・日付・根拠意匠を確認し、既存stable IDから対象意匠へ戻る。
5. 保存結果を再取得して表示する。ここでAIを再実行しない。

自動Web検索、複数媒体、画像比較、chat UI、複数モデル切替、ダッシュボード刷新、定期監視、レポート配信は追加しない。初回は画像を入力せず、「部位の変化をAIが確認した」とは表示しない。Phase 0の「準備中」は、対象機能を別Issueで実装するまで維持する。

## 移行の受入と旧経路の停止条件

以下は正式公開の後続作業の受入であり、本Issueでクラウド操作を実施する許可ではない。

- 固定URLに対して、対象Frontend/Backend revisionと実配信を照合する。期限付き共有リンクやローカルトンネルを正式入口にしない。
- 画面、API、保存結果に対する未認証・誤認証・権限不足の拒否と、正しい利用者による操作成功を確認する。
- 条件変更 → 決定的分析 → 件数から根拠へ戻る主要操作を確認し、stable IDと件数を照合する。
- 明示照合 → 4区分の表示 → 出典・日付・根拠確認 → Backendへの永続保存 → reloadまたは別認証セッションで同じ保存結果を取得する。再取得でAI呼出が増えないこと、AI停止時も既存分析と保存結果が利用可能なことを確認する。
- ローカルPCを停止した状態で主要操作と保存結果の再表示を確認する。
- 公開repo、CI、Preview、client bundle、ログへ実データを含めず、検証には架空データだけを使う。正式サービスの認証API応答は別承認されたDTOだけを返し、credential・内部locationを含めない。実データ配備には別承認を要する。
- 新経路の受入とユーザーの停止承認を得てから旧Vercel/Pagesの役割と停止範囲を決める。アプリや保存データの削除は停止と同義にせず、勝手に削除しない。

既存trialの期限は最新の承認履歴とlive設定を照合する。この文書に過去期限を現行値として固定せず、延長・失効・認証緩和を行わない。Draft解除・main merge・Production反映はそれぞれ別の明示承認対象とする。

## 設計の参照資料

- [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc)：Backend側の実行環境に応じた認証。
- [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)：実行サービスがGoogle Cloud APIを使う際の主体。利用者認証とは別。
- [Cloud Run container runtime contract](https://docs.cloud.google.com/run/docs/container-contract)：同一origin配信を実装するときのruntime要件。
- [Cloud RunからCloud SQL for PostgreSQLへ接続](https://docs.cloud.google.com/sql/docs/postgres/connect-run)：DB接続をBackendに限定する設計の参照。

SDK、Gemini model、region、料金、認証の具体的設定は実装時に公式資料と親Issueを再確認する。ここに実環境の識別子や秘密値を記録しない。
