# SkillsPlane Agent Plugin

**Bring your personal and team Skills into your agent's work.**

SkillsPlane connects your agent to your Personal Skills and Team Workspaces so it can find relevant
Skills, follow their current instructions, and sync Skills you author in a
repository. It is a portable [Agent Plugin](https://agent-plugins.org/), licensed
under [Apache 2.0](LICENSE).

[日本語](README.ja.md) · [Get started](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/) · [Contribute](CONTRIBUTING.md)

## What you can do

- **Use shared instructions.** Search and fetch Workspace Skill text over the
  client's OAuth connection, then apply relevant instructions to the task.

The package separates `setup` (post-install configuration),
`use-workspace-skills` (discovery/application), and
`sync-workspace-skills` (completed managed Skill changes or explicit sync requests).
Repository scope uses the tracked `<repo>/.skillsplane.json` Team binding and
`<repo>/.agents/skills/`. User scope reads `~/.agents/skills/` and syncs directly
to your Personal Skill Space through OAuth; no personal binding or Workspace
selection is needed. An explicit scope and source path must agree. Invalid
repository bindings never redirect to Personal. The host must support safe file
access and authenticated MCP calls. Personal and Team namespaces are independent.

## Get started

Catalog installation is temporarily unavailable while the hosted `status` tool
and fresh-client OAuth are being verified. The Codex and Cursor catalogs do not
currently list this package. Source loading is for development validation only;
see the [installation guide](docs/getting-started.md).

## Try it

```text
Show my SkillsPlane Workspaces so I can select one.
```

```text
Find a Workspace Skill for code review and use it to review this change.
```

```text
Sync .agents/skills/code-review/SKILL.md to this repository's connected Workspace.
```

The sync Skill calls Remote MCP `sync_skill` with complete bundles and an explicit
`scope`. Only Team operations carry a `workspaceId` and require a tracked binding.
Sync does not commit or push, and task start does not trigger a full sync.
The Plugin supplies Skills and the Remote MCP connection; local file operations
and approvals use the host's existing capabilities.

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
