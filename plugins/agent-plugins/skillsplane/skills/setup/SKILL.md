---
name: setup
description: Set up the SkillsPlane Plugin after installation. Use for connection checks, User / Personal setup, Repository / Team binding, and the initial sync of existing local Skills.
---

# Set up SkillsPlane

Make the SkillsPlane Plugin ready to use and, when needed, connect the current repository to a Team Workspace.

Preserve existing valid configuration.

## 1. Plugin and authentication

Verify that the SkillsPlane Plugin, its bundled Skills, and its MCP tools are available. If any required capability is unavailable, report it and do not report setup as complete.

Call `status` to verify access and report the connected account (display name and email). If authentication is required, use the Plugin's host-managed OAuth flow. Tool availability alone does not prove authentication.

## 2. User / Personal setup

User scope uses the current OAuth account's Personal Skill Space, resolved by the Server.

- Do not select a Workspace or save a `workspaceId` for Personal.
- Do not create or read `~/.skillsplane.json`.
- Use `scope: "personal"` without `workspaceId`.
- An empty Team list does not prevent Personal use.

A successful `status` verifies the connected account. An empty `workspaces` array is normal for Personal-only accounts. If authentication or access fails, report setup as incomplete.

## 3. Repository / Team setup

Check whether the current directory is inside a Git repository. Being in a repository alone does not request a new binding.

Perform Repository setup only when:

- the repository root already contains `.skillsplane.json`, or
- the user asks to connect the current repository to SkillsPlane.

For an existing binding, validate its exact Team `workspaceId` directly through the MCP. Follow the binding validation rules in `sync-workspace-skills`.

Do not re-resolve an existing binding with `status`. If the binding is invalid or access cannot be verified, stop Repository setup without falling back to Personal.

When connecting a repository without a binding, select from `status.workspaces`. Follow `nextCursor` until all pages are read before deciding whether there are zero, one, or multiple Teams:

- No Teams: explain that the user must create or join a Team Workspace.
- One Team: use that Team.
- Multiple Teams: ask the user to choose.

Do not infer a Workspace from the repository name or other context.

Save the selected Team in `.skillsplane.json` at the repository root:

```json
{
  "workspaceId": "ws_..."
}
```

The binding must be Git tracked. If newly created, stage only `.skillsplane.json`; do not commit or modify unrelated staged changes.

Ask before changing an existing binding to a different Workspace.

## 4. Initial sync

When initial synchronization is requested, synchronize the existing local Skills in each successfully configured scope according to `sync-workspace-skills`. A connection-check-only request does not request synchronization.

| Setup | Destination | Local root |
| --- | --- | --- |
| User | Personal | `~/.agents/skills/` |
| Repository | Connected Team Workspace | `<repo>/.agents/skills/` |

`sync-workspace-skills` determines which Skill bundles are eligible and performs validation and synchronization.

Use the normal `sync_skill` operation. Sync the complete local bundle. If a Skill with the same slug already exists at the same destination, the local bundle updates it, while preserving remote companions omitted from the bundle.

Never sync a Skill to another scope or fall back between Personal and Team.

## 5. Completion

Briefly report:

- Plugin / OAuth status and connected account
- Personal setup status
- Repository binding status
- Skills initially synced
- Failed or pending Skills

Include one [Manage in SkillsPlane](https://skillsplane.com/workspaces) link so the user can view their Skills and manage Workspaces. Reuse the link from the initial sync report if already shown; do not repeat it or open the browser unless requested.
