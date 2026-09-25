# Signal UI — Frontend Issue #17

## Issue #19：保存された対象・対応・不明点の表示

新規保存結果には補足DTO `2.1.0` を使用する。公開契約は `contracts/run-v2.1.0.schema.json`。signal本文は `contracts/signal-v2.0.0.schema.json` を維持する。既存の補足 `1.0.0` / `2.0.0` の保存結果と Contract `0.1.0` の分析経路は維持する。未知version・未知field・参照不一致では表示を停止する。

`2.1.0` は保存contextの前後datasetへnullableな `collection` を追加する。週次原本からの遡及再構成では、共通の収録開始日、原本公開日に基づく締切日、再構成日時、原本の取得期間、手元で確認した日時、事後補足の有無、収録上の限界を表示する。取得期間が不明なら両端をnullのまま「不明」と表示し、手元での確認日時やファイルmtimeを代用しない。処理規則と原本集合の識別値は詳細内へ置く。当時の稼働サービスのsnapshotや当時の予測実績とは呼ばない。旧版のcontextへこの情報を補わず、現catalogから過去runを書き換えない。

企業名、商品分野・分類、既知の商品情報、前後の基準日・収録範囲、架空／承認済み公開実データの区分は、実行に保存されたcontextから表示する。現在のcatalogで過去の表示を上書きしない。旧形式の架空runは「架空データ（旧形式）」として残す。AIモデルの表示は資料のデータ区分とは分離する。

概要では対象領域、新規観測・変化、公式資料の記載、不明点と次に確認する資料を先に示す。個別意匠と商品の対応は、直接対応・商品分野の関連・未確認の候補・無関係や矛盾・資料不足に分け、支持／反証／不足を根拠へ接続する。画像A/Bは比較上の役割であり、製品の新旧世代とは表示しない。「処理終了」と製品の同一性の確認を区別する。

公式資料の発表日・更新日・発売日・取得日時と不明日付を分け、事後照合を明示する。AIに提示された抜粋の文字範囲と保存された残りの範囲を別に表示し、全文確認と混同しない。保存結果や根拠の表示でAIを再実行したり公式ページを自動取得したりしない。

「同じ企業・商品条件で収録データを選び直す」はcatalogをGETで再取得し、現在の企業・商品条件を引き継いだ新しい条件フォームを開く。利用者がデータを選択して別watchを保存した後、明示的な「更新を確認」で実行する。元watchと過去runは更新しない。

現在の状態：架空fixtureによる1.0.0 / 2.0.0 / 2.1.0混在履歴、遡及再構成の由来・不明点、対応区分、日付・抜粋・参照不一致の単体回帰を追加した実装候補。次のアクション：最新候補の実APIによる保存・履歴・reload、データ更新後の別実行を統合確認する。架空試験を承認済み実企業ケースの実測完了とは扱わない。

## Issue #21：登録済み比較組の選択

Backend #26の公開契約 `contracts/run-v2.2.0.schema.json` と `contracts/comparison-pairs-v2.2.0.schema.json` に従う。新規run `2.2.0` は選んだ比較組のIDと公開metadataを `input.comparisonPair` に固定し、`null` も明示して保存する。旧run `1.0.0` / `2.0.0` / `2.1.0` の形と意味は変更せず、後のcatalogから組情報を補わない。Contract `0.1.0` と既存ルール分析も維持する。

保存条件を選ぶと、その企業・分類・前後datasetで使える登録済み比較組だけをGETで取得する。利用者は次の実行に使う組と比較A/Bの対象・登録時の条件を確認し、明示的な「更新を確認」で実行する。組の選択や履歴・reloadはGETまたは画面内操作だけで、AIを起動しない。条件やcatalogを更新したときは選択を消して候補を再取得する。候補取得失敗や未選択の組がある場合は実行を止め、最終的な対象照合はBackendが行う。

閲覧中の結果は保存された組のmetadataから表示し、次の実行の選択と区別する。同じ条件の別組、旧run、画像なし、参照エラーを別状態として扱う。任意画像URL・アップロード・比較編集・新しい公開共有URLは設けない。

### 日刊公報の選定集合（補足DTO 2.3.0）

実証用に選んだ日刊公報を遡及再構成するときは、保存runの `collection.kind=retrospective_selected_daily_gazettes` と公報日の昇順 `selectedIssueDates` を表示する。前後は同じ開始日・原本系列・採用規則を持ち、比較Aの日付列が比較Bの先頭列である場合だけ比較可能とする。選定した号・件数は全国の全公報・全意匠や、当時のサービス保存状態を意味しない。旧 `2.1.0` / `2.2.0` の週次集合は各版の検証規則と表示のまま残す。新 `2.3.0` では比較組の保存形を引き継ぎ、bootstrap・比較組catalog・履歴のversionを明示的に受理する。資料の原文・画像の利用範囲は、このDTO変更からは拡張されない。

## Issue #17で引き継いだ導線

親DeliveryはBackend #15。画面はVite/React、既存ルール分析は`generatedBy: rules`、元データはContract `0.1.0`を維持する。初期実装の保存条件と保存結果は補足API `1.0.0`を使用していた。保存済みの旧形式runは架空運用のもので、新形式の環境区分で書き換えない。新規実行の契約は上記Issue #21の`2.3.0`を参照する。

## 実装した導線

保存した企業・商品分類・前後の収録範囲・登録公式サイトを選び、「更新を確認」で1回の明示実行を要求する。企業はBackendが提供したIDで選択し、表示名から企業を新設しない。二重操作を防ぎ、通信結果が不確定な再試行では同じrequest IDを使う。

結果は意匠データの事実、画像からのAI観察候補、公式発表の事実、関連仮説、不明点を分ける。公報日・出願日・公開日・取得日と事後照合を表示する。画像は認証内media APIから取得し、拡大と根拠意匠確認だけを行う。未取得画像を生成しない。根拠意匠は保存runの前後datasetをContract Adapterで検証して読み直す。

保存履歴とURLの`?run=<id>`からのreloadはGETだけ。ブラウザのlocalStorageやIndexedDBへ結果を永続化しない。別の実行として再確認する操作は履歴読込から分離し、過去runを上書きしない。進行中・中断・API/AI失敗・資料不足・変化なしを区別する。

## 同一origin API

- `GET /api/v1/bootstrap`: schemaVersion、dataMode、CSRF token、catalog、watches
- `GET /api/v1/watches/{id}/comparison-pairs`: 条件に使用可能な登録済み比較組の公開metadata
- `POST /api/v1/watches`: 条件名とBackend identity、dataset、source profile IDを保存
- `POST /api/v1/watches/{id}/runs`: requestIdと`check|reanalyze`、組選択時はcomparisonPairId
- `GET /api/v1/runs?watchId={id}`、`GET /api/v1/runs/{id}`: 保存済み結果
- `GET /api/v1/media/{id}`: 公開DTOにはlocatorや署名URLを含めない
- `GET /api/v1/datasets/{id}/export`: 元のContract `0.1.0`。既存ルール分析にも使用

正式なfield契約の正本はBackendの公開補足schema。未知version・未知field・不正URL・不正な参照ID・抜粋の不一致は表示を止める。出典URLはHTTPSのみで、userinfo、port、query、内部host、IP直書きを拒否する。外部/AI文字列はReactのtextとして描画し、HTMLを実行しない。

POSTにはbootstrap由来のCSRF tokenを付け、credentialsはsame-origin、cacheはno-store、redirectは拒否する。認証やセッションエラーは明示表示し、sampleへfallbackしない。利用者認証とGoogle Cloud service identityは別の責務である。

## 採用元と維持した境界

main起点で、#14 `7749aaf`に含まれる#10→#12のUI・ルール・Adapter・安全チェックを意味単位で採用した。#6/#7を重複採用していない。#10の企業カード数に応じた列数、根拠絞込解除とfocus、モード文言、Backend用初期条件を維持する。

従来ルール画面は現行#14と同じ7段階（6: 任意の出力部門、7: 結果と根拠）である。新しいシグナル画面とは別の導線であり、旧6段階文書を現在の根拠に使わない。#14のVercel proxyとBasic認証削除は採用していない。mainのmiddlewareを維持し、新しいCloud Run配信ではBackendがHTML/assets/API/media/runのすべてを保護する。

#16のGoogle Cloud責務分担文書も採用するが、初回HTML1件という過去案は親Deliveryによって更新されている。今回の到達点には画像AI観察候補と登録公式サイト内の有限探索が含まれる。チャットUI、比較編集、任意URL入力、常時監視、通知は追加しない。

## ローカルビルドと検証

Windowsではmiseを通して既存pnpm lockを使う。新画面のビルドはPowerShellで`$env:VITE_APP_MODE='signals'`を設定し、`mise exec -- pnpm run build`、`mise exec -- pnpm run check:client-bundle-safety`を実行する。生成された`dist`を認証付きBackendのSPA directoryとして同一origin配信する。Frontend単独のVite起動にはAPIが存在しないため、通信失敗を正しく表示する。

必須検証はlint、typecheck、test、check:no-real-data、build、check:client-bundle-safety。新画面は実Backend＋架空データで条件保存→実行→根拠→履歴→reloadまで確認し、reloadと履歴表示のAI増分0をBackend countersでも照合する。SSR/HTTPモックのテストだけでは永続保存の証拠にしない。

2026-09-19のローカル検証では、miseのNode 24 / pnpmを使ったlocked install、lint、typecheck、25ファイル233テスト、standard/signals両build、no-real-data、client bundle safetyが成功。既存サンプルの分析→件数→根拠→解除focusの回帰もブラウザで確認した。

実BackendとPostgreSQL、架空データ、明示した模擬モデルで、条件保存→実行→画像拡大→Contract根拠→履歴→reload→別ブラウザ再表示を確認。二重クリックの実行POSTは1件、履歴・reloadではPOSTなし、保存runは同一内容、PC 1280×720 / mobile 390×844で横overflowなし、正常経路のconsole/page/request errorは0だった。watch切替後のURLとreload、履歴読込中の競合も修正・再確認した。遅延GETと503注入による表示検証は補助証拠として区別し、保存成功の証拠にはしていない。

これは外部AIの品質評価ではない。`fixture-controller`の結果には「模擬モデル（接続・保存の検証）」を表示する。ローカル録画も架空・模擬モデルのdraftであり、クラウドの正式提出物ではない。

2.1.0の追補では、28ファイル261テスト、lint、typecheck、standard/signals両build、安全チェックが成功。専用ローカルPostgreSQLへの架空run保存とAPI読戻し、再読込、別ブラウザでの表示を確認した。後続の架空収録データを別条件で保存すると比較Bは2件から3件、新規観測は1件から2件となり、元runのJSON・usage・件数は変わらない。履歴・再読込はGETのみで、モデル呼び出しと資料取得の増分は0。既存2.0.0保存DBの4runも不変だった。1.0.0/2.0.0/2.1.0の混在履歴は契約テストで確認しており、この追補のブラウザ経路は2.1.0の架空runが対象である。

現在の状態：ローカルで検証済みの実装候補。GitHub CI、クラウドE2E、固定URLでの認証とPC停止後の継続利用は別の受入証拠が必要。次のアクション：親Deliveryの統合コンテナと最新headで再確認し、承認境界内でD工程へ引き継ぐ。旧PRの過去SHAのCIやE2Eを新候補の証拠として流用しない。
