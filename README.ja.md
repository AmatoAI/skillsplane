# SkillsPlane Agent Plugin

**個人とチームの最新の Skill を、エージェントの作業に。**

SkillsPlane は、Personal Skill と Team Workspace の Skill をエージェントから検索・適用し、
リポジトリで作成した Skill を同期するための
[Agent Plugin](https://agent-plugins.org/) です。
[Apache 2.0](LICENSE) で提供する、クライアントに依存しない形式のパッケージです。

[English](README.md) · [導入ガイド](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/) · [開発への参加](CONTRIBUTING.md)

## できること

- **共有した指示を使う。** ホストの OAuth 接続で Workspace Skill の本文を検索・取得し、作業に適用します。

設定用 `setup`、利用用 `use-workspace-skills`、同期用 `sync-workspace-skills` を分けています。
同期は管理対象 Skill の変更完了後か、明示要求時に行います。
Repository は `<repo>/.skillsplane.json` と `<repo>/.agents/skills/`、
User は `~/.agents/skills/` を使い、OAuth アカウント固有の Personal に同期します。
`~/.skillsplane.json` は読み書きしません。
明示指定を優先し、指定がなければ repository binding の有無でスコープを選びます。
無効な binding は別スコープへ切り替えず停止します。安全なローカル読取と OAuth 付き MCP はホストが提供します。

## はじめる

ホスト側の `status` と、新規クライアントでの OAuth の動作確認が完了するまで、
カタログからの導入は一時停止しています。Codex・Cursor のカタログには現在このパッケージを掲載していません。
ソースからの読込みは開発検証用です。[導入ガイド](docs/getting-started.md)を参照してください。

## 依頼の例

```text
SkillsPlane でアクセスできる Workspace を一覧表示して。
```

```text
コードレビューに使える Workspace Skill を探して、この変更をレビューして。
```

```text
.agents/skills/code-review/SKILL.md を、このリポジトリの接続先 Workspace に同期して。
```

同期用 Skill は `scope: personal` または `scope: workspace` と完全な bundle を送ります。
Team のみ Git 管理された repository binding が必要です。選択した repository ファイルに binding がない場合、Personal に転送せず停止します。同期で commit や push は行わず、作業開始だけで全件同期しません。
Plugin は Skill と Remote MCP 接続を提供し、ローカルファイル操作と承認はホストの既存機能を使います。

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
