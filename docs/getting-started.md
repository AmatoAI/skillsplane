# Getting started

[Back to README](../README.md) · [日本語の概要](../README.ja.md)

Catalog installation is temporarily unavailable. The `status` tool and fresh-client
OAuth have not yet passed live verification for this package. Both repository
catalogs are empty; source-loading instructions below are for development
validation only, not a verified production installation.

## Prerequisites

- A [SkillsPlane](https://skillsplane.com/) account. Signing in provisions a private Personal Skill space; Teams are optional.
- An Agent Plugins client that loads Skills and Streamable HTTP MCP servers and
  supports host-managed OAuth. See the standard's
  [client list](https://agent-plugins.org/compatible-clients) and your client's
  installation documentation.
- Git if you want to install from this source repository.

SkillsPlane's hosted service provides Workspace storage and access control. The
Apache 2.0 license covers this Plugin's source; using the hosted service requires
an account and the relevant Workspace permissions.

## Install from source

Clone the repository and locate the portable package:

```sh
git clone https://github.com/AmatoAI/skillsplane.git
cd skillsplane
```

Pass `plugins/agent-plugins/skillsplane/` to your client's local Plugin loader.
That directory contains `plugin.json`, `mcp.json`, the license, and the bundled
Skills. No build or npm package installation is needed to load it. Node.js and
pnpm are development dependencies for this repository's validation tools.

Installation, enablement, and updates are client-managed; Agent Plugins does
not define a universal install command. Use a release's exact commit when
reproducing a published artifact.

### Codex catalog availability

The repository catalog has no installable entries until the matching hosted
five-tool contract and fresh-client OAuth are verified. Adding this repository
as a marketplace does not currently make `skillsplane@skillsplane` installable.

### Cursor: install the same Agent Plugin

Cursor supports the root `plugin.json` and standard `mcp.json` directly; no
Cursor-specific Plugin manifest or duplicate Skill is needed.

For a local install, clone this repository as above, then run from its root:

```sh
mkdir -p ~/.cursor/plugins/local
ln -s "$PWD/plugins/agent-plugins/skillsplane" ~/.cursor/plugins/local/skillsplane
```

If the destination already exists, inspect the existing installation before
replacing it. Restart Cursor or run **Developer: Reload Window**, then open
**Customize** and confirm `setup`, `use-workspace-skills`, `sync-workspace-skills`, and the SkillsPlane MCP server.
Local Plugin imports must be allowed by your organization's policy. An installed
marketplace Plugin with the same name takes precedence over a local copy.

The Cursor repository catalog also has no installable entries. Importing this
repository as a marketplace does not currently distribute the package.

### Other clients

Use `plugins/agent-plugins/skillsplane/` as the Plugin root in clients that
support Agent Plugins 1.0.0, Skills, Streamable HTTP MCP, and OAuth. A Git
repository root and a Plugin root are different in this repository.

Claude Code's marketplace format is different. These commands and catalogs do
not provide a Claude Code installation; this repository publishes one standard
Agent Plugin rather than a Claude-specific adapter.

### Set up after installation

Use one supported persistent installation method and reuse an already available
Plugin. Ask the agent to follow the bundled `setup` Skill after installation.
It checks Plugin and OAuth availability, configures Personal without a binding,
and handles Team binding only for an existing repository binding or an explicit
request to connect the repository. Initial sync follows `sync-workspace-skills`, using complete local bundles
to create or update Skills in the configured scope.

### Authenticate

Start a new task after installation. Enable the Plugin and complete the
SkillsPlane OAuth flow offered by the client. The configured Remote MCP endpoint
is `https://skillsplane.com/api/mcp`. Use the client's connection flow rather
than adding tokens to repository files.

## Find and apply a Skill

Ask: "Find a Workspace Skill for code review and use it to review this change."
The usage Skill follows `search` → `fetch` → `fetch_skill_file` when companions
are needed. A valid repository-root binding selects `scope: "workspace"` and its Team ID;
without a binding, use `scope: "personal"` without a Workspace ID. Search uses a
task and its important constraints. Search uses the complete SKILL.md, including frontmatter. Attachments are not searched. New and updated Skills can take time to appear in search; saving and indexing are separate.
If Workspace selection is required, list accessible Workspaces and choose one.
The Web session's selection does not choose the Plugin's account or Workspace.

## Synchronize managed Skills

The separate `sync-workspace-skills` Skill uses Remote MCP `sync_skill` after a
managed Skill change is complete or on an explicit request. Normal usage and task
start do not trigger synchronization. Git push, PR and merge remain independent.

| Scope | Binding | Managed root |
| --- | --- | --- |
| Repository | `<repo>/.skillsplane.json` | `<repo>/.agents/skills/` |
| User / Personal | OAuth account; no binding | `~/.agents/skills/` |

Honor an explicit scope. Otherwise an existing repository binding selects Repository;
its absence, including outside Git, selects User. Invalid bindings stop their scope.
Never read or write `~/.skillsplane.json`. Repository binding must be Git-tracked.
A selected repository file with missing/invalid binding must stop, never fall back to Personal. Send only changes in the selected root,
or the explicitly requested Skills. Never redirect files from another scope.

Each sync begins with the complete `files` manifest, including `SKILL.md` even
when there are no companions. The host uploads each original to its signed PUT
URL, then calls `complete`. Unsent companions are preserved after completion.
Same Workspace ID and slug update the same remote Skill
within that space; Personal and Team slugs are independent. Confirmed writes remain after a later failure.

Host safe filesystem access, OAuth and approvals are required. The Plugin uses
the host's existing tools; it does not install a local runtime or host adapter.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Plugin or tools do not appear | Confirm the installed root contains `plugin.json`, enable the Plugin, and start a new task. Check your client's portable Plugin and MCP support. |
| OAuth is incomplete or disconnected | Reconnect SkillsPlane through the client's connection settings. |
| `ACCOUNT_LINK_REQUIRED` | Follow the account-link URL returned by SkillsPlane. |
| Workspace appears on the Web but not in the Plugin | Check that both connections use the intended account and that it is a Workspace member. |
| No Workspaces are returned | This is normal for Personal-only accounts. Search Personal; create/join a Team only when needed. |
| Scope selection is invalid | Personal requires no Workspace ID; Workspace requires an exact Team ID. |
| Binding is invalid or untracked | Repair the binding through the host integration; an invalid binding must not fall back to Personal. |
| Skill search returns nothing | Check the Workspace and that the Skill is enabled; try its exact name or a shorter term. |
| Sync fails on a local Skill | Correct the reported path/content issue. Every immediate Skill directory needs a valid, nonempty, regular `SKILL.md`; symlinks are rejected. |

For unresolved problems, open a [bug report](https://github.com/AmatoAI/skillsplane/issues/new)
with the Plugin commit/version, client version, and redacted error details.
See [Security](../SECURITY.md) before including sensitive information.
