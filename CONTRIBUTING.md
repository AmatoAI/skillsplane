# Contributing

Bug reports, focused improvements, and documentation fixes are welcome.
Use [Issues](https://github.com/AmatoAI/skillsplane/issues) to describe the problem
and expected behavior, or submit a pull request. English and Japanese are welcome.
For vulnerabilities, follow [SECURITY.md](SECURITY.md).

## Development

Clone the repository or your fork. Install the versions pinned in `.mise.toml`:

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm verify
```

You can also install the pinned Node.js and pnpm versions yourself. They are
needed for development checks; the portable Plugin itself has no build step.
On macOS, use `TMPDIR=/private/tmp` if filesystem tests report path-alias differences.

The verification suite covers package layout, metadata, semantic Skill routing,
artifact digest and malformed artifact rejection. The same checks run in GitHub Actions.

## Changes and releases

Keep development tools outside the portable artifact. Read
[AGENTS.md](AGENTS.md) for the package contract. Preserve user-owned files and
host-managed authentication. Change source files and reinstall; do not edit an
installed Plugin cache.

In a pull request, explain the user-visible result and report the checks you ran.
Update tests when behavior changes. Keep the English and Japanese README aligned.

Before a release, verify the exact committed package with the official Agent
Plugins / Skill validators and a fresh client installation, OAuth, and the five
Remote MCP tools. Record the commit, version, digest, and redacted results.
Verify the three Skills separately, including Repository/User scope selection,
completed-change and explicit sync, authenticated transport, approvals and results.
The portable package alone does not install or activate such an integration.
Publish only `plugins/agent-plugins/skillsplane/`, with its license. A local
validation result alone is not proof of production availability.

Contributions use this repository's [Apache 2.0 license](LICENSE).
