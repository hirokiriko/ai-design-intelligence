# Signal UI — Frontend Issue #17

親DeliveryはBackend #15。画面はVite/React、既存ルール分析は`generatedBy: rules`、元データはContract `0.1.0`を維持する。保存条件と保存結果はBackendの補足API `1.0.0`を使用し、別decoderでfail closedに検証する。

## 実装した導線

保存した企業・商品分類・前後の収録範囲・登録公式サイトを選び、「更新を確認」で1回の明示実行を要求する。企業はBackendが提供したIDで選択し、表示名から企業を新設しない。二重操作を防ぎ、通信結果が不確定な再試行では同じrequest IDを使う。

結果は意匠データの事実、画像からのAI観察候補、公式発表の事実、関連仮説、不明点を分ける。公報日・出願日・公開日・取得日と事後照合を表示する。画像は認証内media APIから取得し、拡大と根拠意匠確認だけを行う。未取得画像を生成しない。根拠意匠は保存runの前後datasetをContract Adapterで検証して読み直す。

保存履歴とURLの`?run=<id>`からのreloadはGETだけ。ブラウザのlocalStorageやIndexedDBへ結果を永続化しない。別の実行として再確認する操作は履歴読込から分離し、過去runを上書きしない。進行中・中断・API/AI失敗・資料不足・変化なしを区別する。

## 同一origin API

- `GET /api/v1/bootstrap`: schemaVersion、dataMode、CSRF token、catalog、watches
- `POST /api/v1/watches`: 条件名とBackend identity、dataset、source profile IDを保存
- `POST /api/v1/watches/{id}/runs`: requestIdと`check|reanalyze`
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

現在の状態：ローカルで検証済みの実装候補。GitHub CI、クラウドE2E、固定URLでの認証とPC停止後の継続利用は別の受入証拠が必要。次のアクション：親Deliveryの統合コンテナと最新headで再確認し、承認境界内でD工程へ引き継ぐ。旧PRの過去SHAのCIやE2Eを新候補の証拠として流用しない。
