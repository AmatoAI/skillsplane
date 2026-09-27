# SkillsPlane

**「そのやり方、私のAIにも教えて。」**

AIに何度も説明して、ようやく自分好みの仕事ができるようになった。
でも隣の人は、また同じことを一から説明している。

SkillsPlaneは、うまくいった仕事の手順を **Skill** として残し、
仲間のAIでも使えるようにするPluginです。
まず自分の定番をひとつ。役に立ったら、同じ仕事をする人へ。

[English](README.md) · [使い方を見る](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/)

> **ソース先行公開中：** カタログからの導入はまだ利用できません。
> 現在の開発検証用セットアップは[導入ガイド](docs/getting-started.md)をご覧ください。

## 「毎回説明していること」を、みんなの定番に

| こんなこと、ありませんか？ | 共有できるやり方 |
| --- | --- |
| 「議事録には決定事項・担当・期限を入れて」と毎回伝えている | チームで使う議事録のまとめ方 |
| あの人のレビュー観点を、ほかのメンバーにも使ってほしい | 得意な人が書き出したチェックリスト |
| 別の作業でも、また同じ文体や構成を説明している | 自分やチームが大切にしている文章の書き方 |

これは自分で作って共有できるSkillの例です。付属テンプレート集ではありません。
Skillは、繰り返し使えるように書いた仕事の手順。何を残し、誰と使うかは自分で選べます。

## 最初は、役立つ手順をひとつだけ

1. **いつも説明していることを選ぶ。** 議事録の形式、レビューの観点、提案書を出す前の確認など。
2. **手順をSkillとして残す。** 自分用はPersonalに。チームで使うものはTeam Workspaceへ。
3. **いつもの言葉で仕事を頼む。** 接続した仲間のエージェントも、必要に応じて共有された手順を見つけて使えます。

たとえば、チームで議事録のSkillを共有したら：

```text
チームの議事録のまとめ方を使って、この打合せメモを整理して。
```

使いながら、手順を磨くこともできます：

```text
決定事項と未決事項を分けるように手順を直して、Skillを更新して。
```

一人が磨いた手順を、仲間も次の仕事で使えるように。
共有された手順を使った結果も、その仕事に合っているか確認して仕上げます。

## 成果物だけでなく、その「作り方」を渡そう

よい議事録を渡せば、その会議に役立つ。
まとめ方も渡せば、次の人の仕事にも役立ちます。

「それ、どうやったの？」と聞かれたら、どんな仕事に使える手順なのかも一緒に紹介してください。
共有は、アクセス権のあるTeam Workspaceで。自分用のSkillが勝手に公開されることはありません。

**同僚への紹介に、そのまま使える一文：**

> AIに毎回説明していること、チームで共有しませんか。
> SkillsPlaneは、一人が磨いた仕事の手順を、仲間のAIでも使えるようにするPluginです。
> まずは議事録・レビュー・文章の書き方のうち、よく使うものをひとつから。
>
> ソース先行公開中：https://github.com/AmatoAI/skillsplane

## 次に同じ仕事をする人を、一人思い浮かべてください

その人が次の仕事で使えそうな手順を、ひとつ選ぶところから。
「紹介された人の仕事に役立った」が、最初の目標です。

現在の提供状況とセットアップは[導入ガイド](docs/getting-started.md)へ。
利用にはSkillsPlaneのアカウントと対応エージェントが必要です。

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
