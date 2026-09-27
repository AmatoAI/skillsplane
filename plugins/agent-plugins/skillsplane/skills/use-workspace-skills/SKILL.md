---
name: use-workspace-skills
description: 専門的な指示が役立つ実質的な作業で、SkillsPlaneから関連するPersonal / Workspace Skillを検索・取得し、現在のタスクへ適用する。SkillsPlaneのスキルの一覧・管理・削除を求められた場合はWebへ案内する。
---

# Personal / Workspace Skill を使用する

SkillsPlane を Workspace Skill を発見するための正本とする。

## SkillsPlane MCP

利用できる主なツール:

- `status`: 接続アカウントと利用できるTeam Workspaceを確認する。
- `search`: Workspace Skill をslug と SKILL.md全文（frontmatterを含む）から検索する。
- `fetch`: 選択した Skill の `SKILL.md` と companion file の一覧を取得する。
- `fetch_skill_file`: 必要な companion file を取得する。

通常の Skill 利用は `search → fetch → 必要なら fetch_skill_file` の順で行う。

## セットアップと検索範囲

明示されたPersonal/UserまたはTeam/Repositoryを優先する。指定がなければ、現在のGit repository rootに有効でGit trackedな `.skillsplane.json` があるとTeam、bindingがない場合やrepository外ではPersonalを使う。

- Personal: `search` に `scope: "personal"` とqueryを渡す。workspaceIdは渡さず、Serverが現在のOAuthアカウントのPersonal Skill Spaceを解決する。Workspace選択は不要。
- Team: `search` に `scope: "workspace"`、bindingのexact `workspaceId`、queryを渡す。bindingはnon-secretのworkspaceIdのみを持つregular non-link fileとする。
- 無効・untrackedなrepository bindingは診断し、Personalへfallbackしない。明示Teamでbindingがなければ、接続先を選択する。
- `~/.skillsplane.json` は読まない・作らない・書き換えない。Personalの宛先はそのfileに依存しない。
- Teamの選択や一覧表示では、`status` の `nextCursor` がなくなるまで次の呼出しの `cursor` に渡し、全ページの `workspaces` を集めてから候補を判断する。ページ取得に失敗した場合は一覧未完了として扱う。有効なbindingがある場合は一覧から再解決しない。
- `status.workspaces` はTeamのみを返す。0件でもPersonalは利用でき、Team作成を要求しない。Workspaceは名前・過去のタスク・Webの選択から推測しない。

```json
{ "scope": "personal", "query": "i18nの翻訳漏れと未使用キーを調べたい" }
```

```json
{ "scope": "workspace", "workspaceId": "ws_0123456789abcdef", "query": "review" }
```

検索結果0件はセットアップ失敗ではない。別scopeを自動検索せず、PersonalとTeamの検索を暗黙に混ぜない。通常利用は同期を起動しない。

## Skill を検索して取得する

専門的な指示が役立つ可能性のある実質的な作業を開始する前に、以下を行う。

1. `query`にやりたい仕事と重要な条件を簡潔に記述し、`search`する。対象の技術名・識別子が明確なら、同じqueryに含める。
2. ユーザーが Skill 名を指定した場合は、その正確な名前または slug を使用する。
3. queryはtrim後1..200文字。重要な制約も自然文で記述する。除外条件が必ず検索結果に反映されるとは限らない。
4. 検索順位だけで適合を確定せず、候補を`fetch`し、依頼の目的・条件に合うSkillを選ぶ。適切な候補がなければ適用しない。
5. 返された Skill の指示を現在のタスクに適用する。
6. 関連する結果がなければ、より短い中核語句または別の表現で1回だけ再検索する。それでも見つからなければ通常どおり作業を続ける。

取得していない Workspace Skill の存在や内容を、記憶や過去の会話から仮定してはならない。

同じタスクの後続作業で、取得済みの Skill が引き続き適切であれば再利用する。

タスクの領域や作業内容が大きく変わった場合は再検索する。

## Companion file

検索結果とfetchのscope・Skill ID、fetch metadataのworkspaceId/slug、revisionとmanifestを確認する。Teamは選択したbinding IDとの一致を必須にし、Personalの内部workspaceIdは設定ファイルへ保存しない。

`fetch` で返された manifest を確認し、現在のタスクに必要な companion file だけ `fetch_skill_file` で取得する。

fetch_skill_fileにはmanifestのexpectedRevisionを渡し、応答のscope・ID・workspaceId・slug・revision・path・size・executable・contentHashをmanifestと照合する。短命のHTTPS URLは `storage.googleapis.com` に限定し、userinfo・fragment・redirectを拒否する。hostのHTTP機能で直接downloadし、OAuth bearer・cookie・Basic認証を付けない。原本bytesのsizeとSHA-256を検証する。URLを表示・ログ保存せず、bytesをMCP/LLMへ中継しない。安全な転送・検証ができなければ取得を停止する。不一致や取得失敗は利用せず、manifestから取り直す。必要なfileだけをcurrent taskの一時directoryへ安全に展開し、永続cacheを作らない。

取得中に Skill の更新や競合が報告された場合は、古い取得ファイルを破棄し、Skill を `fetch` し直す。

取得した Skill や companion file を、永続的にインストールされたローカル Skill として扱わない。

## 指示の優先順位

ユーザーの明示的な指示は、取得した Workspace Skill の指示より優先する。

## Webでの確認・管理

スキルの一覧・管理・削除を求められたら、[SkillsPlaneで管理](https://skillsplane.com/workspaces)を案内する。対象スキルの `search` / `fetch` 応答の `url` が得られていれば、対象が一致することを確認し、そのURLへ「Webで確認・管理」のリンクを出す。URLをslugやIDから推測生成しない。検索で見つからない場合も存在しないと断定せず、Webの一覧へ案内する。

削除依頼を `sync_skill` やローカルファイル削除で代行しない。付属ファイルについても対象スキルの確認先を案内し、Webで提供されていると確認できていない操作を約束しない。管理の案内だけの依頼では、スキル本文の適用や同期は行わない。ブラウザは開くよう依頼された場合だけ開き、通常のスキル利用で管理の案内を繰り返さない。
