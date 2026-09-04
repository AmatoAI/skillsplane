import assert from "node:assert/strict";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { test } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const pluginRoot = new URL("../plugins/agent-plugins/skillsplane/", import.meta.url);
const pluginJson = readJson(new URL("plugin.json", pluginRoot));
const mcpJson = readJson(new URL("mcp.json", pluginRoot));
const skill = readFileSync(
  new URL("skills/use-workspace-skills/SKILL.md", pluginRoot),
  "utf8",
);
const marketplaceJson = readJson(
  new URL("../.agents/plugins/marketplace.json", import.meta.url),
);

test("repository exposes one portable Plugin product", () => {
  assert.equal(packageJson.name, "@skillsplane/plugin-development");
  assert.equal(packageJson.version, "0.1.0");
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.engines.node, ">=22.12.0");
  assert.equal("bin" in packageJson, false);
  assert.equal("exports" in packageJson, false);
  assert.equal("files" in packageJson, false);
  assert.equal("publishConfig" in packageJson, false);
  assert.equal("dependencies" in packageJson, false);
  assert.equal("build" in packageJson.scripts, false);
  assert.equal("prepack" in packageJson.scripts, false);
  assert.equal("validate:plugin:development" in packageJson.scripts, false);
  assert.equal("validate:plugin:release" in packageJson.scripts, false);
  assert.equal("validate:artifacts:development" in packageJson.scripts, false);
  assert.equal(
    packageJson.scripts["validate:plugin"],
    "node scripts/validate-plugin-artifact.mjs --root plugins/agent-plugins/skillsplane --source-mode",
  );

  assertPathCompletelyAbsent(new URL("../plugins/skillsplane", import.meta.url));
  assertPathCompletelyAbsent(new URL("../scripts/validate-plugin.mjs", import.meta.url));
  assertPathCompletelyAbsent(new URL("../scripts/install.sh", import.meta.url));
  assertPathCompletelyAbsent(new URL("../scripts/publish-release.sh", import.meta.url));
  assertPathCompletelyAbsent(new URL("../test/plugin-hooks.test.ts", import.meta.url));
  const sourceRoot = new URL("../src", import.meta.url);
  assert.deepEqual(readDirectoryEntriesOrEmpty(sourceRoot), []);
  assertPathCompletelyAbsent(new URL("../dist", import.meta.url));
});

test("portable package has the exact Agent Plugins v1 surface", () => {
  assert.deepEqual(readdirSync(pluginRoot).sort(), [
    "LICENSE",
    "mcp.json",
    "plugin.json",
    "skills",
  ]);
  assert.deepEqual(readdirSync(new URL("skills/", pluginRoot)), ["use-workspace-skills"]);
  assert.deepEqual(readdirSync(new URL("skills/use-workspace-skills/", pluginRoot)), [
    "SKILL.md",
  ]);
  assert.deepEqual(pluginJson, {
    $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
    name: "skillsplane",
    version: "0.1.0",
    description:
      "Find, apply, and sync Workspace skills through the SkillsPlane Remote MCP.",
    author: {
      name: "AmatoAI",
      url: "https://skillsplane.com/",
    },
    homepage: "https://skillsplane.com/",
    repository: "https://github.com/AmatoAI/skillsplane",
    license: "Apache-2.0",
    keywords: ["agent-plugins", "governance", "mcp", "skills", "workspace"],
  });
  assert.deepEqual(mcpJson, {
    $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
    mcpServers: {
      skillsplane: {
        type: "streamable-http",
        url: "https://skillsplane.com/api/mcp",
      },
    },
  });
  assert.equal(
    readFileSync(new URL("LICENSE", pluginRoot), "utf8"),
    readFileSync(new URL("../LICENSE", import.meta.url), "utf8"),
  );
});

test("Skill synchronizes every local Skill before an agent-initiated push", () => {
  assert.match(
    skill,
    /^description: .*before the agent invokes any command or tool that can cause a Git push\./m,
  );
  assert.match(
    skill,
    /^description: .*Skip acknowledgements, typo-only edits, and simple factual questions only when the agent will not initiate a push\.$/m,
  );

  const pushSection = markdownSection(
    skill,
    "Synchronize before any agent-initiated push",
  );
  for (const pattern of [
    /known to have a Git push side effect,\s+resolve\s+every repository the intended operation will push/,
    /In each resolved repository,\s+follow its instructions and run its required checks/,
    /inspect the command or tool first/,
    /Only run checks known not to push in this position/,
    /In every resolved target repository/,
    /every immediate local\s+Skill source/,
    /invalid immediate entry or required file\s+blocks/,
    /even when the local Skill set is empty/,
    /After validation,[\s\S]*resolve its exact\s+`workspaceId` through `list_workspaces`[\s\S]*even\s+when the local Skill set is empty/,
    /missing binding blocks the push/,
    /Read the complete current content of every validated `SKILL\.md` and call\s+`sync_skill` once for every local Skill/,
    /Do not skip a call/,
    /schema-valid successful response for every call/,
    /missing result blocks the push/,
    /`contentHash` matching `\^sha256:\[a-f0-9\]\{64\}\$`/,
    /not a signature or proof of transport\s+integrity/,
    /Immediately before invoking the intended push command or tool/,
    /binding\s+tracked-state validation/,
    /restart at the beginning of this workflow: resolve every target repository\s+again, follow each repository's instructions again, rerun every non-pushing\s+required check, then validate and synchronize every local Skill again/,
    /repository- or\s+user-selected push command or tool through its normal route/,
    /Preserve its normal Git\s+configuration and hooks/,
    /Do not inspect, constrain, or override its\s+transport/,
    /complete this workflow\s+before invoking that tool/,
    /instead of replacing its push implementation/,
    /For an ordinary `git push`/,
    /invocation-final validation is immediately\s+before the push command invocation/,
    /compound tool may mutate sources after it\s+is invoked and before its internal Git push/,
    /does not inspect or\s+intercept mutations inside the tool/,
    /does not guarantee that sources remain\s+unchanged between the tool invocation and its internal Git push/,
    /Do not claim\s+an actual-Git-push-immediate guarantee for that compound route/,
    /Do not store an accepted hash/,
    /Do not use a hash, Git diff, outgoing-ref analysis/,
    /does not prove the same\s+content was committed or pushed/,
    /cooperative agent workflow/,
    /not a lifecycle Hook, Git security\s+boundary, transport policy, or push interception/,
    /cannot intercept\s+pushes independently initiated by a user, IDE, external terminal, or another\s+process/,
  ]) {
    assert.match(pushSection, pattern);
  }
  assertMatchesInOrder(pushSection, [
    /Before invoking a command or tool known to have a Git push side effect/,
    /resolve\s+every repository the intended operation will push/,
    /In each resolved repository/,
    /In every resolved target repository/,
    /If `\.skillsplane\.json` exists/,
    /If one or more local Skills exist/,
    /Read the complete current content of every validated `SKILL\.md`/,
    /Require a complete, schema-valid successful response for every call/,
    /Immediately before invoking the intended push command or tool/,
    /After this invocation-final validation succeeds/,
    /For an ordinary `git push`/,
  ]);
  assert.doesNotMatch(
    skill,
    /git\s+-c\s+push\.recurseSubmodules=no[\s\S]{0,300}?push\s+--no-verify/,
  );
  assert.doesNotMatch(
    skill,
    /client adapter|\.codex-plugin|\.app\.json|PreToolUse|PostToolUse|PLUGIN_DATA/,
  );
});

test("Skill preserves lookup, binding, source, and explicit sync contracts", () => {
  const findSection = markdownSection(skill, "Find and apply a Workspace skill");
  const findSteps = orderedSteps(findSection);
  const connectSection = markdownSection(skill, "Connect a repository");
  const connectSteps = orderedSteps(connectSection);
  const sourceSection = markdownSection(skill, "Validate local Skill sources");
  const explicitSection = markdownSection(skill, "Explicit synchronization");
  const explicitSteps = orderedSteps(explicitSection);

  assert.deepEqual(
    findSteps.map(({ number }) => number),
    [1, 2, 3, 4, 5, 6],
  );
  assert.match(
    findSteps[0]?.text ?? "",
    /one short, distinctive term or contiguous phrase/,
  );
  assert.match(findSteps[0]?.text ?? "", /case-insensitive literal substring matching/);
  assert.match(findSteps[0]?.text ?? "", /only that exact slug or name as the query/);
  assert.match(
    findSteps[1]?.text ?? "",
    /absent,[\s\S]*`search` without a filter[\s\S]*present,[\s\S]*regular, non-symlink,[\s\S]*non-reparse repository-root file[\s\S]*Git tracks it[\s\S]*`search` with that\s+Workspace filter/,
  );
  assert.match(
    findSteps[2]?.text ?? "",
    /`WORKSPACE_FILTER_REQUIRED`[\s\S]*`list_workspaces`[\s\S]*ask the user to choose[\s\S]*retry once/,
  );
  assert.match(findSteps[3]?.text ?? "", /`fetch` with its exact `id`/);
  assert.match(findSteps[4]?.text ?? "", /returned `text`[\s\S]*current task only/);
  assert.match(
    findSteps[5]?.text ?? "",
    /retry once with a shorter core term from the task/,
  );
  assert.match(findSteps[5]?.text ?? "", /continue normally without mentioning/);
  assert.match(findSection, /not materialized or cached/);

  assert.deepEqual(
    connectSteps.map(({ number }) => number),
    [1, 2, 3, 4, 5],
  );
  assert.match(
    connectSteps[0]?.text ?? "",
    /`list_workspaces`[\s\S]*`limit: 100`[\s\S]*`nextCursor`[\s\S]*user-selected `workspaceId`/,
  );
  assert.match(
    connectSteps[1]?.text ?? "",
    /exact `workspaceId`[\s\S]*Plugin OAuth connection[\s\S]*If it is absent,[\s\S]*Web and Plugin connections may[\s\S]*different accounts[\s\S]*ask the user to[\s\S]*Never infer[\s\S]*If no Workspace is available,[\s\S]*Web UI[\s\S]*Plugin connection/,
  );
  assert.match(
    connectSteps[2]?.text ?? "",
    /report the resolved current Workspace name and ID[\s\S]*`.skillsplane\.json` path[\s\S]*Web UI does not control/,
  );
  assert.match(
    connectSteps[3]?.text ?? "",
    /regular, non-symlink, non-reparse repository-root file[\s\S]*no credentials/,
  );
  assert.match(connectSteps[4]?.text ?? "", /git ls-files --error-unmatch/);
  assert.match(connectSection, /only a locator[\s\S]*membership on every call/);
  assert.match(connectSection, /`ACCOUNT_LINK_REQUIRED`[\s\S]*account-link URL/);

  assert.match(
    sourceSection,
    /both `.agents` and `.agents\/skills` must be real directories/,
  );
  assert.match(
    sourceSection,
    /Each immediate entry under `.agents\/skills` must be a real, non-symlink,\s+non-reparse directory/,
  );
  assert.match(
    sourceSection,
    /Reject an immediate regular file,[\s\S]*dangling link,[\s\S]*missing or\s+invalid `SKILL\.md`/,
  );
  assert.match(sourceSection, /reject a zero-byte `SKILL\.md`/);
  assert.match(sourceSection, /Do not traverse, inspect, read, validate, or upload/);
  assert.match(sourceSection, /only the complete `SKILL\.md` content/);
  assert.match(
    sourceSection,
    /Remote Skill text may reference repository-local companions,[\s\S]*does not distribute them/,
  );

  assert.deepEqual(
    explicitSteps.map(({ number }) => number),
    [1, 2, 3, 4, 5],
  );
  assert.match(
    explicitSteps[2]?.text ?? "",
    /Before the first `sync_skill` call[\s\S]*`list_workspaces`[\s\S]*different account from the Web session[\s\S]*Workspace name and ID[\s\S]*binding path/,
  );
  assert.match(
    explicitSteps[1]?.text ?? "",
    /validate every immediate local Skill entry[\s\S]*before selecting[\s\S]*even when the user did not select it[\s\S]*before calling `list_workspaces` or `sync_skill`/,
  );
  assert.match(explicitSteps[3]?.text ?? "", /content of each selected `SKILL\.md`/);
  assert.match(
    explicitSteps[4]?.text ?? "",
    /schema-valid successful response for every call[\s\S]*same `workspaceId` and `slug`[\s\S]*status of `created`, `updated`, or[\s\S]*`unchanged`[\s\S]*contentHash[\s\S]*mismatched,[\s\S]*missing result stops explicit/,
  );
  assert.match(
    explicitSteps[4]?.text ?? "",
    /`contentHash` matching `\^sha256:\[a-f0-9\]\{64\}\$`/,
  );
  assert.match(skill, /If the local Skill set is\s+empty and no\s+binding exists/);
  assert.match(
    skill,
    /If `\.skillsplane\.json` exists[\s\S]*even when the local Skill set is empty[\s\S]*resolve its exact[\s\S]*`workspaceId` through `list_workspaces`[\s\S]*Plugin OAuth connection[\s\S]*Workspace name[\s\S]*binding path as the synchronization destination/,
  );
  assert.match(skill, /call\s+`sync_skill` once for every local Skill/);
  assert.match(skill, /a status of `created`, `updated`, or\s+`unchanged`/);
  assert.match(
    skill,
    /Do not run[\s\S]*`git push` merely[\s\S]*explicit synchronization succeeded/,
  );
});

test("development marketplace points directly to the portable package", () => {
  assert.equal(marketplaceJson.name, "skillsplane-development");
  assert.equal(marketplaceJson.interface.displayName, "SkillsPlane Development");
  const entry = marketplaceJson.plugins.find(
    (candidate: { name?: string }) => candidate.name === "skillsplane",
  );
  assert.deepEqual(entry?.source, {
    source: "local",
    path: "./plugins/agent-plugins/skillsplane",
  });
  assert.deepEqual(entry?.policy, {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  });
});

// biome-ignore lint/suspicious/noExplicitAny: plugin fixture JSON is intentionally dynamic.
function readJson(path: URL): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertPathCompletelyAbsent(path: URL): void {
  try {
    lstatSync(path);
    assert.fail(`expected ${path.pathname} to be absent, including dangling links`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function readDirectoryEntriesOrEmpty(path: URL): string[] {
  try {
    const stat = lstatSync(path);
    assert.equal(stat.isSymbolicLink(), false, `${path.pathname} must not be a link`);
    assert.equal(stat.isDirectory(), true, `${path.pathname} must be a directory`);
    return readdirSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function markdownSection(markdown: string, heading: string) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const contentStart = start + marker.length;
  const following = markdown.slice(contentStart);
  const end = following.search(/^## /m);
  return end < 0 ? following : following.slice(0, end);
}

function orderedSteps(section: string) {
  const steps: Array<{ number: number; text: string }> = [];
  let current: { number: number; text: string } | undefined;
  for (const line of section.split(/\r?\n/)) {
    const marker = /^(\d+)\. (.+)$/.exec(line);
    if (marker !== null) {
      if (current !== undefined) steps.push(current);
      current = { number: Number(marker[1]), text: marker[2] ?? "" };
    } else if (current !== undefined && /^(?: {3,}|\t)/.test(line)) {
      current.text += ` ${line.trim()}`;
    } else if (current !== undefined && line !== "") {
      steps.push(current);
      current = undefined;
      break;
    }
  }
  if (current !== undefined) steps.push(current);
  return steps;
}

function assertMatchesInOrder(value: string, patterns: RegExp[]) {
  let offset = 0;
  for (const pattern of patterns) {
    const match = pattern.exec(value.slice(offset));
    assert.notEqual(match, null, `missing ordered contract pattern ${pattern}`);
    offset += (match?.index ?? 0) + (match?.[0].length ?? 0);
  }
}
