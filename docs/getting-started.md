# Getting started

[Back to README](../README.md) · [日本語の概要](../README.ja.md)

## Prerequisites

- A [SkillsPlane](https://skillsplane.com/) account with access to a Workspace.
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
Skill. No build or npm package installation is needed to load it. Node.js and
pnpm are development dependencies for this repository's validation tools.

Installation, enablement, and updates are client-managed; Agent Plugins does
not define a universal install command. Use a release's exact commit when
reproducing a published artifact.

### Codex development install

For Codex versions exposing `codex plugin` and supporting portable Agent Plugins,
run these commands from the cloned repository root:

```sh
codex plugin marketplace add .
codex plugin add skillsplane@skillsplane-development
```

This registers the repository's development marketplace and installs its portable
package. It does not register a public catalog listing. See
[OpenAI's Plugin documentation](https://developers.openai.com/plugins) for the
client's Plugin model. If the command is unavailable, check your client version
and its Plugin support before continuing.

Start a new task after installation. Enable the Plugin and complete the
SkillsPlane OAuth flow offered by the client. The configured Remote MCP endpoint
is `https://skillsplane.com/api/mcp`. Use the client's connection flow rather
than adding tokens to repository files.

## Connect your repository

Open the repository where you want to use Skills, then ask:

```text
Show the SkillsPlane Workspaces I can access, then connect this repository to the one I select.
```

The agent calls `list_workspaces`. Select a Workspace from that result. The agent
checks access, reports the destination, writes the repository-root
`.skillsplane.json`, and adds it to Git. It stores only the exact Workspace ID.

Alternatively, copy the connection request from your Workspace's Web page. The
agent verifies that the exact ID is visible through its Plugin OAuth connection.
Selecting a Workspace in the Web UI alone does not bind the repository or change
the Plugin's sync destination. The Web session and Plugin may use different
accounts.

## Find and apply a Skill

```text
Find a Workspace Skill for code review and use it to review this change.
```

The agent searches enabled Skills and fetches a relevant Skill's current
instructions. Search matches a literal substring of the slug, name, or
description, so a short name or phrase works best. If nothing relevant exists,
the agent can continue with the task without a Workspace Skill.

You can verify the read path by asking the agent to list Workspaces, search for
an existing Skill by its exact name, and fetch that result. Do not test write
access by overwriting a real Skill unnecessarily.

## Share a local Skill

Author a Skill at `.agents/skills/<slug>/SKILL.md` in the connected repository.
For example, create `.agents/skills/code-review/SKILL.md` with:

```md
---
name: code-review
description: Review a code change for correctness and missing behavioral coverage.
---

Read the repository instructions and the proposed diff. Report concrete defects
with file locations, explain their impact, and identify relevant missing tests.
```

Then ask:

```text
Sync .agents/skills/code-review/SKILL.md to the connected Workspace.
```

The agent validates all immediate local Skill entries, confirms the bound
Workspace is accessible, and syncs the selected Skill. Each successful response
reports `created`, `updated`, or `unchanged`, with a server content hash. A sync
replaces that Workspace Skill's current content. It does not commit or push Git
changes by itself.

In this version, only `SKILL.md` is synchronized. Companion files in `scripts/`,
`references/`, `assets/`, and `agents/` stay local. Global Skills and Skills
installed by other Plugins are not implicitly uploaded.

Before a push initiated by the agent, the bundled workflow synchronizes all local
Skills in every target repository. A binding is required when local Skills exist.
With no local Skills and no binding, the workflow continues without Remote MCP
calls. An invalid source or binding, denied sync, or failed response stops that
push workflow. It does not intercept a push started independently by you or your IDE.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Plugin or tools do not appear | Confirm the installed root contains `plugin.json`, enable the Plugin, and start a new task. Check your client's portable Plugin and MCP support. |
| OAuth is incomplete or disconnected | Reconnect SkillsPlane through the client's connection settings. |
| `ACCOUNT_LINK_REQUIRED` | Follow the account-link URL returned by SkillsPlane. |
| Workspace appears on the Web but not in the Plugin | Check that both connections use the intended account and that it is a Workspace member. |
| No Workspaces are returned | Create or join a Workspace using the Plugin connection's account, then retry. |
| `WORKSPACE_FILTER_REQUIRED` | List accessible Workspaces, select one, and retry with that exact Workspace ID. |
| Binding is invalid or untracked | Ask the agent to repair the repository-root `.skillsplane.json` and add it to Git; do not bypass it with an unfiltered search. |
| Skill search returns nothing | Check the Workspace and that the Skill is enabled; try its exact name or a shorter term. |
| Sync or push is blocked by a local Skill | Correct the reported path/content issue. Every immediate Skill directory needs a valid, nonempty, regular `SKILL.md`; symlinks are rejected. |

For unresolved problems, open a [bug report](https://github.com/AmatoAI/skillsplane/issues/new)
with the Plugin commit/version, client version, and redacted error details.
See [Security](../SECURITY.md) before including sensitive information.
