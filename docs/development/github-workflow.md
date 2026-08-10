# GitHubを正本とする開発運用

## 目的

ChatGPT、Codex、ユーザーの間で長文を手作業転記せず、GitHub Issue、Draft Pull Request、PRコメント、CI、Vercel Previewから同じ現在地を参照する。チャットでは原則としてリポジトリ名とIssue番号またはPR番号だけを受け渡す。

この文書の内容は、mainへマージされた時点から正式運用となる。Draft PRだけに存在する変更を正式運用済みとは扱わない。

## 正本と役割

| GitHub上の対象 | 正本として記録する内容 |
| --- | --- |
| `main` | 承認済みの基準。未マージPRの内容を含むとはみなさない |
| Issue | 目的、現在地、対象範囲、対象外、成果物、制約、受入条件、次のアクション |
| Draft PR | 実際の差分、最新head SHA、検証、CI、Preview、未完了事項、Productionとmainの不変確認 |
| PRコメント・レビュー | ChatGPTまたはレビュー担当者からCodexへの修正依頼と、その対応記録 |
| CI | PRの最新head SHAに対する自動検証結果 |
| Vercel Preview | PRの最新head SHAに対応する確認環境。Productionとは別物 |

チャットの要約は利便用であり、GitHub上の最新状態と競合する場合はGitHubを優先する。ただし、Draft解除、mainへのマージ、Production反映などの承認はユーザーの明示的な発言だけを根拠とする。

## 役割分担

### ChatGPT

- 接続済みGitHubツールでmain、Issue、PR、差分、コメント、CIを直接確認する。
- Issue作成前に、タイトルと本文の最新版全文をユーザーへ提示する。
- ユーザー承認後、IssueをGitHubへ直接作成する。
- PR番号を受け取り、最新head SHA、差分、CI、Previewを直接レビューする。
- 修正依頼をPRコメントまたはレビューコメントへ記録する。
- Codex対応後、最新状態を再レビューする。
- Draft解除、mainへのマージ、Production反映をユーザーに代わって承認しない。

### Codex

- リポジトリ名とIssue番号から、Issue本文と最新コメントをGitHubで直接読む。
- `AGENTS.md`、関連文書、最新main、既存PR、ローカル差分を確認する。
- 最新`origin/main`から専用ブランチを作り、main向けDraft PRを作成する。
- PR本文へ最新head SHAと対応する検証結果を記録する。
- PR番号からコメントを直接読み、actionableな指摘を修正する。
- 未解決のactionableコメントを残したまま完了扱いにしない。
- Draft解除、mainへのマージ、Production反映をユーザーの明示承認なしに行わない。

### ユーザー

ユーザーはプロダクトオーナー兼最終承認者として、次の操作を明示的に承認する。

- Issue本文の作成
- Draft解除
- mainへのマージ
- Production反映
- 実データ投入や認証境界の変更

ChatGPTのレビュー完了や推奨は、これらの承認を意味しない。

## 標準フロー

### 1. ChatGPTがIssueを準備する

1. GitHubでvisibility、default branch、main HEAD、既存Issue・PR、関連CIを確認する。
2. 必要に応じてPreviewとProductionの現在値を読み取り専用で確認する。
3. Issueのタイトルと本文を、差分ではなく最新版全文でユーザーへ提示する。
4. ユーザー承認後、GitHubへIssueを直接作成する。

### 2. CodexがIssueからDraft PRを作成する

ユーザーはCodexへ次の短いメッセージだけを送る。

> `hirokiriko/ai-design-intelligence のIssue #<issue-number>を確認し、記載内容に従って対応してください。`

Codexは次の順で進める。

1. Issue本文と最新コメントを読む。
2. GitHubのmain、関連PR、ローカル差分と未追跡状態を再確認する。
3. `git fetch origin`後の最新`origin/main`から、`codex/issue-<issue-number>-<short-description>`形式の専用ブランチを作る。
4. Issue対象ファイルだけを変更し、明示的なパスだけをステージする。
5. ローカル検証を実行する。
6. コミットとpushを行う。
7. `Refs #<issue-number>`で関連付けたmain向けDraft PRを作る。
8. 現在の状態と次のアクションをPR本文へ記録する。

試運転中は`Closes`を使わず、Issueを自動クローズしない。

### 3. ChatGPTがPRを直接レビューする

ユーザーはChatGPTへ次の短いメッセージだけを送る。

> `hirokiriko/ai-design-intelligence のPR #<pr-number>をGitHubから直接確認し、レビューしてください。`

ChatGPTはPR本文だけでなく、base/head、最新head SHA、全差分、コミット、CI、Preview、コメント、mainとProductionの不変状態を確認する。修正が必要な場合は、対象、理由、受入条件を含むactionableなコメントをPRへ直接記録する。

### 4. CodexがPRコメントへ対応する

ユーザーはCodexへ次の短いメッセージだけを送る。

> `hirokiriko/ai-design-intelligence のPR #<pr-number>を確認し、最新のレビューコメントに対応してください。`

CodexはGitHubから最新コメントとレビューを直接読み、次を行う。

1. actionableな指摘と、質問・参考情報を分ける。
2. 指摘が曖昧、競合、またはIssue範囲外の場合は、推測で変更せずPRコメントで確認する。
3. 修正と関連検証を実行する。
4. 修正コミットをpushする。
5. 最新head SHA、検証結果、対応内容、現在の状態、次のアクションをPRへ記録する。

### 5. ChatGPTが再レビューする

ChatGPTは最新head SHAに対して差分、CI、Preview、コメント対応を再確認する。古いSHAに対する成功結果を流用しない。問題が解消した場合はレビュー完了をPRへ記録するが、Draft解除やマージの承認は行わない。

## PR本文の更新規則

新しいコミットをpushした場合、次を最新状態へ更新する。

- 最新検証対象head SHA
- 検証日時
- ローカル検証結果
- GitHub Actions runと結果
- Preview deploymentと対応SHA
- 未完了事項とブロッカー
- 現在の状態
- 次のアクション

更新履歴が必要な場合はPRコメントへ時系列で残し、PR本文は現在値を示す。

## CIとGitHub Actionsログ

PR CIはNode.js 24とpnpm固定ロックファイルを使い、lint、typecheck、test、`check:no-real-data`、buildを実行する。workflow定義と実際に実行されたstepの両方を確認する。

CIが失敗した場合は、GitHubのrunとjobを開き、失敗stepを特定する。ChatGPTまたはCodexがCLIを使う場合は、認証情報を出力せず、`gh pr checks <pr-number>`、`gh run view <run-id> --log-failed`などの読み取りコマンドで確認する。修正後は最新head SHAで再実行し、古いrunを成功根拠にしない。

## Preview、Production、mainの境界

- PR pushにより作成されるVercel Previewは試験に利用できる。
- Preview URL、deployment、対応head SHA、状態をPRへ記録する。
- Previewが`READY`でもProduction反映済みとは扱わない。
- Productionのdeploy、promote、rollbackはユーザーの別承認を必要とする。
- Draft解除とmainへのマージも、それぞれユーザーの別承認を必要とする。
- GitHub Pagesの手動`workflow_dispatch`は、明示承認なしに実行しない。

## データ、秘密情報、ローカル未追跡物

このリポジトリは公開されている。Issue、PR、コメント、コミット、Actionsログへ次を出さない。

- 秘密情報、認証情報、個人情報
- 実データ、顧客の未公開情報
- 秘密の認証付きURL
- ローカル絶対パス
- ローカル未追跡物の個別ファイル名または内容

`deliverables/`、`output/`、`local-data/`などのローカル専用物はステージしない。混在worktreeでは`git add -A`を使わず、対象パスを明示してステージする。報告はディレクトリ名と件数に限定する。

## 状態と次のアクション

すべての進捗更新と最終報告に、次の2項目を含める。

- 現在の状態：完了、進行中、未完了、ブロッカーと根拠
- 次のアクション：次に誰が何をするか

例：

> 現在の状態：Draft PRを作成し、最新head SHAのPR CIとPreviewが成功している。mainとProductionは未変更。
>
> 次のアクション：ChatGPTがPR番号から差分とCIを直接レビューする。

## 試運転で問題が見つかった場合

実際のIssue→Draft PR→PRコメント→修正→再レビューで見つかった問題は、PRコメントへ事実として記録し、この文書、テンプレート、または`AGENTS.md`を同じPRで修正する。変更理由、検証結果、今後の改善事項を残す。内容のない架空の修正は作らない。

実質的な欠陥がなかった場合は、ChatGPTがPRコメントで依頼した後に「試運転結果」セクションを追加し、実施日、Issue・PR番号、各受け渡しの成功可否、発見事項、改善事項を実績として記録する。

## Draft PR #1とのPR CI重複

GitHub運用基盤PRとDraft PR #1は、どちらも`.github/workflows/pr-ci.yml`を追加する。試運転中はどちらもmainへマージしない。

将来ユーザーが正式採用を承認した場合は、次の順序を推奨する。

1. GitHub運用基盤PRをmainへマージする。
2. Draft PR #1を最新mainへ同期する。
3. PR CIの重複差分または競合を確認する。
4. Draft PR #1の最新head SHAでCIとPreviewを再実行する。
5. ChatGPTがDraft PR #1を再レビューする。
6. ユーザーがDraft解除とマージを別途判断する。

競合解消のためにDraft PR #1へ無断でpush、force push、rebaseを行わない。
