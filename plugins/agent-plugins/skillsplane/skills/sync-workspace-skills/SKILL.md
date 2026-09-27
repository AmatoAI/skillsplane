---
name: sync-workspace-skills
description: SkillsPlane管理対象のローカルPersonal / Workspace Skillを、作成・変更完了後または明示的な要求時に対応するPersonalまたはTeamへ同期する。
---

# Personal / Workspace Skill を同期する

SkillsPlane 管理対象のローカル Skill bundle を `sync_skill` で Personal または対象 Team へ同期する。
外部 Plugin や、管理対象として明示されていない Skill は自動的に同期しない。

## 同期するタイミング

以下の場合に同期する。

- Skill を新規作成した
- `SKILL.md` または companion file を変更した
- Skill bundle の構成を変更した
- ユーザーが明示的に同期を要求した

編集中や不完全な状態では同期しない。複数の変更を行う場合は、一まとまりの変更が完了してから同期する。

## 管理対象と保存先

| スコープ | 保存先・接続設定 | managed Skill root |
| --- | --- | --- |
| User / Personal | OAuthアカウント本人のPersonal。binding不要 | `~/.agents/skills/` |
| Repository / Team | tracked `<repo>/.skillsplane.json` のTeam workspaceId | `<repo>/.agents/skills/` |

1. 明示スコープと指定されたsource pathを優先し、矛盾していれば送信前に停止する。
2. 指定がなければrepository bindingがあるとRepository、それ以外はUserを選ぶ。無効bindingは別scopeへfallbackしない。
3. Repository内のSkillが指定されているのにbindingがなければ、Team接続を要求する。Personalへ転送しない。User rootの未指定Skillを代わりに送らない。
4. Team bindingはexact workspaceIdのみを持つregular non-link fileでGit trackedを要求する。接続先を推測しない。
5. Personalは `~/.skillsplane.json` を読まない・作らない・書き換えない。Workspace選択やstatusを前提にしない。Team一覧0件も正常。
6. 送信前に「Personal Skills（現在の接続アカウント）」または対象Teamを表示する。Webの選択中Workspaceで同期先を変更しない。

選んだmanaged root内のSkillだけを送る。別scopeのfileを保存先だけ変えて送信しない。hostがsafe file読取を提供できなければ止める。root・ancestor・entrypoint・companionでsymlink/reparse/special fileを拒否し、送信直前に同じ安全なhandleからbounded readする。本文768 KiB、各companion64 MiB、256 companion files、bundle全体256 MiBまで。host metadata・credentials・dependencies・generated outputを除外し、送信path一覧を確認する。除外したfileが必須依存なら黙って省略しない。

## 同期

通常は今回作成・変更した Skill だけを対象とする。明示要求時はユーザーが指定した範囲を対象とし、全件は明示的に全件を要求された場合だけ送る。範囲が不明なら確認する。初回同期を含むsetupの明示要求では、正常に設定できた各scopeのmanaged rootにある既存の同期対象Skillを選択範囲とする。接続確認だけの要求は同期要求として扱わない。

同期前に、有効な `SKILL.md` があること、本文と companion file が意図した完成状態であること、同期先が現在の接続アカウントの Personal または特定の Team として明確であることを確認する。
必要なファイル検証や安全な読取ができない場合は同期を止める。

各Skillについて、hostの安全なfile APIから原本bytesのサイズとSHA-256を計算する。改行・BOM・Unicodeを正規化せず、計算した原本bytesをそのまま送る。fileのbytesやbase64をMCP JSON、LLMのメッセージ、ログへ載せない。

1. `sync_skill` に `action: "begin"`、scope、slug、`SKILL.md`を含む完全なmanifestを渡す。PersonalはworkspaceIdなし、TeamはbindingのworkspaceIdを付ける。各fileは `path`、`size`（bytes）、`contentHash`（`sha256:`と小文字64桁）、`executable` を持つ。companionがない場合もSKILL.mdの1件を渡す。
2. `upload_required` 応答のslug・workspaceId・path一覧・size・有効期限を要求と照合する。URLはHTTPSの `storage.googleapis.com` に限定し、userinfoやfragmentを拒否する。署名URLをcredentialとして扱い、表示・記録・第三者への送信をしない。
3. hostのHTTP転送機能から各URLに原本を直接PUTする。Server指定のheadersを正確に付け、OAuth bearer・cookie・Basic認証を付けず、redirectを追わない。読取時のsize/hashと一致したbytesだけ送る。全PUTの成功を確認する。
4. `sync_skill` に `action: "complete"` と `uploadId` を渡す。Serverが検証・確定するまで同期成功と報告しない。completeの応答が不明な場合は同じuploadIdで再試行する。upload URLが失効した場合は新たにbeginする。PUTで412が返る場合は上書きせずcompleteによる整合性検証か新しいbeginを使う。

manifestの例（hashとsizeはhostが実ファイルから計算する）:

```json
{ "action": "begin", "scope": "personal", "slug": "review", "files": [{ "path": "SKILL.md", "size": 87, "contentHash": "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "executable": false }] }
```

```json
{ "action": "complete", "uploadId": "22222222-2222-4222-8222-222222222222" }
```

ローカルの対象companionをmanifestに含め、companionがゼロでもbegin.filesにはSKILL.mdの1件を渡す。含めない既存companionはcomplete成功後も保持される。応答のfileCountは保持分を含むcompanion総数であり、送信件数とは限らない。安全な直接HTTP転送やhash検証ができないhostでは、file本文をLLMへ迂回させず、同期を停止して制約を報告する。

同期は追加・上書きであり、ローカルとリモートの完全一致や削除を保証しない。削除・改名が要求された場合は、旧pathのリモート削除は未対応・未完了と明示する。追加・更新の成功と区別し、削除まで同期済みとは報告しない。

ローカルの上限検証に加えて、Serverが保持分と送信分を統合したpath衝突・件数・容量を確定前に検証する。保持分による上限超過もあり得るため、Serverの拒否は同期未完了として理由を報告する。保持fileの削除や再試行を暗黙に行わず、送信件数とfileCountの一致を要求しない。

PersonalとTeamは独立したnamespaceで、同じslugも別Skillになる。同じ保存先とslugへの同期だけが送信した内容を更新する。成功応答のscope・slug・id・fileCount・statusを検証し、TeamはworkspaceIdもbindingと照合する。Personalの内部workspaceIdはServerの解決結果であり、bindingとして保存・再送しない。
`unchanged` の場合は追加処理を行わない。失敗・応答未確認を成功として扱わず、複数 Skill の途中で失敗した場合も成功済みの同期と区別する。

通常利用・task start・push・PR・mergeは同期契機ではない。同期失敗で独立した本作業やGit操作を停止しない。

## 完了報告

保存成功を確認したら、対象と保存先を短く報告し、「Webで確認・管理」のリンクを添える。同じ対象の `search` / `fetch` 応答から得た `url` があれば使い、なければ [SkillsPlaneで管理](https://skillsplane.com/workspaces)を案内する。リンク取得だけのために追加のMCP呼出しは行わず、URLをslugやIDから推測生成しない。複数Skillの保存では一覧へのリンクは一度にまとめる。`unchanged` は変更なしと伝える。失敗・応答未確認を保存成功として報告せず、ブラウザを自動で開いたり管理操作を促す質問を追加したりしない。
