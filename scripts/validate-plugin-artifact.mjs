#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = resolve(repoRoot, "plugins", "agent-plugins", "skillsplane");
const skillRelativePath = "skills/use-workspace-skills/SKILL.md";
const contentDigestDomain = "skillsplane-portable-package-content-v1";
const contentDigestPaths = ["LICENSE", "mcp.json", "plugin.json", skillRelativePath];
const productionEndpoint = "https://skillsplane.com/api/mcp";
const pluginSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const mcpSchema = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const sourceVersion = "0.1.0";
const versionPattern = /^0\.1\.0(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

const canonicalManifest = {
  $schema: pluginSchema,
  name: "skillsplane",
  version: sourceVersion,
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
};

const scriptPath = fileURLToPath(import.meta.url);

if (isDirectExecution(process.argv[1])) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const contentDigest = validateArtifact(options);
    process.stdout.write(
      options.printDigest
        ? `${contentDigest}\n`
        : "Portable Agent Plugin artifact validation passed.\n",
    );
  } catch (error) {
    process.stderr.write(
      `Portable Agent Plugin artifact validation failed: ${safeMessage(error)}\n`,
    );
    process.exitCode = 1;
  }
}

function isDirectExecution(argumentPath) {
  if (argumentPath === undefined) return false;
  try {
    return realpathSync(argumentPath) === realpathSync(scriptPath);
  } catch {
    return false;
  }
}

function parseArguments(arguments_) {
  const normalizedArguments = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const values = {};
  let printDigest = false;
  let sourceMode = false;

  for (let index = 0; index < normalizedArguments.length; index += 1) {
    const argument = normalizedArguments[index];
    if (argument === "--help") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }
    if (argument === "--source-mode") {
      if (sourceMode) throw new Error("--source-mode may be specified only once.");
      sourceMode = true;
      continue;
    }
    if (argument === "--print-digest") {
      if (printDigest) throw new Error("--print-digest may be specified only once.");
      printDigest = true;
      continue;
    }

    const key = {
      "--canonical-endpoint": "canonicalEndpoint",
      "--canonical-skill": "canonicalSkill",
      "--expected-endpoint": "expectedEndpoint",
      "--expected-version": "expectedVersion",
      "--root": "root",
    }[argument];
    if (key === undefined) throw new Error(`Unknown option: ${argument ?? ""}`);
    if (values[key] !== undefined) {
      throw new Error(`${argument} may be specified only once.`);
    }
    const value = normalizedArguments[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    values[key] = value;
    index += 1;
  }

  if (values.root === undefined) throw new Error(`--root is required.\n${usage()}`);

  const overrideKeys = [
    "canonicalEndpoint",
    "canonicalSkill",
    "expectedEndpoint",
    "expectedVersion",
  ];
  if (sourceMode && overrideKeys.some((key) => values[key] !== undefined)) {
    throw new Error("Artifact override options cannot be used with --source-mode.");
  }

  const root = resolve(values.root);

  if (!sourceMode) {
    for (const key of overrideKeys) {
      if (values[key] === undefined) {
        throw new Error(`--${toKebabCase(key)} is required without --source-mode.`);
      }
    }
  }

  const canonicalEndpoint = values.canonicalEndpoint ?? productionEndpoint;
  const expectedEndpoint = values.expectedEndpoint ?? productionEndpoint;
  const expectedVersion = values.expectedVersion ?? sourceVersion;
  validateEndpoint(canonicalEndpoint, "canonical endpoint");
  validateEndpoint(expectedEndpoint, "expected endpoint");
  if (!versionPattern.test(expectedVersion)) {
    throw new Error(
      "Expected version must be 0.1.0 with optional SemVer build metadata.",
    );
  }

  return {
    canonicalEndpoint,
    canonicalSkill: resolve(
      values.canonicalSkill ?? resolve(sourceRoot, skillRelativePath),
    ),
    expectedEndpoint,
    expectedVersion,
    printDigest,
    root,
    sourceMode,
  };
}

export function validateArtifact(options, readArtifactFile = readFileSync) {
  ensureDirectory(options.root, "artifact root");
  if (options.sourceMode && options.root !== sourceRoot) {
    throw new Error("--source-mode root must be the canonical portable package root.");
  }
  ensureNoLinksOrSpecialEntries(options.root);
  ensureRegularFile(options.canonicalSkill, "canonical Skill");

  if (options.sourceMode && existsSync(resolve(repoRoot, "plugins", "skillsplane"))) {
    throw new Error("Removed client-specific package root must be absent.");
  }

  assertExactEntries(
    options.root,
    ["LICENSE", "mcp.json", "plugin.json", "skills"],
    "portable root",
  );

  const skillsRoot = resolve(options.root, "skills");
  const skillRoot = resolve(skillsRoot, "use-workspace-skills");
  const skillPath = resolve(options.root, skillRelativePath);
  ensureDirectory(skillsRoot, "portable skills directory");
  assertExactEntries(skillsRoot, ["use-workspace-skills"], "portable skills directory");
  ensureDirectory(skillRoot, "portable Skill directory");
  assertExactEntries(skillRoot, ["SKILL.md"], "portable Skill directory");
  ensureRegularFile(skillPath, "portable Skill");

  const contentBytes = readContentDigestBytes(options.root, readArtifactFile);
  assertBytes(
    contentBytes.LICENSE,
    readFileSync(resolve(repoRoot, "LICENSE")),
    "plugin LICENSE",
  );
  validateManifest(contentBytes["plugin.json"], options.expectedVersion);
  validateMcp(contentBytes["mcp.json"], options.expectedEndpoint);
  validateSkillBytes(contentBytes[skillRelativePath], options);
  validateSkillContract(contentBytes[skillRelativePath].toString("utf8"));

  return computeContentDigest(contentBytes);
}

function validateManifest(bytes, expectedVersion) {
  const actual = parseJsonBytes(bytes, "portable plugin.json");
  const expected = { ...canonicalManifest, version: expectedVersion };
  assertExactKeys(actual, Object.keys(expected), "portable plugin.json");
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error("portable plugin.json must match the canonical manifest.");
  }
  assertCanonicalJsonBytes(bytes, expected, "portable plugin.json");
}

function validateMcp(bytes, expectedEndpoint) {
  const actual = parseJsonBytes(bytes, "portable mcp.json");
  const expected = {
    $schema: mcpSchema,
    mcpServers: {
      skillsplane: {
        type: "streamable-http",
        url: expectedEndpoint,
      },
    },
  };
  assertExactKeys(actual, ["$schema", "mcpServers"], "portable mcp.json");
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error("portable mcp.json must contain only the canonical Remote MCP.");
  }
  assertCanonicalJsonBytes(bytes, expected, "portable mcp.json");
}

function readContentDigestBytes(root, readArtifactFile) {
  const contentBytes = {};
  for (const relativePath of contentDigestPaths) {
    const path = resolve(root, relativePath);
    ensureRegularFile(path, `portable content digest file ${relativePath}`);
    contentBytes[relativePath] = readArtifactFile(path);
  }
  return contentBytes;
}

function computeContentDigest(contentBytes) {
  const manifestLines = [contentDigestDomain];
  for (const relativePath of contentDigestPaths) {
    const bytes = contentBytes[relativePath];
    manifestLines.push(`${relativePath}\t${bytes.byteLength}\tsha256:${hash(bytes)}`);
  }
  const manifest = Buffer.from(`${manifestLines.join("\n")}\n`, "utf8");
  return `sha256:${hash(manifest)}`;
}

function validateSkillBytes(actualBytes, options) {
  let expected = options.sourceMode
    ? actualBytes.toString("utf8")
    : readFileSync(options.canonicalSkill, "utf8");
  if (options.canonicalEndpoint !== options.expectedEndpoint) {
    if (!expected.includes(options.canonicalEndpoint)) {
      throw new Error(`Canonical Skill does not contain ${options.canonicalEndpoint}.`);
    }
    expected = expected.split(options.canonicalEndpoint).join(options.expectedEndpoint);
  }
  assertBytes(actualBytes, Buffer.from(expected, "utf8"), "Skill");
}

function validateSkillContract(skill) {
  const frontmatter = parseSkillFrontmatter(skill);
  const normalizedSkill = skill.replace(/\s+/gu, " ");
  const required = [
    "both `.agents` and `.agents/skills` must be real directories",
    "regular, non-symlink, non-reparse repository-root file",
    "Do not run `git push` merely",
    "Each immediate entry under `.agents/skills` must be a real, non-symlink, non-reparse directory",
    "ignore every other entry inside a valid Skill directory",
    "only the complete `SKILL.md` content is a synchronization payload",
    "Remote Skill text may reference repository-local companions, but the Plugin does not distribute them.",
    "reject a zero-byte `SKILL.md`",
    "`list_workspaces`",
    "`search`",
    "`fetch`",
  ];
  for (const text of required) {
    if (!normalizedSkill.includes(text)) {
      throw new Error(`Portable Skill is missing required contract text: ${text}`);
    }
  }

  if (frontmatter.name !== "use-workspace-skills") {
    throw new Error(
      'Portable Skill frontmatter name must be exactly "use-workspace-skills".',
    );
  }
  const activationPatterns = [
    [
      /Find, apply, and sync current SkillsPlane Workspace skills through the Remote MCP\./u,
      "search and apply Workspace skills",
    ],
    [/when connecting a repository to a Workspace/u, "connect a repository"],
    [
      /when explicitly synchronizing a local Skill/u,
      "explicitly synchronize local Skills",
    ],
    [
      /before the agent invokes any command or tool that can cause a Git push\./u,
      "run before every agent-initiated push route",
    ],
  ];
  for (const [pattern, label] of activationPatterns) {
    requireMatch(
      frontmatter.description,
      pattern,
      `frontmatter description must activate to ${label}`,
    );
  }
  requireMatch(
    frontmatter.description,
    /Skip acknowledgements, typo-only edits, and simple factual questions only when the agent will not initiate a push\.$/u,
    "frontmatter skip conditions must never exempt a task that will initiate a push",
  );

  const findSection = extractSecondLevelSection(
    skill,
    "Find and apply a Workspace skill",
  );
  const findSteps = extractOrderedSteps(findSection);
  if (
    findSteps.length !== 6 ||
    findSteps.some((step, index) => step.number !== index + 1)
  ) {
    throw new Error("Find and apply must contain exactly the ordered steps 1 through 6.");
  }
  const findPatterns = [
    /one short, distinctive term or contiguous phrase[\s\S]*grounded in the user's[\s\S]*request and confirmed context[\s\S]*case-insensitive literal substring matching[\s\S]*not split keywords[\s\S]*only that exact slug or name as the query[\s\S]*Do not send the whole request or join keywords[\s\S]*Do not add an unverified diagnosis/u,
    /\.skillsplane\.json[\s\S]*absent,[\s\S]*`search` without a filter[\s\S]*present,[\s\S]*regular, non-symlink,[\s\S]*non-reparse repository-root file[\s\S]*exact JSON containing only a valid[\s\S]*`workspaceId`[\s\S]*Git tracks it[\s\S]*`search` with that[\s\S]*filter[\s\S]*invalid or untracked[\s\S]*instead of falling back/u,
    /`WORKSPACE_FILTER_REQUIRED`[\s\S]*`list_workspaces`[\s\S]*ask the user to choose[\s\S]*retry once[\s\S]*Do not infer[\s\S]*repeat an unfiltered search/u,
    /first relevant result[\s\S]*`fetch` with its exact `id`[\s\S]*Do not deliberate/u,
    /returned `text`[\s\S]*current task only[\s\S]*without writing the remote text/u,
    /no result is relevant,[\s\S]*retry once with a shorter core term from the task[\s\S]*one concrete alternative term[\s\S]*Do not add words or join alternatives[\s\S]*If none is still relevant,[\s\S]*continue normally without mentioning missing Workspace skills/u,
  ];
  for (const [index, pattern] of findPatterns.entries()) {
    requireMatch(findSteps[index].text, pattern, `find and apply step ${index + 1}`);
  }
  requireMatch(
    findSection,
    /Remote skill text is current server state[\s\S]*not materialized or cached/u,
    "find and apply must not materialize or cache fetched Skill text",
  );

  const connectSection = extractSecondLevelSection(skill, "Connect a repository");
  const connectSteps = extractOrderedSteps(connectSection);
  if (
    connectSteps.length !== 5 ||
    connectSteps.some((step, index) => step.number !== index + 1)
  ) {
    throw new Error("Connect must contain exactly the ordered steps 1 through 5.");
  }
  const connectPatterns = [
    /Call `list_workspaces`[\s\S]*`limit: 100`[\s\S]*`nextCursor`[\s\S]*exact[\s\S]*user-selected `workspaceId`/u,
    /user supplied an exact `workspaceId`[\s\S]*Plugin OAuth connection[\s\S]*If it is absent,[\s\S]*Web and Plugin connections may[\s\S]*different accounts[\s\S]*ask the user to[\s\S]*more than one Workspace[\s\S]*Never infer[\s\S]*If no Workspace is available,[\s\S]*Web UI[\s\S]*Plugin connection/u,
    /report the resolved current Workspace name and ID[\s\S]*repository-root `.skillsplane\.json` path[\s\S]*Web UI does not control[\s\S]*synchronization destination/u,
    /regular, non-symlink, non-reparse repository-root file[\s\S]*no credentials[\s\S]*"workspaceId"/u,
    /Add `.skillsplane\.json` to Git[\s\S]*git ls-files --error-unmatch[\s\S]*untracked/u,
  ];
  for (const [index, pattern] of connectPatterns.entries()) {
    requireMatch(connectSteps[index].text, pattern, `connect step ${index + 1}`);
  }
  requireMatch(
    connectSection,
    /only `workspaceId`[\s\S]*\^ws_\[A-Za-z0-9_-\]\{16,64\}\$[\s\S]*only a locator[\s\S]*membership on every call[\s\S]*`ACCOUNT_LINK_REQUIRED`[\s\S]*account-link URL[\s\S]*Do not attempt email matching or CLI login/u,
    "connect must enforce binding schema, membership authorization, and account-link fallback",
  );

  const validationSection = extractSecondLevelSection(
    skill,
    "Validate local Skill sources",
  );
  requireMatch(
    validationSection,
    /Each immediate entry under `.agents\/skills` must be a real,[\s\S]*non-symlink,[\s\S]*non-reparse directory[\s\S]*regular,[\s\S]*non-symlink,[\s\S]*non-reparse[\s\S]*`SKILL\.md`/u,
    "local sources must require real Skill directories and SKILL.md files",
  );
  requireMatch(
    validationSection,
    /Reject an immediate regular file,[\s\S]*symlink,[\s\S]*reparse point,[\s\S]*dangling link,[\s\S]*missing or[\s\S]*invalid `SKILL\.md`/u,
    "local sources must fail closed for every invalid immediate entry",
  );
  requireMatch(
    validationSection,
    /reject a zero-byte `SKILL\.md`/u,
    "local sources must reject a zero-byte SKILL.md",
  );
  requireMatch(
    validationSection,
    /ignore every other entry inside a[\s\S]*valid Skill directory[\s\S]*Do not traverse, inspect, read, validate, or upload[\s\S]*only the complete `SKILL\.md` content[\s\S]*does not distribute them/u,
    "local companion entries must remain uninspected, local-only, and undistributed",
  );

  const explicitSyncSection = extractSecondLevelSection(
    skill,
    "Explicit synchronization",
  );
  const explicitSyncSteps = extractOrderedSteps(explicitSyncSection);
  if (
    explicitSyncSteps.length !== 5 ||
    explicitSyncSteps.some((step, index) => step.number !== index + 1)
  ) {
    throw new Error(
      "Explicit synchronization must contain exactly the ordered steps 1 through 5.",
    );
  }
  requireMatch(
    explicitSyncSteps[0].text,
    /valid, tracked repository binding[\s\S]*exact `workspaceId`/u,
    "explicit sync step 1 must require the tracked binding",
  );
  requireMatch(
    explicitSyncSteps[1].text,
    /validate every immediate local Skill entry[\s\S]*before selecting[\s\S]*Any invalid entry stops[\s\S]*even when the user did not select it[\s\S]*Complete this validation before calling `list_workspaces` or `sync_skill`/u,
    "explicit sync step 2 must validate every immediate entry before any Remote MCP call",
  );
  requireMatch(
    explicitSyncSteps[2].text,
    /Before the first `sync_skill` call[\s\S]*binding's exact `workspaceId`[\s\S]*`list_workspaces`[\s\S]*Plugin OAuth connection cannot[\s\S]*different account from the Web[\s\S]*Workspace name and ID[\s\S]*binding path[\s\S]*synchronization destination/u,
    "explicit sync step 3 must resolve and report the bound Workspace after local validation",
  );
  requireMatch(
    explicitSyncSteps[3].text,
    /complete current working-tree content of each selected `SKILL\.md`[\s\S]*call `sync_skill` once per selected Skill/u,
    "explicit sync step 4 must read and synchronize only selected SKILL.md payloads",
  );
  requireMatch(
    explicitSyncSteps[4].text,
    /complete, schema-valid successful response for every call[\s\S]*same `workspaceId` and `slug`[\s\S]*created`[\s\S]*updated`[\s\S]*unchanged`[\s\S]*contentHash[\s\S]*sha256:[\s\S]*denied,[\s\S]*cancelled,[\s\S]*failed,[\s\S]*malformed,[\s\S]*mismatched,[\s\S]*missing result stops explicit/u,
    "explicit sync step 5 must validate every sync response before reporting success",
  );
  requireMatch(
    explicitSyncSteps[4].text,
    /`contentHash` matching `\^sha256:\[a-f0-9\]\{64\}\$`/u,
    "explicit sync step 5 must require the exact contentHash schema",
  );

  const pushSection = extractSecondLevelSection(
    skill,
    "Synchronize before any agent-initiated push",
  );
  const pushRequirements = [
    {
      label: "run non-pushing repository checks before synchronization",
      patterns: [
        /^Before invoking a command or tool known to have a Git push side effect,\s+resolve\s+every repository the intended operation will push\. In each resolved repository,\s+follow its instructions and run its required checks\./mu,
        /target set or side\s+effects are uncertain/u,
        /inspect the command or tool first/u,
        /push behavior was not determined/u,
        /Only run checks known not to push in this position/u,
        /push side effect as an intended push/u,
        /only after completing\s+this workflow/u,
      ],
    },
    {
      label: "validate every target repository and local Skill source",
      patterns: [
        /^1\. In every resolved target repository/mu,
        /validate the local source ancestors/u,
        /enumerate every immediate local\s+Skill source/u,
        /slug-ascending order/u,
        /ignoring every companion entry/u,
        /invalid immediate entry or required file\s+blocks the intended\s+agent-initiated push/u,
      ],
    },
    {
      label: "fail closed on invalid or missing repository bindings",
      patterns: [
        /If `\.skillsplane\.json` exists/u,
        /regular, non-symlink,\s+non-reparse repository-root file/u,
        /containing only a valid `workspaceId`/u,
        /require Git to track it/u,
        /even when the local Skill set is empty/u,
        /invalid or\s+untracked binding blocks the push/u,
        /After validation,[\s\S]*resolve its exact\s+`workspaceId` through `list_workspaces`[\s\S]*even\s+when the local Skill set is empty/u,
        /Plugin OAuth connection[\s\S]*cannot access[\s\S]*block the push[\s\S]*different\s+account from the Web session/u,
        /report the resolved Workspace name[\s\S]*and ID and the binding path as the synchronization destination/u,
        /If one or more local Skills exist, require the valid tracked binding/u,
        /missing binding blocks the push/u,
        /local Skill set is\s+empty and no\s+binding exists, continue without calling the Remote MCP/u,
      ],
    },
    {
      label: "synchronize every local Skill without cached omissions",
      patterns: [
        /^4\. Read the complete current content of every validated `SKILL\.md` and call\s+`sync_skill` once for every local Skill/mu,
        /binding's exact\s+`workspaceId`/u,
        /directory `slug`/u,
        /complete `content`/u,
        /Do not skip a call/u,
      ],
    },
    {
      label: "validate every synchronization response and block failures",
      patterns: [
        /complete, schema-valid successful response for every call/u,
        /same `workspaceId` and `slug`/u,
        /status of `created`, `updated`, or\s+`unchanged`/u,
        /`contentHash` matching `\^sha256:\[a-f0-9\]\{64\}\$`/u,
        /A denied,/u,
        /cancelled,/u,
        /failed,/u,
        /malformed,/u,
        /mismatched,/u,
        /missing result blocks the push/u,
        /Do not recompute or compare a local hash/u,
        /server hashes canonical content/u,
        /not a signature or proof of transport\s+integrity/u,
      ],
    },
    {
      label: "revalidate source and binding state before push command or tool invocation",
      patterns: [
        /^6\. Immediately before invoking the intended push command or tool/mu,
        /repeat the\s+ancestor/u,
        /local Skill set/u,
        /complete `SKILL\.md` content/u,
        /binding content/u,
        /binding\s+tracked-state validation/u,
        /Never enumerate or\s+compare companion entries/u,
        /validated source or binding value changed/u,
        /If any validated source or binding value changed,\s+restart at the beginning of this workflow: resolve every target repository\s+again, follow each repository's instructions again, rerun every non-pushing\s+required check, then validate and synchronize every local Skill again/u,
      ],
    },
    {
      label: "delegate push execution to the normal repository route",
      patterns: [
        /After this invocation-final validation succeeds/u,
        /repository- or\s+user-selected push command or tool through its normal route/u,
        /Preserve its normal Git\s+configuration and hooks/u,
        /Do not inspect, constrain, or override its\s+transport/u,
        /transport, remotes, refspecs, credentials, certificate authorities, cookies,\s+signing, push options, executable or helper selection, or hooks/u,
        /complete this workflow\s+before invoking that tool/u,
        /instead of replacing its push implementation/u,
      ],
    },
    {
      label: "limit compound tool guarantees to the invocation boundary",
      patterns: [
        /For an ordinary `git push`/u,
        /invocation-final validation is immediately\s+before the push command invocation/u,
        /compound tool may mutate sources after it\s+is invoked and before its internal Git push/u,
        /does not inspect or\s+intercept mutations inside the tool/u,
        /does not guarantee that sources remain\s+unchanged between the tool invocation and its internal Git push/u,
        /Do not claim\s+an actual-Git-push-immediate guarantee for that compound route/u,
      ],
    },
    {
      label: "avoid local synchronization state and Git proof claims",
      patterns: [
        /Do not store an accepted hash, timestamp, or other local synchronization state/u,
        /Do not use a hash, Git diff, outgoing-ref analysis, or previous response to skip\s+any Skill/u,
        /does not prove the same\s+content was committed or pushed/u,
      ],
    },
    {
      label: "state the cooperative and external-push boundaries",
      patterns: [
        /cooperative agent workflow/u,
        /not a lifecycle Hook, Git security\s+boundary, transport policy, or push interception mechanism/u,
        /only\s+pushes initiated by the agent/u,
        /cannot intercept\s+pushes independently initiated by a user, IDE, external terminal, or another\s+process/u,
        /does not make claims about those pushes/u,
      ],
    },
  ];
  for (const { label, patterns } of pushRequirements) {
    requireEveryMatch(pushSection, patterns, `push workflow must ${label}`);
  }
  for (const [pattern, label] of [
    [
      /resolve\s+every repository the intended operation will push/u,
      "resolve every push target repository exactly once",
    ],
    [
      /In each resolved repository/u,
      "state each target repository's checks exactly once",
    ],
    [
      /call\s+`sync_skill` once for every local Skill/u,
      "state all-local-Skill synchronization exactly once",
    ],
    [
      /resolve every target repository\s+again/u,
      "state restart target resolution exactly once",
    ],
    [/restart at the beginning of this workflow/u, "state workflow restart exactly once"],
    [
      /follow each repository's instructions again/u,
      "state restart repository instructions exactly once",
    ],
    [
      /rerun every non-pushing\s+required check/u,
      "state restart repository checks exactly once",
    ],
    [
      /synchronize every local Skill again/u,
      "state restart synchronization exactly once",
    ],
  ]) {
    requireSingleMatch(pushSection, pattern, `push workflow must ${label}`);
  }
  requireMatchesInOrder(
    pushSection,
    [
      /Before invoking a command or tool known to have a Git push side effect/u,
      /resolve\s+every repository the intended operation will push/u,
      /In each resolved repository/u,
      /In every resolved target repository/u,
      /If `\.skillsplane\.json` exists/u,
      /If one or more local Skills exist/u,
      /Read the complete current content of every validated `SKILL\.md`/u,
      /Require a complete, schema-valid successful response for every call/u,
      /Immediately before invoking the intended push command or tool/u,
      /restart at the beginning of this workflow/u,
      /resolve every target repository\s+again/u,
      /follow each repository's instructions again/u,
      /rerun every non-pushing\s+required check/u,
      /synchronize every local Skill again/u,
      /After this invocation-final validation succeeds/u,
      /For an ordinary `git push`/u,
    ],
    "push workflow must preserve the check, sync, revalidation, and push order",
  );

  for (const forbidden of [
    "client adapter",
    ".codex-plugin",
    ".app.json",
    "PreToolUse",
    "PostToolUse",
    "PLUGIN_DATA",
    "`git --exec-path`",
    "`git-credential-<name>`",
    "canonical Git installation root",
    "canonical PATH-directory identities",
    "fixed Git-installation-owned candidate set",
  ]) {
    if (skill.includes(forbidden)) {
      throw new Error(`Portable Skill must not reference ${forbidden}.`);
    }
  }

  const managedGitPolicyBlocks = extractManagedGitPolicyBlocks(skill);
  const managedGitPolicyDirectives = [
    /git\s+-c\s+push\s*\.\s*recurseSubmodules\s*=\s*no.{0,300}?push\s+--no-verify/iu,
    /(?:require|run|invoke|execute|use)\b.{0,160}?git\s+remote\s+get-url\s+--push/iu,
    /(?:require|run|invoke|execute|use)\b.{0,160}?git\s+check-ref-format/iu,
    /(?:require|set|configure|override|clear|reset)\b.{0,200}?(?:http\s*\.\s*followRedirects|http\s*\.\s*extraHeader|credential\s*\.\s*helper|remote\s*\.\s*<name>)/iu,
  ];
  for (const block of managedGitPolicyBlocks) {
    if (
      containsManagedGitPushDirective(block) ||
      managedGitPolicyDirectives.some((pattern) => pattern.test(block))
    ) {
      throw new Error("Portable Skill must not reintroduce Plugin-managed Git policy.");
    }
  }
}

function containsManagedGitPushDirective(block) {
  for (const segment of block.split(/(?<=[.!?;])\s+/u)) {
    for (const codeSpan of segment.matchAll(/`([^`\n]+)`/gu)) {
      if (!isDirectGitPushCommand(codeSpan[1])) continue;
      const scopes = segment
        .slice(0, codeSpan.index)
        .split(":")
        .map((scope) =>
          scope
            .replace(/^[#>*_`\s-]+/u, "")
            .replace(/^\[[ xX-]\]\s*/u, "")
            .trim(),
        );
      if (
        !scopes.some((scope) =>
          /^(?:do\s+not(?:\s+(?:run|invoke|execute|use|push)\b|\s*$)|never(?:\s+(?:run|invoke|execute|use|push)\b|\s*$)|(?:must|shall|should)\s+not(?:\s+ever)?(?:\s+(?:run|invoke|execute|use|push)\b|\s*$)|(?:not\s+allowed|forbidden|prohibited|disallowed)\s*$|(?:for\s+)?historical(?:\s+(?:context|example))?\b|for\s+an\s+ordinary\s*$)/iu.test(
            scope,
          ),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function isDirectGitPushCommand(codeSpan) {
  const words = [
    ...codeSpan.matchAll(
      /(?:(?:"(?:\\.|[^"\\])*")|(?:'(?:\\.|[^'\\])*')|(?:\\[\s\S]|[^\s"']))+/gu,
    ),
  ].map((match) => match[0]);
  if (words[0] !== "git") return false;

  const valueOptions = new Set([
    "-c",
    "-C",
    "--git-dir",
    "--work-tree",
    "--namespace",
    "--super-prefix",
    "--config-env",
    "--attr-source",
  ]);
  let index = 1;
  while (words[index]?.startsWith("-")) {
    const option = words[index];
    index += 1;
    if (valueOptions.has(option)) index += 1;
  }
  return words[index] === "push";
}

function extractManagedGitPolicyBlocks(markdown) {
  const blocks = [];
  const paragraph = [];
  const listStack = [];
  let listSeparatedByBlank = false;

  const appendBlock = (parts) => {
    const block = parts.join(" ").replace(/\s+/gu, " ").trim();
    if (block.length > 0) blocks.push(block);
  };
  const flushParagraph = () => {
    appendBlock(paragraph);
    paragraph.length = 0;
  };
  const flushListItem = () => {
    const item = listStack.pop();
    appendBlock([...listStack.flatMap((ancestor) => ancestor.parts), ...item.parts]);
  };
  const flushList = () => {
    while (listStack.length > 0) flushListItem();
  };

  for (const line of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushParagraph();
      if (listStack.length > 0) listSeparatedByBlank = true;
      continue;
    }

    if (
      listStack.length === 0 &&
      paragraph.length > 0 &&
      /^ {0,3}(?:=+|-+)[ \t]*$/u.test(line)
    ) {
      flushParagraph();
      appendBlock([trimmed]);
      continue;
    }

    const heading = /^([ \t]*)#{1,6}(?:[ \t]+|$)/u.exec(line);
    if (heading !== null) {
      const headingIndent = markdownIndentWidth(heading[1]);
      while (listStack.at(-1)?.contentIndent > headingIndent) flushListItem();
      if (listStack.length > 0) {
        listStack.at(-1).parts.push(trimmed);
        listSeparatedByBlank = false;
        continue;
      }
      if (headingIndent <= 3) {
        flushParagraph();
        appendBlock([trimmed]);
        listSeparatedByBlank = false;
        continue;
      }
    }

    const listItem = /^([ \t]*)([-+*]|(\d{1,9})[.)])(?:([ \t]+)(.*))?$/u.exec(line);
    const indent = listItem === null ? null : markdownIndentWidth(listItem[1]);
    const markerEndIndent =
      listItem === null ? null : markdownIndentWidth(`${listItem[1]}${listItem[2]}`);
    const rawContentIndent =
      listItem === null || listItem[4] === undefined
        ? null
        : markdownIndentWidth(`${listItem[1]}${listItem[2]}${listItem[4]}`);
    const paddingWidth =
      markerEndIndent === null || rawContentIndent === null
        ? null
        : rawContentIndent - markerEndIndent;
    const hasContent = listItem?.[5]?.trim().length > 0;
    const contentIndent =
      markerEndIndent === null
        ? null
        : !hasContent || paddingWidth === null || paddingWidth > 4
          ? markerEndIndent + 1
          : rawContentIndent;
    const interruptsParagraph =
      listItem !== null &&
      indent <= 3 &&
      paddingWidth >= 1 &&
      hasContent &&
      (listItem[3] === undefined || Number.parseInt(listItem[3], 10) === 1);
    if (
      listItem !== null &&
      (listStack.length > 0 || paragraph.length === 0 || interruptsParagraph)
    ) {
      flushParagraph();
      while (listStack.at(-1)?.contentIndent > indent) flushListItem();
      listStack.push({ contentIndent, parts: [listItem[5] ?? ""] });
      listSeparatedByBlank = !hasContent;
      continue;
    }

    if (listStack.length > 0 && listSeparatedByBlank) {
      const lineIndent = markdownIndentWidth(/^([ \t]*)/u.exec(line)[1]);
      while (listStack.at(-1)?.contentIndent > lineIndent) flushListItem();
    }
    if (listStack.length > 0) listStack.at(-1).parts.push(trimmed);
    else paragraph.push(trimmed);
    listSeparatedByBlank = false;
  }

  flushParagraph();
  flushList();
  return blocks;
}

function markdownIndentWidth(indent) {
  let width = 0;
  for (const character of indent) {
    width += character === "\t" ? 4 - (width % 4) : 1;
  }
  return width;
}

function parseSkillFrontmatter(skill) {
  const lines = skill.replace(/\r\n?/gu, "\n").split("\n");
  if (lines[0] !== "---") {
    throw new Error("Portable Skill frontmatter must start with an exact --- boundary.");
  }
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex < 0) {
    throw new Error(
      "Portable Skill frontmatter must have an exact closing --- boundary.",
    );
  }

  const values = {};
  for (const line of lines.slice(1, closingIndex)) {
    const entry = /^([a-z][a-z0-9-]*): (.+)$/u.exec(line);
    if (entry === null || Object.hasOwn(values, entry[1])) {
      throw new Error(
        "Portable Skill frontmatter must contain unique one-line scalar fields.",
      );
    }
    values[entry[1]] = entry[2];
  }
  assertExactKeys(values, ["description", "name"], "Portable Skill frontmatter");
  return values;
}

function extractSecondLevelSection(markdown, heading) {
  const matches = [
    ...markdown.matchAll(new RegExp(`^## ${escapeRegex(heading)}$`, "gmu")),
  ];
  if (matches.length !== 1) {
    throw new Error(`Portable Skill must contain exactly one "## ${heading}" section.`);
  }
  const start = matches[0].index + matches[0][0].length;
  const following = markdown.slice(start);
  const nextHeading = following.search(/^## /mu);
  return nextHeading < 0 ? following : following.slice(0, nextHeading);
}

function extractOrderedSteps(section) {
  const steps = [];
  let current;

  for (const line of section.split(/\r?\n/u)) {
    const marker = /^(\d+)\. (.+)$/u.exec(line);
    if (marker !== null) {
      if (current !== undefined) steps.push(current);
      current = { number: Number(marker[1]), text: marker[2] };
      continue;
    }
    if (current === undefined) continue;
    if (/^(?: {3,}|\t)/u.test(line)) {
      current.text += ` ${line.trim()}`;
      continue;
    }
    if (line === "") continue;
    steps.push(current);
    current = undefined;
    break;
  }
  if (current !== undefined) steps.push(current);
  return steps;
}

function requireMatch(value, pattern, label) {
  if (!pattern.test(value)) {
    throw new Error(`Portable Skill ${label}.`);
  }
}

function requireEveryMatch(value, patterns, label) {
  for (const pattern of patterns) requireMatch(value, pattern, label);
}

function requireSingleMatch(value, pattern, label) {
  const matches = value.match(new RegExp(pattern.source, `${pattern.flags}g`));
  if (matches?.length !== 1) {
    throw new Error(`Portable Skill ${label}.`);
  }
}

function requireMatchesInOrder(value, patterns, label) {
  let offset = 0;
  for (const pattern of patterns) {
    const match = pattern.exec(value.slice(offset));
    if (match === null) throw new Error(`Portable Skill ${label}.`);
    offset += match.index + match[0].length;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function validateEndpoint(value, label) {
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username !== "" ||
    endpoint.password !== "" ||
    endpoint.search !== "" ||
    endpoint.hash !== "" ||
    endpoint.pathname !== "/api/mcp"
  ) {
    throw new Error(`${label} must be an HTTPS origin followed by /api/mcp.`);
  }
}

function parseJsonBytes(bytes, label) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
  if (!isRecord(value)) throw new Error(`${label} must contain a JSON object.`);
  return value;
}

function ensureDirectory(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} must be a real directory: ${path}`);
  }
}

function ensureRegularFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a regular file: ${path}`);
  }
}

function ensureNoLinksOrSpecialEntries(current) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Artifact must not contain symlink: ${path}`);
    }
    if (entry.isDirectory()) {
      ensureNoLinksOrSpecialEntries(path);
    } else if (!entry.isFile()) {
      throw new Error(`Artifact contains unsupported filesystem entry: ${path}`);
    }
  }
}

function assertExactEntries(path, expected, label) {
  const actual = readdirSync(path).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((entry, index) => entry !== wanted[index])
  ) {
    throw new Error(
      `${label} entries must be exactly ${wanted.join(", ")}; found ${actual.join(", ") || "none"}.`,
    );
  }
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((entry, index) => entry !== wanted[index])
  ) {
    throw new Error(`${label} keys must be exactly ${wanted.join(", ")}.`);
  }
}

function assertCanonicalJsonBytes(bytes, expected, label) {
  const canonical = Buffer.from(`${JSON.stringify(expected, null, 2)}\n`, "utf8");
  assertBytes(bytes, canonical, `${label} canonical JSON`);
}

function assertBytes(actual, expected, label) {
  if (!actual.equals(expected)) {
    throw new Error(
      `${label} bytes differ from canonical (expected sha256 ${hash(expected)}, actual sha256 ${hash(actual)}).`,
    );
  }
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeMessage(error) {
  return error instanceof Error ? error.message : "unknown validation error";
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/gu, (character) => `-${character.toLowerCase()}`);
}

function usage() {
  return `Usage:
  node scripts/validate-plugin-artifact.mjs --root plugins/agent-plugins/skillsplane --source-mode [--print-digest]
  node scripts/validate-plugin-artifact.mjs --root <path> --canonical-skill <path> --canonical-endpoint <url> --expected-endpoint <url> --expected-version <version> [--print-digest]`;
}
