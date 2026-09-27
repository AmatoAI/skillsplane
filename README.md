# SkillsPlane

**“Can my AI do it your way?”**

You finally get your AI to review work the way you like. Then a teammate starts
from scratch, explaining the same things all over again.

SkillsPlane lets you keep useful instructions as **Skills** and share them with
your team, so their AI can use those instructions in their own work.
Start with a method that works for you. Share it when someone else needs it.

[日本語](README.ja.md) · [Getting started](docs/getting-started.md) ·
[SkillsPlane](https://skillsplane.com/)

> **Source preview:** the source is public; catalog installation is not yet available.
> The [guide](docs/getting-started.md) explains the current development-only setup.

## Less explaining. More of what works.

| The familiar frustration | What you can share |
| --- | --- |
| “Every meeting summary needs decisions, owners, and deadlines. Again.” | Your team's meeting-note instructions. |
| “Can you check this the way our best reviewer does?” | A reviewer's written checklist, ready for teammates to use. |
| “I've already explained our writing style in another task.” | Your preferred tone, structure, and examples. |

These are examples of Skills you can create and share, not a bundled template library.
A Skill is a reusable set of written instructions. You choose what to save and who can use it.

## One useful Skill is a good start

1. **Pick something you keep explaining.** A meeting-note format, a review checklist,
   or the steps you always follow before sending a proposal.
2. **Keep the instructions as a Skill.** Use Personal Skills for your own work;
   share team instructions in a Team Workspace.
3. **Ask for work as usual.** A connected teammate's agent can find the shared
   instructions and use them when relevant.

For example, after your team has shared a meeting-note Skill:

```text
Use our team's meeting-note instructions to summarize this meeting.
```

Then, when you refine those instructions:

```text
Add a reminder to separate decisions from open questions, and sync the updated Skill.
```

You improve a method once. Teammates can use the updated instructions in later work.
Shared instructions are a starting point; review the result for the task at hand.

## Share the method, not just the result

A good summary helps one meeting. The instructions behind it can help the next person, too.

When a teammate asks how you got a useful result, send them the instructions and
explain the job they help with. Share through a Team Workspace with the appropriate access;
your private Skills do not become public.

**A short introduction you can copy:**

> We keep explaining the same things to our AI. SkillsPlane lets us share the
> instructions that work, so we can use them in our own tasks. Which routine
> should we start with: meeting notes, reviews, or writing?
>
> Source preview: https://github.com/AmatoAI/skillsplane

## Make the first example yours

Choose one recurring task and one person who does it too. Share the instructions
that could help them the next time they do that work.

See [getting started](docs/getting-started.md) for current availability and setup.
A SkillsPlane account and a compatible agent are required.

<details>
<summary>Package, permissions, and development</summary>

## Package and availability

The portable package targets **Agent Plugins 1.0.0**. Its manifest version is
currently **0.1.0**. The complete distribution unit is:

```text
plugins/agent-plugins/skillsplane/
├── LICENSE
├── plugin.json
├── mcp.json
└── skills/
    ├── setup/SKILL.md
    ├── use-workspace-skills/SKILL.md
    └── sync-workspace-skills/SKILL.md
```

The Remote MCP endpoint is `https://skillsplane.com/api/mcp`. The bundle workflow
requires five tools: `status`, `search`, `fetch`, `fetch_skill_file`, and
`sync_skill`. Bundle support requires the matching hosted-service rollout. The
Codex and Cursor repository catalogs remain empty until the matching five-tool
contract and fresh-client OAuth have passed live verification. A repository catalog is separate from an
official client-owned marketplace listing. See the
[compatible client list](https://agent-plugins.org/compatible-clients).

## Data and permissions

- The Server checks OAuth membership on every call. A repository binding is a locator.
- Synchronization sends validated complete local bundles, updating supplied
  companions and preserving unsent companions. There is no remote history or undo.
- Host approval and safe filesystem reads are code boundaries. Limits are 768 KiB
  for SKILL.md, 64 MiB per companion, 256 companions, 256 MiB per bundle.
  Hosts transfer original bytes directly through short-lived HTTPS URLs and verify SHA-256.
  Sync uses begin → direct PUT → complete; file bytes never pass through MCP.
- Retrieved companions are temporary task-scoped files. No credential store,
  offline cache or retry daemon is added.
- Normal work, push, PR creation and merge never wait for synchronization.
- Local tests are not proof of native client activation or production OAuth success.

See [Security](SECURITY.md) for reporting guidance and trust boundaries.

## Contributing

Bug reports, documentation fixes, and focused improvements are welcome in
[Issues](https://github.com/AmatoAI/skillsplane/issues) and pull requests.
English and Japanese are both welcome. See [CONTRIBUTING.md](CONTRIBUTING.md)
for development and verification, and [SECURITY.md](SECURITY.md) for vulnerability reports.

## Setup after installation

Use one supported installation method to make the Plugin persistently available.
Do not reinstall an available Plugin. Then ask the agent to follow the `setup` Skill
to verify Plugin / OAuth availability, Personal access, and any requested or existing
Repository binding. Initial sync follows
`sync-workspace-skills`: complete local bundles update the same destination and slug.

</details>
