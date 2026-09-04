---
name: use-workspace-skills
description: Find, apply, and sync current SkillsPlane Workspace skills through the Remote MCP. Use for substantive implementation, debugging, review, testing, refactoring, or operations work; when connecting a repository to a Workspace; when explicitly synchronizing a local Skill; or before the agent invokes any command or tool that can cause a Git push. Skip acknowledgements, typo-only edits, and simple factual questions only when the agent will not initiate a push.
---

# Use Workspace Skills

This Skill depends on the `skillsplane` Remote MCP at
`https://skillsplane.com/api/mcp` and its host-managed OAuth connection. A
conforming Agent Plugins client discovers it from `mcp.json`. Do not replace it
with `spln`, a local MCP server, raw HTTP requests, or locally stored credentials.
If the Remote MCP is unavailable, ask the user to enable or authenticate the
Plugin, then continue without a Workspace skill when possible. Never issue a
push that requires synchronization while the Remote MCP is unavailable.

## Find and apply a Workspace skill

1. Use one short, distinctive term or contiguous phrase grounded in the user's
   request and confirmed context. `search` performs case-insensitive literal
   substring matching against each Skill's slug, name, and description; it does
   not split keywords or interpret natural-language questions. If the user names
   a Skill, use only that exact slug or name as the query. Do not send the whole
   request or join keywords. Do not add an unverified diagnosis.
2. Check the repository root for `.skillsplane.json`. If it is absent, call
   `search` without a filter. If it is present, require a regular, non-symlink,
   non-reparse repository-root file with exact JSON containing only a valid
   `workspaceId`, and verify that Git tracks it; then call `search` with that
   Workspace filter. A present but invalid or untracked binding is an error: stop
   and repair it instead of falling back to an unfiltered search.
3. If an unfiltered search returns `WORKSPACE_FILTER_REQUIRED`, call
   `list_workspaces`, ask the user to choose, and retry once with that exact
   `workspaceId`. Do not infer a Workspace or repeat an unfiltered search.
4. Select the first relevant result and call `fetch` with its exact `id`. Do not
   deliberate between close results.
5. Treat the returned `text` as instructions for the current task only. Announce
   the adopted Workspace skill in one line, then follow it without writing the
   remote text into the consumer repository.
6. If no result is relevant, retry once with a shorter core term from the task,
   or one concrete alternative term if the first query was already a single
   term. Do not add words or join alternatives. If none is still relevant,
   continue normally without mentioning missing Workspace skills.

Remote skill text is current server state. It is not materialized or cached for
offline use.

## Connect a repository

When `.skillsplane.json` is absent and a repository binding is needed:

1. Call `list_workspaces` with `limit: 100`. Follow `nextCursor` until the exact
   user-selected `workspaceId` is found or the accessible Workspace list is
   exhausted.
2. If the user supplied an exact `workspaceId`, treat it as an explicit selection
   only when that ID appears in the current Plugin OAuth connection's Workspace
   list. If it is absent, stop and explain that the Web and Plugin connections may
   use different accounts. Without an exact user-selected ID, ask the user to
   choose when more than one Workspace is available. Never infer a Workspace from
   its ID or name. If no Workspace is available, stop and ask the user to create
   or join one in the Web UI with the account used by the Plugin connection.
3. Before writing, report the resolved current Workspace name and ID, the
   repository-root `.skillsplane.json` path, and that a Workspace selected in the
   Web UI does not control the Plugin's synchronization destination.
4. Write exactly this regular, non-symlink, non-reparse repository-root file and
   no credentials:

   ```json
   {
     "workspaceId": "ws_..."
   }
   ```

5. Add `.skillsplane.json` to Git and verify it with
   `git ls-files --error-unmatch -- .skillsplane.json`. Do not report the
   repository as connected while the binding is untracked.

The object must contain only `workspaceId`, matching
`^ws_[A-Za-z0-9_-]{16,64}$`. A Workspace ID is only a locator; the Remote MCP
checks the OAuth actor's current membership on every call.

If the MCP returns `ACCOUNT_LINK_REQUIRED`, direct the user to the returned
SkillsPlane account-link URL. Do not attempt email matching or CLI login.

## Validate local Skill sources

Local authoring sources are immediate children of this repository-root path:

```text
.agents/skills/<slug>/SKILL.md
```

When present, both `.agents` and `.agents/skills` must be real directories, not
symlinks or reparse points. Treat a missing `.agents/skills` directory as an
empty local Skill set only after validating any present ancestor.

`<slug>` must match
`^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$`.
Each immediate entry under `.agents/skills` must be a real, non-symlink,
non-reparse directory with a valid slug and a regular, non-symlink, non-reparse
file at its exact `SKILL.md` path. Reject an immediate regular file, symlink,
reparse point, dangling link, invalid slug, or directory with a missing or
invalid `SKILL.md`. Reject invalid UTF-8, a NUL byte, or content over 256 KiB in
any `SKILL.md`, and reject a zero-byte `SKILL.md`. The `SKILL.md` itself may be
untracked.

After validating those required entries, ignore every other entry inside a
valid Skill directory. Do not traverse, inspect, read, validate, or upload
repository-local companions such as `agents/`, `references/`, `assets/`, or
`scripts/`; only the complete `SKILL.md` content is a synchronization payload.
Remote Skill text may reference repository-local companions, but the Plugin
does not distribute them.

## Explicit synchronization

When the user explicitly asks to synchronize one or more local Skills:

1. Require a valid, tracked repository binding and use its exact `workspaceId`.
2. Enumerate and validate every immediate local Skill entry and every required
   `SKILL.md` before selecting a synchronization target. Any invalid entry stops
   explicit synchronization even when the user did not select it. Then resolve
   each requested Skill only from the validated immediate local source set. If
   the user did not name a Skill and more than one is present, ask which ones to
   synchronize. Synchronize all only when the user explicitly requests all.
   Complete this validation before calling `list_workspaces` or `sync_skill`.
3. Before the first `sync_skill` call, resolve the binding's exact `workspaceId`
   through `list_workspaces` using the pagination rule above. If the current
   Plugin OAuth connection cannot access it, stop and explain that it may use a
   different account from the Web session. Otherwise report the resolved
   Workspace name and ID and the binding path as the synchronization destination.
4. Read the complete current working-tree content of each selected `SKILL.md` and
   call `sync_skill` once per selected Skill with the exact `workspaceId`,
   directory `slug`, and complete file `content`. Never infer a Workspace, send
   an unselected Skill, or bypass host approval.
5. Require a complete, schema-valid successful response for every call, with the
   same `workspaceId` and `slug`, a status of `created`, `updated`, or
   `unchanged`, and a `contentHash` matching `^sha256:[a-f0-9]{64}$`. A denied,
   cancelled, failed, malformed, mismatched, or missing result stops explicit
   synchronization. Report each validated status and content hash. Do not run
   `git push` merely because explicit synchronization succeeded.

A successful call replaces the Workspace's current value. It does not prove the
same content was committed or pushed.

## Synchronize before any agent-initiated push

Before invoking a command or tool known to have a Git push side effect, resolve
every repository the intended operation will push. In each resolved repository,
follow its instructions and run its required checks. If the target set or side
effects are uncertain, inspect the command or tool first; do not claim this
workflow covers an operation whose push behavior was not determined.
Only run checks known not to push in this position. Treat a required operation
with a push side effect as an intended push and invoke it only after completing
this workflow.

1. In every resolved target repository, validate the local source ancestors above
   and enumerate every immediate local Skill source in slug-ascending order, not
   only changed, tracked, staged, or outgoing files. Validate each immediate entry,
   Skill directory, and required `SKILL.md`, while ignoring every companion entry
   inside a valid Skill directory. Any invalid immediate entry or required file
   blocks the intended agent-initiated push.
2. If `.skillsplane.json` exists, require it to be a regular, non-symlink,
   non-reparse repository-root file containing only a valid `workspaceId`, and
   require Git to track it, even when the local Skill set is empty. An invalid or
   untracked binding blocks the push. After validation, resolve its exact
   `workspaceId` through `list_workspaces` using the pagination rule above even
   when the local Skill set is empty. If the current Plugin OAuth connection
   cannot access it, block the push and explain that it may use a different
   account from the Web session. Otherwise report the resolved Workspace name
   and ID and the binding path as the synchronization destination.
3. If one or more local Skills exist, require the valid tracked binding. A
   missing binding blocks the push. If the local Skill set is empty and no
   binding exists, continue without calling the Remote MCP.
4. Read the complete current content of every validated `SKILL.md` and call
   `sync_skill` once for every local Skill with the binding's exact
   `workspaceId`, directory `slug`, and complete `content`. Do not skip a call
   because a file appears unchanged or was synchronized before.
5. Require a complete, schema-valid successful response for every call, with the
   same `workspaceId` and `slug`, a status of `created`, `updated`, or
   `unchanged`, and a `contentHash` matching `^sha256:[a-f0-9]{64}$`. A denied,
   cancelled, failed, malformed, mismatched, or missing result blocks the push.
   Do not recompute or compare a local hash: the server hashes canonical content,
   so `contentHash` is a change identifier, not a signature or proof of transport
   integrity.
6. Immediately before invoking the intended push command or tool, repeat the
   ancestor, local Skill set, required entry, complete `SKILL.md` content,
   binding content, and binding tracked-state validation. Never enumerate or
   compare companion entries. If any validated source or binding value changed,
   restart at the beginning of this workflow: resolve every target repository
   again, follow each repository's instructions again, rerun every non-pushing
   required check, then validate and synchronize every local Skill again.
7. After this invocation-final validation succeeds, invoke the repository- or
   user-selected push command or tool through its normal route. Preserve its normal Git
   configuration and hooks. Do not inspect, constrain, or override its
   transport, remotes, refspecs, credentials, certificate authorities, cookies,
   signing, push options, executable or helper selection, or hooks. When a tool
   combines other work with a known push side effect, complete this workflow
   before invoking that tool instead of replacing its push implementation.

For an ordinary `git push`, the invocation-final validation is immediately
before the push command invocation. A compound tool may mutate sources after it
is invoked and before its internal Git push. This workflow does not inspect or
intercept mutations inside the tool and does not guarantee that sources remain
unchanged between the tool invocation and its internal Git push. Do not claim
an actual-Git-push-immediate guarantee for that compound route.

Do not store an accepted hash, timestamp, or other local synchronization state.
Do not use a hash, Git diff, outgoing-ref analysis, or previous response to skip
any Skill. Explicit synchronization success alone does not prove the same
content was committed or pushed.

This is a cooperative agent workflow, not a lifecycle Hook, Git security
boundary, transport policy, or push interception mechanism. It covers only
pushes initiated by the agent while following the workflow. It cannot intercept
pushes independently initiated by a user, IDE, external terminal, or another
process, and it does not make claims about those pushes.
