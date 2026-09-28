<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/wordmark-dark.svg">
  <img src="docs/assets/wordmark-light.svg" alt="SkillsPlane" width="420">
</picture>

# SkillsPlane

**The right Skill. For the work at hand.**

SkillsPlane helps your agent **search for relevant Skills, select what fits the
task, and sync improvements**. A Skill is a reusable set of written instructions.
Ask for the work you need; your agent searches for candidates and reads their
content before choosing what to use.

[日本語](README.ja.md) · [Getting started](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/)

> **Source preview:** the source is public; catalog installation is not yet available.
> The [guide](docs/getting-started.md) explains the current development-only setup.

## Search. Select. Sync.

| Step | What it does |
| --- | --- |
| Search | Find Skills relevant to your current request. |
| Select | Let your agent read the candidates and choose instructions that fit the task. |
| Sync | Update managed Skills after completing changes or when you request it. |

Search results are candidates, not a guarantee of suitability. Your agent checks
the content, and you review the work it produces. After a successful sync, the
next fetch returns the updated instructions.

## Start with the work you need

With a relevant Skill saved in Personal or a Team Workspace you can access,
ask your connected agent:

```text
Check this change for missing translations.
```

Your agent can search for a translation-check Skill and select it for the task.
When you improve those instructions:

```text
Add a check for missing plural forms and sync the updated Skill.
```

These are examples, not a bundled template library. Personal Skills are private;
Team Workspaces make Skills available to authorized teammates.

## How is this different from Git?

Git can share Skills and track their history. SkillsPlane helps find relevant
Skills for the current request and supports your agent in selecting what fits.
Synchronization makes improved instructions available for later retrieval.
Normal work, Git pushes, and task start do not trigger a full sync.

See [getting started](docs/getting-started.md) for availability and setup.
A SkillsPlane account and a compatible agent are required.

<details>
<summary>Package, permissions, and development</summary>

## Package and availability

The portable package targets **Agent Plugins 1.0.0**. Its manifest version is
currently **0.1.0**. The complete distribution unit is:

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

The Remote MCP endpoint is `https://skillsplane.com/api/mcp`. The bundle workflow
requires five tools: `status`, `search`, `fetch`, `fetch_skill_file`, and
`sync_skill`. Bundle support requires the matching hosted-service rollout. The
Codex and Cursor repository catalogs remain empty until the matching five-tool
contract and fresh-client OAuth have passed live verification. A repository catalog is separate from an
official client-owned marketplace listing. See the
[compatible client list](https://agent-plugins.org/compatible-clients).

## Data and permissions

- The Server checks OAuth membership on every call. A repository binding is a locator.
- Synchronization sends validated complete local bundles, updating supplied
  companions and preserving unsent companions. There is no remote history or undo.
- Host approval and safe filesystem reads are code boundaries. Limits are 768 KiB
  for SKILL.md, 64 MiB per companion, 256 companions, 256 MiB per bundle.
  Hosts transfer original bytes directly through short-lived HTTPS URLs and verify SHA-256.
  Sync uses begin → direct PUT → complete; file bytes never pass through MCP.
- Retrieved companions are temporary task-scoped files. No credential store,
  offline cache or retry daemon is added.
- Normal work, push, PR creation and merge never wait for synchronization.
- Local tests are not proof of native client activation or production OAuth success.

See [Security](SECURITY.md) for reporting guidance and trust boundaries.

## Contributing

Bug reports, documentation fixes, and focused improvements are welcome in
[Issues](https://github.com/AmatoAI/skillsplane/issues) and pull requests.
English and Japanese are both welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
for development and verification, and [SECURITY.md](SECURITY.md) for vulnerability reports.

## Setup after installation

Use one supported installation method to make the Plugin persistently available.
Do not reinstall an available Plugin. Then ask the agent to follow the `setup` Skill
to verify Plugin / OAuth availability, Personal access, and any requested or existing
Repository binding. Initial sync follows
`sync-workspace-skills`: complete local bundles update the same destination and slug.

</details>
