# SkillsPlane Agent Plugin

**Bring your team's current Skills into your agent's work.**

SkillsPlane connects your agent to a shared Workspace so it can find relevant
Skills, follow their current instructions, and sync Skills you author in a
repository. It is a portable [Agent Plugin](https://agent-plugins.org/), licensed
under [Apache 2.0](LICENSE).

[日本語](README.ja.md) · [Get started](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/) · [Contribute](CONTRIBUTING.md)

## What you can do

- **Use shared instructions.** Find a Workspace Skill and apply its current
  instructions to an implementation, review, or other task.
- **Connect a repository.** Choose the Workspace your repository uses for Skill
  discovery and synchronization.
- **Share what you author.** Sync a selected repository-local `SKILL.md` and its
  supported companion files to the Workspace. Before an agent-initiated push, the bundled workflow syncs all
  local Skills in each target repository.

The Plugin carries the workflow; your Workspace holds the Skills. Authentication
uses your agent client's OAuth connection to SkillsPlane.

```text
Your agent → SkillsPlane Plugin → SkillsPlane Workspace
             find · apply · sync
```

## Get started

You need a SkillsPlane account, access to a Workspace, and an Agent Plugins client
that supports Skills, Streamable HTTP MCP, and OAuth. Plugin installation and
enablement follow your client's instructions.

1. Open [SkillsPlane](https://skillsplane.com/) and create or join a Workspace.
2. Install using the Codex or Cursor instructions below, then enable the Plugin
   and complete its OAuth sign-in.
3. Open a new task. Ask the agent to show the SkillsPlane Workspaces it can access,
   then select the Workspace to connect to your repository.
4. Ask the agent to find and apply a relevant Workspace Skill.

### Codex

```sh
codex plugin marketplace add https://github.com/AmatoAI/skillsplane.git
codex plugin add skillsplane@skillsplane
```

### Cursor

Use **Dashboard → Plugins → Add Marketplace → Import from Repo** on a
Teams/Enterprise plan with `https://github.com/AmatoAI/skillsplane`, or install
the portable package locally. See the [installation guide](docs/getting-started.md)
for local installation, authentication and connection checks.

## Try it

```text
Show my SkillsPlane Workspaces and connect this repository to the one I select.
```

```text
Find a Workspace Skill for code review and use it to review this change.
```

```text
Sync .agents/skills/code-review/SKILL.md to this repository's connected Workspace.
```

The sync example assumes that local Skill exists. Sync replaces the Workspace
Skill's current content; it does not create a Git commit or push by itself.

## Package and availability

The portable package targets **Agent Plugins 1.0.0**. Its manifest version is
currently **0.1.0**. The complete distribution unit is:

```text
plugins/agent-plugins/skillsplane/
├── LICENSE
├── plugin.json
├── mcp.json
└── skills/use-workspace-skills/SKILL.md
```

The Remote MCP endpoint is `https://skillsplane.com/api/mcp`. The bundle workflow
requires five tools: `list_workspaces`, `search`, `fetch`, `fetch_skill_file`, and
`sync_skill`. Bundle support requires the matching hosted-service rollout; source
validation alone does not establish production availability. Do not activate this
workflow through the public catalogs until the live service checks pass.

Codex and Cursor catalogs both reference this one standard package. No client
adapter or build step is required. Client installation support does not establish
production OAuth or end-to-end service verification; those checks and official
catalog listings are separate. See the
[compatible client list](https://agent-plugins.org/compatible-clients).

## Data and permissions

- A tracked `.skillsplane.json` records only the repository's Workspace ID. The
  server checks your account's access on every call.
- Sync sends repository-local `.agents/skills/<slug>/SKILL.md` and bounded files
  under `scripts/`, `references/`, and `assets/`, plus supported root license and
  notice files. `agents/` stays local. Hashes are internal server checks, not
  user-facing synchronization results.
- Sync replaces the complete bundle: omitted companions are deleted, and an empty
  companion list removes all companions. There is no remote history or undo.
- The Plugin relies on host-managed OAuth and does not maintain its own token
  store or offline Skill cache. The client controls permissions and conversation
  retention.
- The push workflow depends on the agent following its instructions. It does not
  intercept pushes made independently by a user, IDE, or another process.

See [Security](SECURITY.md) for reporting guidance and the full trust boundary.

## Contributing

Bug reports, documentation fixes, and focused improvements are welcome in
[Issues](https://github.com/AmatoAI/skillsplane/issues) and pull requests.
English and Japanese are both welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
for development and verification, and [SECURITY.md](SECURITY.md) for vulnerability reports.
