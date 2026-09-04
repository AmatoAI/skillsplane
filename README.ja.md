# SkillsPlane Agent Plugin

**チームの最新の Skill を、エージェントの作業に。**

SkillsPlane は、Workspace で共有する Skill をエージェントから検索・適用し、
リポジトリで作成した Skill を同期するための
[Agent Plugin](https://agent-plugins.org/) です。
[Apache 2.0](LICENSE) で提供する、クライアントに依存しない形式のパッケージです。

[English](README.md) · [導入ガイド](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/) · [開発への参加](CONTRIBUTING.md)

## できること

- **共有した指示を使う。** 実装やレビューに合う Workspace Skill を探し、最新の指示を適用します。
- **リポジトリを接続する。** Skill の検索先・同期先となる Workspace を選びます。
- **作成した Skill を共有する。** リポジトリ内の `SKILL.md` を指定して同期できます。
  エージェントが push する前には、対象リポジトリの全ローカル Skill を同期します。

Plugin は利用手順を提供し、Workspace が Skill 本文を管理します。
認証には、エージェントのクライアントが管理する SkillsPlane への OAuth 接続を使います。

## はじめる

SkillsPlane のアカウントと Workspace への参加権限、および Skills・Streamable HTTP MCP・
OAuth に対応した Agent Plugins クライアントが必要です。

1. [SkillsPlane](https://skillsplane.com/) で Workspace を作成するか、既存の Workspace に参加します。
2. 下記の Codex または Cursor の手順で導入し、Plugin を有効にして OAuth 認証を完了します。
3. 新しいタスクで、アクセスできる Workspace をエージェントに一覧表示させ、接続先を選びます。
4. 作業に合う Workspace Skill の検索・適用を依頼します。

### Codex

```sh
codex plugin marketplace add https://github.com/AmatoAI/skillsplane.git
codex plugin add skillsplane@skillsplane
```

### Cursor

Teams/Enterprise では **Dashboard → Plugins → Add Marketplace → Import from Repo** に
`https://github.com/AmatoAI/skillsplane` を指定します。ローカル導入も可能です。
同じ標準パッケージを使う手順と認証・接続確認は
[導入ガイド](docs/getting-started.md) を参照してください。

## 依頼の例

```text
SkillsPlane でアクセスできる Workspace を一覧表示して、私が選んだものにこのリポジトリを接続して。
```

```text
コードレビューに使える Workspace Skill を探して、この変更をレビューして。
```

```text
.agents/skills/code-review/SKILL.md を、このリポジトリの接続先 Workspace に同期して。
```

同期の例は、そのローカル Skill が存在することを前提とします。
同期は Workspace Skill の現在の内容を置き換えます。同期だけで commit や push は行いません。

## パッケージと提供状況

Agent Plugins **1.0.0** 形式に対応し、現在の manifest version は **0.1.0** です。
配布単位は次のディレクトリです。

```text
plugins/agent-plugins/skillsplane/
├── LICENSE
├── plugin.json
├── mcp.json
└── skills/use-workspace-skills/SKILL.md
```

Remote MCP の接続先は `https://skillsplane.com/api/mcp` です。
利用するツールは `list_workspaces`、`search`、`fetch`、`sync_skill` の4つです。

Codex と Cursor のカタログは、同じ標準パッケージを参照します。
クライアント別の Plugin 本体やビルドは不要です。インストール対応と、本番 OAuth・
一連のサービス動作の確認、公式カタログへの掲載は別です。
[標準の対応クライアント一覧](https://agent-plugins.org/compatible-clients) も参照してください。

## データと権限

- Git 管理する `.skillsplane.json` には接続先 Workspace ID だけを記録します。
  サーバーが各操作でアカウントのアクセス権を確認します。
- 同期対象は `.agents/skills/<slug>/SKILL.md` の本文です。この version では
  `scripts/`、`references/`、`assets/` などの添付ファイルはローカルに残ります。
- Plugin 自身は認証情報の保管や Skill のオフラインキャッシュを行いません。
  権限や会話の保存は利用するクライアントの設定に従います。
- push 前同期はエージェントが指示に従うことで動作します。
  ユーザー・IDE・別プロセスが独立して行う push を止める仕組みではありません。

開発と検証は [CONTRIBUTING.md](CONTRIBUTING.md)、脆弱性報告は
[SECURITY.md](SECURITY.md) を参照してください。不具合や文書の改善は
[Issues](https://github.com/AmatoAI/skillsplane/issues) と Pull Request で受け付けます。
日本語・英語のどちらも歓迎します。
