#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = resolve(repoRoot, "plugins", "agent-plugins", "skillsplane");
const skillRelativePath = "skills/use-workspace-skills/SKILL.md";
const setupSkillRelativePath = "skills/setup/SKILL.md";
const syncSkillRelativePath = "skills/sync-workspace-skills/SKILL.md";
const contentDigestDomain = "skillsplane-portable-package-content-v1";
const contentDigestPaths = [
  "LICENSE",
  "mcp.json",
  "plugin.json",
  setupSkillRelativePath,
  syncSkillRelativePath,
  skillRelativePath,
];
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
  assertExactEntries(
    skillsRoot,
    ["setup", "sync-workspace-skills", "use-workspace-skills"],
    "portable skills directory",
  );
  const setupRoot = resolve(skillsRoot, "setup");
  ensureDirectory(setupRoot, "portable setup Skill directory");
  assertExactEntries(setupRoot, ["SKILL.md"], "portable setup Skill directory");
  const syncRoot = resolve(skillsRoot, "sync-workspace-skills");
  ensureDirectory(syncRoot, "portable sync Skill directory");
  assertExactEntries(syncRoot, ["SKILL.md"], "portable sync Skill directory");
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
  const canonicalSyncSkill = resolve(
    dirname(dirname(options.canonicalSkill)),
    "sync-workspace-skills",
    "SKILL.md",
  );
  ensureRegularFile(canonicalSyncSkill, "canonical sync Skill");
  validateSkillBytes(contentBytes[syncSkillRelativePath], {
    ...options,
    canonicalSkill: canonicalSyncSkill,
  });
  validateSkillContract(
    contentBytes[syncSkillRelativePath].toString("utf8"),
    "sync-workspace-skills",
  );

  const canonicalSetupSkill = resolve(
    dirname(dirname(options.canonicalSkill)),
    "setup",
    "SKILL.md",
  );
  ensureRegularFile(canonicalSetupSkill, "canonical setup Skill");
  validateSkillBytes(contentBytes[setupSkillRelativePath], {
    ...options,
    canonicalSkill: canonicalSetupSkill,
  });
  validateSkillContract(contentBytes[setupSkillRelativePath].toString("utf8"), "setup");

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
    expected = expected.split(options.canonicalEndpoint).join(options.expectedEndpoint);
  }
  assertBytes(actualBytes, Buffer.from(expected, "utf8"), "Skill");
}

function validateSkillContract(skill, expectedName = "use-workspace-skills") {
  const frontmatter = parseSkillFrontmatter(skill);
  if (frontmatter.name !== expectedName) {
    throw new Error(`Portable Skill frontmatter name must be exactly "${expectedName}".`);
  }
  if (/\bbundleHash\b/u.test(skill)) {
    throw new Error("Workspace Skill bundle hashes must remain internal to the Server.");
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
  node scripts/validate-plugin-artifact.mjs --root <path> --canonical-skill <path-to-use-workspace-skills/SKILL.md> --canonical-endpoint <url> --expected-endpoint <url> --expected-version <version> [--print-digest]`;
}
