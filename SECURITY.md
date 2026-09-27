# Security

Use GitHub's [private vulnerability report](https://github.com/AmatoAI/skillsplane/security/advisories/new)
when available. If the form is unavailable, open an issue asking for a private
reporting channel, without exploit details or sensitive data.

In a private report, include the Plugin commit/version, client and OS versions,
minimal reproduction steps, and impact. Never post tokens, credentials, customer
data, private repository content, or Workspace Skill content in public reports.

## Data and permissions

The Plugin uses host-managed OAuth with `https://skillsplane.com/api/mcp`.
The server checks Personal ownership or current Team membership on each call.
`.skillsplane.json` stores only a Workspace ID, not a credential.

Sync sends managed User- or repository-local `SKILL.md` content and supported companion files.
Authors must keep secrets out of the complete bundle. See the [sync Skill](plugins/agent-plugins/skillsplane/skills/sync-workspace-skills/SKILL.md)
for the supported paths and limits. Per-file SHA-256 content hashes are public manifest fields used to verify direct
uploads and downloads. The bundle hash remains an internal server check.
Short-lived signed URLs authorize one object operation; never forward OAuth,
cookies or Basic credentials to them, and do not log the URLs.

The Plugin has no separate token store or offline Skill cache. Retrieved files
are temporary task-scoped copies; scripts are not executed automatically. The
host controls its own permissions and conversation retention.

The sync Skill uses the User root for the OAuth account's Personal Skills without
reading or creating a User binding. Repository sync requires a validated,
Git-tracked Team binding. Explicit scope wins; invalid Team bindings stop that
scope without fallback. Local scope does not establish remote authority.
The host must safely read local files and enforce its approval policy. Scripts are never executed merely by retrieval.
A failed call may have written remote state. Multi-Skill sync is not atomic and
has no undo. Personal and each Team have independent namespaces: only the same
destination and slug identify the same remote Skill.

The artifact digest identifies package content; it is not a signature or proof
of publisher identity. See [AGENTS.md](AGENTS.md) for its exact definition.
