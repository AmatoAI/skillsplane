<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/wordmark-dark.svg">
  <img src="docs/assets/wordmark-light.svg" alt="SkillsPlane" width="420">
</picture>

# SkillsPlane

**今の仕事に、適切なSkillを。**

SkillsPlane は、Agent による **Skill の検索・適切な選択・改善内容の同期** を支えます。
Skill は、繰り返し使えるように書いた仕事の手順です。
やりたい仕事を依頼すると、Agent が関連する候補を検索し、内容を確認して使う手順を選びます。

[English](README.md) · [使い方を見る](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/)

> **ソース先行公開中：** カタログからの導入はまだ利用できません。
> 現在の開発検証用セットアップは[導入ガイド](docs/getting-started.md)をご覧ください。

## 検索・選択・同期

| ステップ | できること |
| --- | --- |
| 検索 | 今の依頼に関連する Skill を見つける。 |
| 選択 | Agent が候補の内容を読み、仕事に合う手順を選ぶ。 |
| 同期 | 管理対象の Skill を、変更完了後または同期の依頼で更新する。 |

検索結果は候補です。Agent が内容を確認して適合を判断し、作業結果は利用者が確認します。
同期が成功すると、次の取得で更新後の手順を使えます。

## やりたい仕事から始める

Personal またはアクセスできる Team Workspace に関連する Skill がある状態で、接続した Agent に依頼します。

```text
この変更、翻訳漏れがないか確認して。
```

Agent が翻訳チェックの Skill を検索し、今回の仕事に合うものを選びます。
手順を改善するときは、たとえば：

```text
複数形の翻訳漏れも確認するように手順を直して、Skill を同期して。
```

これは利用例であり、付属テンプレート集ではありません。
自分用の Skill は Personal に。Team Workspace では、権限のある仲間も使えます。

## Git との違いは？

Git でも Skill の共有や履歴管理はできます。
SkillsPlane は、今の依頼に関連する Skill の検索と、Agent による適切な選択を支えます。
改善した内容を同期すれば、次の取得でも更新後の手順を使えます。
通常の仕事・Git の push・作業開始だけで全件同期することはありません。

現在の提供状況とセットアップは[導入ガイド](docs/getting-started.md)へ。
利用には SkillsPlane のアカウントと対応 Agent が必要です。

<details>
<summary>パッケージ・権限・開発について</summary>

## パッケージと提供状況

Agent Plugins **1.0.0** 形式に対応し、現在の manifest version は **0.1.0** です。
配布単位は次のディレクトリです。

```text
plugins/agent-plugins/skillsplane/
├── LICENSE
├── plugin.json
├── mcp.json
└── skills/
    ├── setup/SKILL.md
    ├── use-workspace-skills/SKILL.md
    └── sync-workspace-skills/SKILL.md
```

Remote MCP の接続先は `https://skillsplane.com/api/mcp` です。
添付対応の手順には `status`、`search`、`fetch`、`fetch_skill_file`、
`sync_skill` の5つが必要です。対応する5ツールと新規クライアントの OAuth の実環境検証が
完了するまで、Codex・Cursor のリポジトリカタログは空のままにします。リポジトリカタログからの
導入と、クライアント運営元の公式 Marketplace 掲載は別です。
[標準の対応クライアント一覧](https://agent-plugins.org/compatible-clients) も参照してください。

## データと権限

- サーバーが毎回 OAuth と Personal の所有者または Team のメンバー権限を確認します。接続設定自体は認可に使いません。
- 同期は検証済みの全ファイルを送信します。含めない既存の添付は保持されます。上書きした内容の履歴・undo はありません。
- 安全なファイル読込と承認はホストの既存機能を使います。取得した添付は作業中だけの一時ファイルです。
  上限はSKILL.md 768 KiB、添付ごと 64 MiB、添付 256 個、全体 256 MiB です。
- 独自の認証情報保管、オフラインキャッシュ、常駐再試行は追加しません。
- 本作業・push・PR 作成・マージは同期を待ちません。
- ローカル試験の成功と、実クライアントでの自動起動・OAuth 成功は別に確認します。

開発と検証は [CONTRIBUTING.md](CONTRIBUTING.md)、脆弱性報告は
[SECURITY.md](SECURITY.md) を参照してください。不具合や文書の改善は
[Issues](https://github.com/AmatoAI/skillsplane/issues) と Pull Request で受け付けます。
日本語・英語のどちらも歓迎します。

## Setup after installation

Use one supported installation method to make the Plugin persistently available.
Do not reinstall an available Plugin. Then ask the agent to follow the `setup` Skill
to verify Plugin / OAuth availability, Personal access, and any requested or existing
Repository binding. Initial sync follows
`sync-workspace-skills`: complete local bundles update the same destination and slug.

同期はbegin → hostによる直接PUT → completeで確定します。短命URLから原本を転送し、サイズとSHA-256を検証します。bytesをMCP/LLMへ中継しません。

</details>
