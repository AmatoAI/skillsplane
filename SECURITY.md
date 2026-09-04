# Security

Use GitHub's [private vulnerability report](https://github.com/AmatoAI/skillsplane/security/advisories/new)
when available. If the form is unavailable, open an issue asking for a private
reporting channel, without exploit details or sensitive data.

In a private report, include the Plugin commit/version, client and OS versions,
minimal reproduction steps, and impact. Never post tokens, credentials, customer
data, private repository content, or Workspace Skill content in public reports.

## Data and permissions

The Plugin uses host-managed OAuth with `https://skillsplane.com/api/mcp`.
The server checks the account's current Workspace access on each call.
`.skillsplane.json` stores only a Workspace ID, not a credential.

Sync sends repository-local `SKILL.md` content and supported companion files.
Authors must keep secrets out of the complete bundle. See the bundled Skill for
the supported paths and limits. Content and bundle hashes are internal server
checks, not public synchronization requirements or results.

The Plugin has no separate token store or offline Skill cache. Retrieved files
are temporary task-scoped copies; scripts are not executed automatically. The
host controls its own permissions and conversation retention.

Pre-push synchronization depends on the agent following the bundled Skill.
It does not intercept pushes independently started by a user, IDE, or another
process. A successful sync does not prove that a commit or push occurred.

The artifact digest identifies package content; it is not a signature or proof
of publisher identity. See [AGENTS.md](AGENTS.md) for its exact definition.
