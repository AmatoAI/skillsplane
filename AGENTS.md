# SkillsPlane Agent Plugin

This repository maintains one portable Agent Plugins 1.0.0 package at
`plugins/agent-plugins/skillsplane/`.

## Scope

- The package contains `LICENSE`, `plugin.json`, `mcp.json`, and
  `skills/setup/SKILL.md`, `skills/use-workspace-skills/SKILL.md` and `skills/sync-workspace-skills/SKILL.md`.
- The setup Skill handles post-install connection, binding and initial sync.
- The usage Skill handles discovery and application. The sync Skill handles completed
  managed Skill changes and explicit sync requests in Repository or User scope.
  Safe filesystem primitives and authorization remain host/server responsibilities.
- The repository contains the portable package and its development checks.
- Safe local files, approvals and authenticated MCP calls are provided by the host.
- Remote MCP remains `status`, `search`, `fetch`, `fetch_skill_file`, and
  `sync_skill` at `https://skillsplane.com/api/mcp`, using host-managed OAuth.
- Hosted implementation, credentials, caches, and private planning belong elsewhere.
- Keep public instructions in README.md, README.ja.md, and docs/getting-started.md.
  Keep SECURITY.md and CONTRIBUTING.md short; do not duplicate the bundled Skill.

## Workflow

Check `git status --short --branch` before editing. Preserve unrelated work and
stage only the intended paths. Change source files, not installed/generated copies.

Run `pnpm verify` before finishing. It checks formatting, types, behavioral tests,
and the exact portable artifact. Maintain the existing package path and manifest
format unless a coordinated change explicitly requires otherwise.

Task-start full sync is not the current Skill contract.
Push, PR creation, and merge do not await synchronization.
Keep normal repository Git configuration and hooks. Review PR checks and reviews;
do not describe an unreviewed PR as merge-ready. Create a draft only when requested.

Static checks do not prove client discovery, OAuth, or live tool operation. Record
those results separately before distributing a release, using the official Agent
Plugins / Skill validators and a fresh client installation.
Do not activate the bundle workflow through the public catalogs until the hosted
service exposes the matching five-tool contract and its live checks pass.

## Portable content digest

The contract is `skillsplane-portable-package-content-v1`. Hash the six files in
UTF-8 path byte order: `LICENSE`, `mcp.json`, `plugin.json`, then
`skills/setup/SKILL.md`, then `skills/sync-workspace-skills/SKILL.md`, then `skills/use-workspace-skills/SKILL.md`.
The manifest begins with
`skillsplane-portable-package-content-v1\n`; append
`path<TAB>decimal-byte-length<TAB>sha256:<raw-file-bytes>\n` for each file, and
SHA-256 the manifest bytes to produce `sha256:<64 lowercase hex>`.

Exclude root path, mtime, mode, and archive metadata. Require canonical JSON
bytes (2-space indent, LF, final LF) for plugin.json and mcp.json. Emit
`--print-digest` output only after full validation. This identifies content;
it is not a signature, publisher attestation, or installation result.
