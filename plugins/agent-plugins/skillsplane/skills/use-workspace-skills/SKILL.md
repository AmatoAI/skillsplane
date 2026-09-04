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
   remote text into the consumer repository. First validate the response's exact
   selected Skill ID, bound Workspace (when present), canonical slug,
   and the complete manifest against the source path,
   count, size, and executable policy below. Reject malformed manifests.
6. If no result is relevant, retry once with a shorter core term from the task,
   or one concrete alternative term if the first query was already a single
   term. Do not add words or join alternatives. If none is still relevant,
   continue normally without mentioning missing Workspace skills.

7. Fetch only the companions needed for the task with `fetch_skill_file`, using
   the exact Skill ID and manifest path. Do not eagerly fetch every file. Before
   using a file, require the same `id`, `workspaceId`, and `slug`
   as the manifest, plus identical `path`, `size`, and `executable`.
   Decode canonical base64 and check decoded byte length.
   A mismatch, missing requested file, or failed
   call stops dependent work; fetch a fresh manifest and discard the old task
   files before retrying. Unrequested files are not missing.
   Each fetch reads current state; separate calls are not a pinned snapshot.
   Stored-content checks are internal to the Server. Do not request, compare,
   or report content or bundle hashes.
   Materialize verified files only in a fresh task-scoped temporary directory,
   preserving safe relative paths with non-link ancestors and exclusive file
   creation. Set execute bits only for scripts declared executable; keep all other files non-executable.
   On hosts without POSIX modes, use the host's normal interpreter/permission model.
   Include verified SKILL.md there if relative resolution needs it.
   Never write remote files into the consumer repository or a durable cache.
   Fetch required dependencies before running a script and use the host's normal
   approval flow; do not execute remote scripts automatically.

Remote Skill bundles are current server state. Delete task-scoped materialized
files when no longer needed; this is not an offline cache.

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

For each valid Skill, recursively include regular files only under `scripts/`,
`references/`, and `assets/`. Those roots and every nested directory must be
real directories. Reject symlinks, reparse points, dangling links, special
files, unsafe relative paths, duplicate paths, a companion file over 256 KiB,
more than 100 companion files, or a complete bundle over 1 MiB. Record the
executable bit only for files under `scripts/`; files under `references/` and
`assets/` are never executable in the synchronization payload. Ignore
`agents/` as local UI metadata and do not upload it. Other entries are not part
of the shared bundle. Encode each included file as canonical base64 and send it
with its POSIX relative path and executable flag.

Also include root regular non-link files named exactly `LICENSE`, `LICENSE.txt`,
`LICENSE.md`, `NOTICE`, `NOTICE.txt`, or `NOTICE.md`, always non-executable and
within the same limits. These three directories plus six root names are the
SkillsPlane sharing scope, not the entire Agent Skills format. Other directories
are allowed by that format but are not synchronized here. If a required Skill
dependency is outside this scope, stop and ask the author to relocate it; do not
silently claim that the Skill is self-contained.

For both source and remote manifest validation, require well-formed Unicode,
NFC POSIX relative paths, at most 512 UTF-8 bytes per path and 255 per component.
Each file path under a supported directory must include a descendant filename.
Empty real supported directories are valid and contribute no entries to `files`.
Reject absolute paths,
backslashes, empty/dot/parent segments, control characters, Windows forbidden
characters (`< > : " | ? *`), trailing dot/space, and reserved basenames CON,
PRN, AUX, NUL, COM1-COM9, or LPT1-LPT9 (including extensions, case variants,
and superscript 1/2/3 variants). Reject duplicate paths, case-insensitive path
aliases (including directory spelling), and file/directory ancestor conflicts.
Compare every path prefix using Unicode default full case folding followed by
NFC normalization, not ordinary lowercase conversion (for example, Σ/ς and ß/ss).
Validate the complete manifest's declared total with the entrypoint within 1 MiB.

For both synchronization workflows, read source files through safe handles:
verify non-link ancestors and open without following symlinks or reparse points,
then verify the opened handle is a regular file with allowed size and mode.
Use host file primitives that prevent redirection for every path component;
if unavailable, stop instead of falling back to an unchecked path read.
Read bounded bytes from that same verified handle, not by reopening its path.
Immediately before each `sync_skill`, after Workspace resolution, repeat source
validation while opening every entrypoint and companion used in its payload.
Recheck the complete file set and total size; on a changed path, type, mode, or
content, discard the payload and restart source validation and synchronization.
Never upload bytes read through an unchecked replacement path.

## Synchronize selected bundles

Both synchronization workflows below use this procedure after validating local
sources and the tracked binding and selecting their targets. Any failure stops
the calling workflow, including the intended push when synchronizing before push.

1. Resolve the binding's exact `workspaceId` through `list_workspaces` using the
   pagination rule above, even when the selected Skill set is empty. If the current
   Plugin OAuth connection cannot access it, stop and explain that it may use a
   different account from the Web session. Otherwise report the resolved
   Workspace name and ID and the binding path as the synchronization destination.
2. After Workspace resolution, re-enumerate and validate every immediate local
   Skill and its complete bundle, including unselected Skills and an empty set.
   If the Skill set or any validated source changed, discard the payload and
   restart the calling workflow from its initial validation and target selection.
   An invalid entry stops the workflow; never add new Skills to the selected targets.
   Read the complete current working-tree content of each selected `SKILL.md` and
   every supported companion. Apply the safe-handle reading rule above after
   Workspace resolution and immediately before `sync_skill`.
   Then call `sync_skill` once per selected Skill with the exact `workspaceId`,
   directory `slug`, complete file `content`, and complete companion `files` array.
   Send `files: []` for entrypoint-only Skills. Never infer a Workspace, send
   an unselected Skill, or bypass host approval.
   Do not skip a call because a file appears unchanged or was synchronized before.
3. Require a complete, schema-valid successful response for every call, with the
   same `workspaceId` and `slug`, a status of `created`, `updated`, or
   `unchanged`, and a `fileCount` matching the sent companions. A denied,
   cancelled, failed, malformed, mismatched, or missing result stops the calling
   workflow. Internal checks belong to the Server; do not require public hashes
   or use prior results to skip synchronization.

A successful call replaces the Workspace's current value. It does not prove the
same content was committed or pushed. The complete files array replaces the
previous set: absent companions are deleted and `files: []` explicitly removes
all companions. Never omit `files`; the Server rejects omission for an existing
multi-file Skill. There is no remote history or undo.

## Explicit synchronization

When the user explicitly asks to synchronize one or more local Skills:

1. Require a valid, tracked repository binding and use its exact `workspaceId`.
2. Enumerate and validate every immediate local Skill entry and every required
   `SKILL.md` and all supported companions before selecting a synchronization target.
   Any invalid entry stops explicit synchronization even when the user did not
   select it. Then resolve each requested Skill only from the validated immediate
   local source set. If the user did not name a Skill and more than one is present,
   ask which ones to synchronize. Synchronize all only when the user explicitly
   requests all. Complete this validation before calling `list_workspaces` or `sync_skill`.
3. Follow [Synchronize selected bundles](#synchronize-selected-bundles), then report
   each validated status and file count. Do not run `git push` merely because
   explicit synchronization succeeded.

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
	 Skill directory, required `SKILL.md`, and every included `scripts/`,
	 `references/`, and `assets/` entry. Any invalid immediate entry, required file,
	 or supported companion blocks the intended agent-initiated push.
2. If `.skillsplane.json` exists, require it to be a regular, non-symlink,
   non-reparse repository-root file containing only a valid `workspaceId`, and
   require Git to track it, even when the local Skill set is empty. An invalid or
   untracked binding blocks the push.
3. If one or more local Skills exist, require the valid tracked binding. A
   missing binding blocks the push. If the local Skill set is empty and no
   binding exists, continue without calling the Remote MCP.
4. Select every local Skill and follow
   [Synchronize selected bundles](#synchronize-selected-bundles). Run it even when
   the Skill set is empty if a binding exists. Any failure blocks the push.
5. Immediately before invoking the intended push command or tool, repeat the
	 ancestor, local Skill set, required entry, full bundle path/type/executable
	 inventory, complete `SKILL.md` and companion bytes, binding content, and
	 binding tracked-state validation. If any validated source or binding value
	 changed, restart at the beginning of this workflow: resolve every target
	 repository again, follow each repository's instructions again, rerun every
	 non-pushing required check, then validate and synchronize every local Skill
	 again.
6. After this invocation-final validation succeeds, invoke the repository- or
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
