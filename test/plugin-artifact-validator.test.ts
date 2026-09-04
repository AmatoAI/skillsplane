import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const validatorPath = fileURLToPath(
  new URL("../scripts/validate-plugin-artifact.mjs", import.meta.url),
);
const portableRoot = fileURLToPath(
  new URL("../plugins/agent-plugins/skillsplane/", import.meta.url),
);
const canonicalSkillPath = join(
  portableRoot,
  "skills",
  "use-workspace-skills",
  "SKILL.md",
);
const contentDigestDomain = "skillsplane-portable-package-content-v1";
const contentDigestPaths = [
  "LICENSE",
  "mcp.json",
  "plugin.json",
  "skills/use-workspace-skills/SKILL.md",
];
const productionEndpoint = "https://skillsplane.com/api/mcp";
const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  );
});

test("validates the canonical portable source package", async () => {
  expectSuccessful(await runValidator(["--root", portableRoot, "--source-mode"]));
});

test.skipIf(process.platform === "win32")(
  "runs validation when the executable path is a symlink",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "skillsplane-validator-entry-"));
    temporaryRoots.push(root);
    const validatorLink = join(root, "validate-plugin-artifact.mjs");
    await symlink(validatorPath, validatorLink, "file");

    const result = await runScript(validatorLink, [
      "--root",
      join(root, "missing-artifact"),
      "--source-mode",
    ]);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/artifact root is missing/);
  },
);

test("prints the v1 content digest only after full validation", async () => {
  const sourceResult = await runValidator([
    "--root",
    portableRoot,
    "--source-mode",
    "--print-digest",
  ]);
  const sourceDigest = expectDigestOnly(sourceResult);
  expect(sourceDigest).toBe(await calculateContentDigest(portableRoot));

  const copiedArtifact = await copyArtifact();
  const oldTime = new Date("2001-01-01T00:00:00.000Z");
  for (const relativePath of contentDigestPaths) {
    await utimes(join(copiedArtifact, relativePath), oldTime, oldTime);
  }
  const copiedDigest = expectDigestOnly(
    await runValidator([...artifactArgs(copiedArtifact), "--print-digest"]),
  );
  expect(copiedDigest).toBe(sourceDigest);
});

test("digests the same artifact byte snapshot that passed validation", async () => {
  const artifact = await copyArtifact();
  const validatorModuleUrl = new URL(
    `../scripts/validate-plugin-artifact.mjs?snapshot=${Date.now()}`,
    import.meta.url,
  ).href;
  const { validateArtifact } = (await import(validatorModuleUrl)) as {
    validateArtifact: (
      options: {
        canonicalEndpoint: string;
        canonicalSkill: string;
        expectedEndpoint: string;
        expectedVersion: string;
        root: string;
        sourceMode: boolean;
      },
      readArtifactFile: (path: string) => Buffer,
    ) => string;
  };
  const readCounts = new Map<string, number>();

  const digest = validateArtifact(
    {
      canonicalEndpoint: productionEndpoint,
      canonicalSkill: canonicalSkillPath,
      expectedEndpoint: productionEndpoint,
      expectedVersion: "0.1.0",
      root: artifact,
      sourceMode: false,
    },
    (path) => {
      const count = (readCounts.get(path) ?? 0) + 1;
      readCounts.set(path, count);
      return count === 1 ? readFileSync(path) : Buffer.from("unvalidated second read");
    },
  );

  expect(digest).toBe(await calculateContentDigest(artifact));
  expect([...readCounts.values()]).toEqual([1, 1, 1, 1]);
});

test("staging endpoint and build metadata projection has a distinct digest", async () => {
  const sourceDigest = expectDigestOnly(
    await runValidator(["--root", portableRoot, "--source-mode", "--print-digest"]),
  );
  const artifact = await copyArtifact();
  const endpoint = "https://staging.skillsplane.com/api/mcp";
  const version = "0.1.0+codex.20260811072401";

  const manifestPath = join(artifact, "plugin.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = version;
  await writeJson(manifestPath, manifest);

  const mcpPath = join(artifact, "mcp.json");
  const mcp = JSON.parse(await readFile(mcpPath, "utf8"));
  mcp.mcpServers.skillsplane.url = endpoint;
  await writeJson(mcpPath, mcp);

  const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, skill.replaceAll(productionEndpoint, endpoint));

  const stagingDigest = expectDigestOnly(
    await runValidator([
      ...artifactArgs(artifact, { endpoint, version }),
      "--print-digest",
    ]),
  );
  expect(stagingDigest).toBe(await calculateContentDigest(artifact));
  expect(stagingDigest).not.toBe(sourceDigest);
});

test.each([
  "plugin.json",
  "mcp.json",
])("rejects noncanonical raw JSON bytes in %s", async (relativePath) => {
  const artifact = await copyArtifact();
  const path = join(artifact, relativePath);
  const value = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify(value));

  const result = await runValidator([...artifactArgs(artifact), "--print-digest"]);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(/canonical JSON bytes differ from canonical/);
});

test.each([
  "plugin.json",
  "mcp.json",
])("rejects reordered canonical JSON keys in %s", async (relativePath) => {
  const artifact = await copyArtifact();
  const path = join(artifact, relativePath);
  const value = JSON.parse(await readFile(path, "utf8"));
  const reordered = Object.fromEntries(Object.entries(value).reverse());
  await writeJson(path, reordered);

  const result = await runValidator([...artifactArgs(artifact), "--print-digest"]);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(/canonical JSON bytes differ from canonical/);
});

test.each([
  [
    "one-byte file change",
    async (artifact: string) => {
      await appendFile(join(artifact, "LICENSE"), "x");
    },
  ],
  [
    "required path change",
    async (artifact: string) => {
      await rename(join(artifact, "mcp.json"), join(artifact, "server.json"));
    },
  ],
  [
    "extra file",
    async (artifact: string) => {
      await writeFile(join(artifact, "extra.txt"), "unexpected\n");
    },
  ],
  [
    "missing file",
    async (artifact: string) => {
      await rm(join(artifact, "plugin.json"));
    },
  ],
])("does not print a digest after %s", async (_name, mutate) => {
  const artifact = await copyArtifact();
  await mutate(artifact);
  const result = await runValidator([...artifactArgs(artifact), "--print-digest"]);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
});

test("discovers a copied portable artifact only at fixed package-relative locations", async () => {
  const artifact = await copyArtifact();
  const fixedDiscoveryFiles = [
    "plugin.json",
    "mcp.json",
    "skills/use-workspace-skills/SKILL.md",
  ];

  // This is a pure static package-root probe, not evidence of a real client install.
  for (const relativePath of fixedDiscoveryFiles) {
    expect(await readFile(join(artifact, relativePath), "utf8")).toBe(
      await readFile(join(portableRoot, relativePath), "utf8"),
    );
  }
  expectSuccessful(await runValidator(artifactArgs(artifact)));
});

test("accepts one leading package-runner separator", async () => {
  expectSuccessful(await runValidator(["--", "--root", portableRoot, "--source-mode"]));
});

test.each([
  ["a repeated leading separator", ["--", "--", "--root", portableRoot]],
  ["a separator after an option", ["--root", portableRoot, "--"]],
])("rejects %s", async (_name, arguments_) => {
  const result = await runValidator(arguments_);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/Unknown option: --/);
});

test("source mode is fixed to the canonical package and rejects overrides", async () => {
  const artifact = await copyArtifact();
  const wrongRoot = await runValidator(["--root", artifact, "--source-mode"]);
  expect(wrongRoot.code).toBe(1);
  expect(wrongRoot.stderr).toMatch(/canonical portable package root/);

  const override = await runValidator([
    "--root",
    portableRoot,
    "--source-mode",
    "--expected-endpoint",
    productionEndpoint,
  ]);
  expect(override.code).toBe(1);
  expect(override.stderr).toMatch(/override options cannot be used/);
});

test.each([
  "--mode",
  "--allow-app-template",
  "--expected-app-id",
])("rejects removed client-specific option %s", async (option) => {
  const result = await runValidator([
    "--root",
    portableRoot,
    "--source-mode",
    option,
    "adapter",
  ]);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/Unknown option/);
});

test("requires a complete explicit artifact comparison", async () => {
  const artifact = await copyArtifact();
  const result = await runValidator(["--root", artifact]);
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/--canonical-endpoint is required/);
});

test.each([
  ["extra.txt", "portable root entries must be exactly"],
  ["hooks/hooks.json", "portable root entries must be exactly"],
  [".codex-plugin/plugin.json", "portable root entries must be exactly"],
  ["skills/stale.txt", "portable skills directory entries must be exactly"],
  [
    "skills/use-workspace-skills/agents/openai.yaml",
    "portable Skill directory entries must be exactly",
  ],
])("rejects extra portable tree entry %s", async (relativePath, message) => {
  const artifact = await copyArtifact();
  const path = join(artifact, relativePath);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, "unexpected\n");

  const result = await runValidator(artifactArgs(artifact));
  expect(result.code).toBe(1);
  expect(result.stderr).toContain(message);
});

test.each([
  "plugin.json",
  "mcp.json",
  "skills/use-workspace-skills/SKILL.md",
])("rejects missing required artifact file %s", async (relativePath) => {
  const artifact = await copyArtifact();
  await rm(join(artifact, relativePath));

  const result = await runValidator(artifactArgs(artifact));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/entries must be exactly/);
});

test("rejects a changed standalone LICENSE", async () => {
  const artifact = await copyArtifact();
  await appendFile(join(artifact, "LICENSE"), "changed\n");

  const result = await runValidator(artifactArgs(artifact));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/plugin LICENSE bytes differ from canonical/);
});

test.skipIf(process.platform === "win32")(
  "rejects symlinks anywhere in an artifact",
  async () => {
    const artifact = await copyArtifact();
    const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
    await rm(skillPath);
    await symlink(canonicalSkillPath, skillPath);

    const result = await runValidator(artifactArgs(artifact));
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/must not contain symlink/);
  },
);

test.each([
  ["description", "different"],
  ["license", "MIT"],
  ["repository", "https://example.com/repository"],
])("rejects changed manifest field %s", async (field, value) => {
  const artifact = await copyArtifact();
  const path = join(artifact, "plugin.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  manifest[field] = value;
  await writeJson(path, manifest);

  const result = await runValidator(artifactArgs(artifact));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/must match the canonical manifest/);
});

test("rejects extra or missing manifest fields", async () => {
  const extraArtifact = await copyArtifact();
  const extraPath = join(extraArtifact, "plugin.json");
  const extraManifest = JSON.parse(await readFile(extraPath, "utf8"));
  extraManifest.hooks = "./hooks/hooks.json";
  await writeJson(extraPath, extraManifest);
  const extra = await runValidator(artifactArgs(extraArtifact));
  expect(extra.code).toBe(1);
  expect(extra.stderr).toMatch(/plugin\.json keys must be exactly/);

  const missingArtifact = await copyArtifact();
  const missingPath = join(missingArtifact, "plugin.json");
  const missingManifest = JSON.parse(await readFile(missingPath, "utf8"));
  delete missingManifest.author;
  await writeJson(missingPath, missingManifest);
  const missing = await runValidator(artifactArgs(missingArtifact));
  expect(missing.code).toBe(1);
  expect(missing.stderr).toMatch(/plugin\.json keys must be exactly/);
});

test.each([
  "0.1.1",
  "not-a-version",
  "0.1.0-alpha",
  "0.1.0+bad metadata",
])("rejects unsupported artifact version %s", async (version) => {
  const artifact = await copyArtifact();
  const result = await runValidator(artifactArgs(artifact, { version }));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/optional SemVer build metadata/);
});

test("rejects noncanonical MCP shape", async () => {
  const artifact = await copyArtifact();
  const path = join(artifact, "mcp.json");
  const mcp = JSON.parse(await readFile(path, "utf8"));
  mcp.mcpServers.skillsplane.headers = { Authorization: "Bearer local-token" };
  await writeJson(path, mcp);

  const result = await runValidator(artifactArgs(artifact));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/only the canonical Remote MCP/);
});

test.each([
  "http://skillsplane.com/api/mcp",
  "https://skillsplane.com/api/mcp?debug=1",
  "https://skillsplane.com/not-mcp",
])("rejects invalid expected endpoint %s", async (endpoint) => {
  const artifact = await copyArtifact();
  const result = await runValidator(artifactArgs(artifact, { endpoint }));
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/HTTPS origin followed by \/api\/mcp/);
});

test("accepts only the explicit endpoint and build-metadata transform", async () => {
  const artifact = await copyArtifact();
  const endpoint = "https://staging.skillsplane.com/api/mcp";
  const version = "0.1.0+staging.20260811";

  const manifestPath = join(artifact, "plugin.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = version;
  await writeJson(manifestPath, manifest);

  const mcpPath = join(artifact, "mcp.json");
  const mcp = JSON.parse(await readFile(mcpPath, "utf8"));
  mcp.mcpServers.skillsplane.url = endpoint;
  await writeJson(mcpPath, mcp);

  const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(skillPath, skill.replaceAll(productionEndpoint, endpoint));

  const args = artifactArgs(artifact, { endpoint, version });
  expectSuccessful(await runValidator(args));

  await appendFile(skillPath, "\n# stale artifact\n");
  const stale = await runValidator(args);
  expect(stale.code).toBe(1);
  expect(stale.stderr).toMatch(/Skill bytes differ from canonical/);
});

test.each([
  [
    "the all-route frontmatter trigger",
    "before the agent invokes any command or tool that can cause a Git push",
    "before the agent invokes a direct Git push",
    /frontmatter description must activate/,
  ],
  [
    "the frontmatter opening boundary",
    "---\nname: use-workspace-skills",
    "name: use-workspace-skills",
    /frontmatter must start with an exact --- boundary/,
  ],
  [
    "the exact frontmatter name",
    "name: use-workspace-skills",
    "name: renamed-workspace-skills",
    /frontmatter name must be exactly/,
  ],
  [
    "the search and apply activation",
    "Find, apply, and sync current SkillsPlane Workspace skills",
    "Inspect current SkillsPlane Workspace skills",
    /frontmatter description must activate to search and apply/,
  ],
  [
    "the repository connection activation",
    "when connecting a repository to a Workspace",
    "when reading a connected repository",
    /frontmatter description must activate to connect a repository/,
  ],
  [
    "the explicit synchronization activation",
    "when explicitly synchronizing a local Skill",
    "when inspecting a local Skill",
    /frontmatter description must activate to explicitly synchronize/,
  ],
  [
    "zero-byte Skill rejection",
    "reject a zero-byte `SKILL.md`",
    "allow a zero-byte `SKILL.md`",
    /zero-byte/,
  ],
  [
    "literal substring search semantics",
    "case-insensitive literal\n   substring matching",
    "semantic matching",
    /find and apply step 1/,
  ],
  [
    "exact named-Skill query",
    "use only that exact slug or name as the query",
    "append task details to that slug or name",
    /find and apply step 1/,
  ],
  [
    "short task query",
    "one short, distinctive term or contiguous phrase",
    "a full natural-language request",
    /find and apply step 1/,
  ],
  [
    "shorter lookup retry",
    "retry once with a shorter core term from the task",
    "retry once with additional keywords from the task",
    /find and apply step 6/,
  ],
  [
    "unbound search semantics",
    "`search` without a filter",
    "`search` with an inferred filter",
    /find and apply step 2/,
  ],
  [
    "Workspace selection semantics",
    "`WORKSPACE_FILTER_REQUIRED`, call\n   `list_workspaces`, ask the user to choose",
    "`WORKSPACE_FILTER_REQUIRED`, call\n   `search`, choose a Workspace automatically",
    /find and apply step 3/,
  ],
  [
    "tracked binding semantics",
    "git ls-files --error-unmatch -- .skillsplane.json",
    "git status --short -- .skillsplane.json",
    /connect step 5/,
  ],
  [
    "local companion boundary",
    "Do not traverse, inspect, read, validate, or upload",
    "Do traverse, inspect, read, validate, and upload",
    /local companion entries/,
  ],
  [
    "explicit synchronization full-set validation",
    "Complete this validation before calling `list_workspaces` or `sync_skill`",
    "Call `list_workspaces` before completing this validation",
    /explicit sync step 2/,
  ],
  [
    "explicit synchronization full-set enumeration",
    "validate every immediate local Skill entry",
    "validate every selected local Skill entry",
    /explicit sync step 2/,
  ],
  [
    "explicit synchronization response validation",
    "Require a complete, schema-valid successful response for every call",
    "Trust any response returned for every call",
    /explicit sync step 5/,
  ],
  [
    "repository checks before synchronization",
    "run its required checks",
    "skip its required checks",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "checks in every resolved repository",
    /In each resolved repository,\s+follow its instructions and run its required checks/,
    "In only the first resolved repository, follow its instructions and run its required checks",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "uncertain push behavior",
    "inspect the command or tool first",
    "invoke the command or tool first",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "non-pushing checks before synchronization",
    "Only run checks known not to push in this position",
    "Run checks that may push in this position",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "all push target repositories",
    /resolve\s+every repository the intended operation will push/,
    "Resolve only the first repository the intended operation will push",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "invalid source blocking",
    /invalid immediate entry or required file\s+blocks the intended\s+agent-initiated push/,
    "invalid immediate entries and required files permit the push",
    /validate every target repository and local Skill source/,
  ],
  [
    "binding validation for an empty Skill set",
    "require Git to track it, even when the local Skill set is empty",
    "ignore whether Git tracks it when the local Skill set is empty",
    /fail closed on invalid or missing repository bindings/,
  ],
  [
    "binding visibility for an empty Skill set",
    "using the pagination rule above even\n   when the local Skill set is empty",
    "using the pagination rule above only\n   when local Skills exist",
    /fail closed on invalid or missing repository bindings/,
  ],
  [
    "missing binding blocking",
    "missing binding blocks the push",
    "missing binding permits the push",
    /fail closed on invalid or missing repository bindings/,
  ],
  [
    "all-local-Skill synchronization",
    /call\s+`sync_skill` once for every local Skill/,
    "call `sync_skill` once for every changed local Skill",
    /synchronize every local Skill without cached omissions/,
  ],
  [
    "negated all-local-Skill synchronization",
    /call\s+`sync_skill` once for every local Skill/,
    "never call `sync_skill` once for every local Skill",
    /synchronize every local Skill without cached omissions/,
  ],
  [
    "adverbially negated all-local-Skill synchronization",
    /call\s+`sync_skill` once for every local Skill/,
    "do not ever call `sync_skill` once for every local Skill",
    /synchronize every local Skill without cached omissions/,
  ],
  [
    "step-prefixed negated all-local-Skill synchronization",
    "4. Read the complete current content",
    "4. Never Read the complete current content",
    /synchronize every local Skill without cached omissions/,
  ],
  [
    "contradictory appended all-local-Skill synchronization",
    "does not make claims about those pushes.",
    "does not make claims about those pushes. Never call `sync_skill` once for every local Skill.",
    /state all-local-Skill synchronization exactly once/,
  ],
  [
    "negated all-repository resolution",
    /resolve\s+every repository the intended operation will push/,
    "never resolve every repository the intended operation will push",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "negated checks in each resolved repository",
    /In each resolved repository,\s+follow its instructions and run its required checks/,
    "In each resolved repository, do not follow its instructions or run its required checks",
    /run non-pushing repository checks before synchronization/,
  ],
  [
    "contradictory appended all-repository resolution",
    "does not make claims about those pushes.",
    "does not make claims about those pushes. Never resolve every repository the intended operation will push.",
    /resolve every push target repository exactly once/,
  ],
  [
    "contradictory appended checks in each resolved repository",
    "does not make claims about those pushes.",
    "does not make claims about those pushes. In each resolved repository, do not follow its instructions or run its required checks.",
    /state each target repository's checks exactly once/,
  ],
  [
    "synchronization response failures block the push",
    "missing result blocks the push",
    "missing result permits the push",
    /validate every synchronization response and block failures/,
  ],
  [
    "the server-derived hash boundary",
    "Do not recompute or compare a local hash",
    "Recompute and compare a local hash",
    /validate every synchronization response and block failures/,
  ],
  [
    "invocation-final source revalidation",
    "Immediately before invoking the intended push command or tool",
    "After invoking the intended push command or tool",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "source changes restart checks and synchronization",
    /restart at the beginning of this workflow/,
    "continue without synchronizing every local Skill again",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "source changes resolve every repository again",
    /resolve every target repository\s+again/,
    "reuse the previous target repository set",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "source changes rerun every repository's instructions",
    /follow each repository's instructions again/,
    "skip each repository's instructions on restart",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "source changes rerun required checks",
    /rerun every non-pushing\s+required check/,
    "reuse the prior non-pushing required check results",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "source changes do not negate target resolution",
    /resolve every target repository\s+again/,
    "do not resolve every target repository again",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "source changes do not negate restart",
    "restart at the beginning of this workflow",
    "do not restart at the beginning of this workflow",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "contradictory appended restart target resolution",
    "does not make claims about those pushes.",
    "does not make claims about those pushes. After mutation, do not resolve every target repository again.",
    /state restart target resolution exactly once/,
  ],
  [
    "contradictory appended workflow restart",
    "does not make claims about those pushes.",
    "does not make claims about those pushes. Do not restart at the beginning of this workflow.",
    /state workflow restart exactly once/,
  ],
  [
    "contradictory appended restart synchronization",
    "does not make claims about those pushes.",
    "does not make claims about those pushes. Never synchronize every local Skill again.",
    /state restart synchronization exactly once/,
  ],
  [
    "source changes keep checks before resynchronization",
    /rerun every non-pushing\s+required check, then validate and synchronize every local Skill again/,
    "validate and synchronize every local Skill again, then rerun every non-pushing required check",
    /revalidate source and binding state before push command or tool invocation/,
  ],
  [
    "the normal repository push route",
    /repository- or\s+user-selected push command or tool through its normal route/,
    "replace the repository-selected push command with a Plugin direct push",
    /delegate push execution to the normal repository route/,
  ],
  [
    "normal Git configuration and hooks",
    /Preserve its normal Git\s+configuration and hooks/,
    "Disable its normal Git configuration and hooks",
    /delegate push execution to the normal repository route/,
  ],
  [
    "Git transport non-ownership",
    /Do not inspect, constrain, or override its\s+transport/,
    "Inspect, constrain, and override its transport",
    /delegate push execution to the normal repository route/,
  ],
  [
    "known tool push side effects",
    /complete this workflow\s+before invoking that tool/,
    "replace that tool's push implementation",
    /delegate push execution to the normal repository route/,
  ],
  [
    "ordinary Git push invocation boundary",
    /invocation-final validation is immediately\s+before the push command invocation/,
    "invocation-final validation may occur long before the push command invocation",
    /limit compound tool guarantees to the invocation boundary/,
  ],
  [
    "compound tool mutation limitation",
    /compound tool may mutate sources after it\s+is invoked and before its internal Git push/,
    "compound tools cannot mutate sources between invocation and internal Git push",
    /limit compound tool guarantees to the invocation boundary/,
  ],
  [
    "compound tool non-interception limitation",
    /does not inspect or\s+intercept mutations inside the tool/,
    "inspects and intercepts mutations inside the tool",
    /limit compound tool guarantees to the invocation boundary/,
  ],
  [
    "compound tool no actual-push-immediate guarantee",
    /Do not claim\s+an actual-Git-push-immediate guarantee for that compound route/,
    "Claim an actual-Git-push-immediate guarantee for that compound route",
    /limit compound tool guarantees to the invocation boundary/,
  ],
  [
    "no synchronization state",
    "Do not store an accepted hash, timestamp, or other local synchronization state",
    "Store an accepted hash, timestamp, or other local synchronization state",
    /avoid local synchronization state and Git proof claims/,
  ],
  [
    "no Git proof claim",
    /Explicit synchronization success alone does not prove the same\s+content was committed or pushed/,
    "Explicit synchronization success proves content was committed and pushed",
    /avoid local synchronization state and Git proof claims/,
  ],
  [
    "the cooperative workflow boundary",
    "cooperative agent workflow",
    "atomic Git security mechanism",
    /cooperative and external-push boundaries/,
  ],
  [
    "the external push boundary",
    /cannot intercept\s+pushes independently initiated by a user, IDE, external terminal, or another/,
    "intercepts pushes independently initiated by a user, IDE, external terminal, or another",
    /cooperative and external-push boundaries/,
  ],
])("validates %s independently of canonical bytes", async (_name, from, to, error) => {
  const artifact = await copyArtifact();
  const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  if (typeof from === "string") expect(skill).toContain(from);
  else expect(skill).toMatch(from);
  await writeFile(
    skillPath,
    skill.replace(from, () => to),
  );

  const result = await runValidator(
    artifactArgs(artifact, { canonicalSkill: skillPath }),
  );
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(error);
});

test.each([
  [
    "explicit sync rejects a 63-character hash",
    "Explicit synchronization",
    "^sha256:[a-f0-9]{63}$",
    /explicit sync step 5 must require the exact contentHash schema/,
  ],
  [
    "explicit sync rejects uppercase hash characters",
    "Explicit synchronization",
    "^sha256:[A-F0-9]{64}$",
    /explicit sync step 5 must require the exact contentHash schema/,
  ],
  [
    "explicit sync rejects a prefix-only hash schema",
    "Explicit synchronization",
    "sha256:",
    /explicit sync step 5 must require the exact contentHash schema/,
  ],
  [
    "push sync rejects a 63-character hash",
    "Synchronize before any agent-initiated push",
    "^sha256:[a-f0-9]{63}$",
    /validate every synchronization response and block failures/,
  ],
  [
    "push sync rejects uppercase hash characters",
    "Synchronize before any agent-initiated push",
    "^sha256:[A-F0-9]{64}$",
    /validate every synchronization response and block failures/,
  ],
  [
    "push sync rejects a prefix-only hash schema",
    "Synchronize before any agent-initiated push",
    "sha256:",
    /validate every synchronization response and block failures/,
  ],
])("%s", async (_name, heading, replacement, error) => {
  const artifact = await copyArtifact();
  const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
  const skill = await readFile(skillPath, "utf8");
  await writeFile(
    skillPath,
    replaceInSecondLevelSection(skill, heading, "^sha256:[a-f0-9]{64}$", replacement),
  );

  const result = await runValidator(
    artifactArgs(artifact, { canonicalSkill: skillPath }),
  );
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(error);
});

test.each([
  [
    "managed direct push",
    "Run `git -c push.recurseSubmodules=no push --no-verify -- origin refs/heads/main:refs/heads/main`.",
  ],
  [
    "generic Plugin-directed push",
    "Run `git push --force origin main` directly instead of the repository-selected route.",
  ],
  [
    "wrapped generic Plugin-directed push",
    "Run\n`git push --force origin main` directly instead of the repository-selected route.",
  ],
  [
    "configured Plugin-directed push",
    "Invoke `git -c core.sshCommand=ssh push origin main` directly.",
  ],
  [
    "quoted-config Plugin-directed push",
    'Invoke `git -c http.extraHeader="X: value" push origin main` directly.',
  ],
  [
    "trailing-historical Plugin-directed push",
    "Run `git push origin main` directly: Historical context follows.",
  ],
  [
    "colon-valued config Plugin-directed push",
    "Run `git -c example.mode=value:historical push origin main` directly.",
  ],
  [
    "nested Plugin-directed push",
    "- Context:\n  - Run `git push --force origin main` directly.",
  ],
  [
    "nested Plugin-directed push without parent punctuation",
    "- Context\n  - Run `git push --force origin main` directly.",
  ],
  [
    "do-not-forget Plugin-directed push",
    "Do not forget to run `git push origin main` directly.",
  ],
  [
    "must-not-forget Plugin-directed push",
    "Must not forget to run `git push origin main` directly.",
  ],
  [
    "effective remote inspection",
    "Require `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "Plugin-owned ref validation",
    "Run `git check-ref-format refs/heads/main` before the push.",
  ],
  [
    "Plugin-owned HTTP configuration",
    "Override `http.followRedirects` and `http.extraHeader` before the push.",
  ],
  [
    "Plugin-owned credential configuration",
    "Configure `credential.helper` before the push.",
  ],
  [
    "Plugin-owned remote selection",
    "Configure `remote.<name>` as the Plugin-selected push target.",
  ],
  [
    "wrapped effective remote inspection",
    "Require\n`git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "wrapped Plugin-owned ref validation",
    "Run\n`git check-ref-format refs/heads/main` before the push.",
  ],
  [
    "wrapped Plugin-owned credential configuration",
    "Configure\ncredential.helper before the push.",
  ],
  [
    "wrapped managed direct push configuration",
    "Run `git -c push.\nrecurseSubmodules=no push --no-verify -- origin refs/heads/main:refs/heads/main`.",
  ],
  [
    "wrapped effective remote inspection signature",
    "Require `git remote\nget-url --push --all origin` before synchronization.",
  ],
  [
    "wrapped Plugin-owned ref validation signature",
    "Run `git\ncheck-ref-format refs/heads/main` before the push.",
  ],
  [
    "wrapped Plugin-owned credential key",
    "Configure credential.\nhelper before the push.",
  ],
  ["wrapped Plugin-owned HTTP key", "Override http.\nextraHeader before the push."],
  [
    "wrapped Plugin-owned remote key",
    "Configure remote.\n<name> as the Plugin-selected push target.",
  ],
  [
    "nested-list effective remote inspection",
    "- Require:\n  - `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "list-item heading effective remote inspection",
    "- Require:\n  ### Remote inspection\n  `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "list-item blank-line effective remote inspection",
    "- Require:\n\n  `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "non-interrupting ordered marker",
    "Require\n2. `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "invalid ten-digit ordered marker",
    "Require\n1234567890. `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "valid ordered-list child",
    "10. Require:\n    - `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "four-space-indented bullet continuation",
    "Require\n    - `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "empty ordered marker continuation",
    "Require\n1.   \n   `git remote get-url --push --all origin` before synchronization.",
  ],
])("rejects reintroduction of Plugin-owned Git policy: %s", async (_name, policy) => {
  const artifact = await copyArtifact();
  const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
  await appendFile(skillPath, `\n${policy}\n`);

  const result = await runValidator(
    artifactArgs(artifact, { canonicalSkill: skillPath }),
  );
  expect(result.code).toBe(1);
  expect(result.stderr).toMatch(/must not reintroduce Plugin-managed Git policy/);
});

test.each([
  [
    "a single paragraph",
    "Historical context may name `credential.helper`, `remote.<name>`, and `--no-verify` without making them Plugin directives.",
  ],
  [
    "separate paragraphs",
    "Require the normal repository route.\n\nHistorical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "a following heading block",
    "Require the normal repository route.\n## Historical context\ncredential.helper is only a legacy term here.",
  ],
  [
    "an indented heading block",
    "Require the normal repository route.\n   ## Historical context\ncredential.helper is only a legacy term here.",
  ],
  [
    "a separate list item",
    "- Require the normal repository route.\n- Historical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "a nested sibling list item",
    "- Context:\n  - Require the normal repository route.\n  - Historical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "a paragraph after a list",
    "- Require the normal repository route.\n\nHistorical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "an insufficiently indented ordered-list child",
    "10. Require the normal repository route.\n   - Historical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "a Setext heading boundary",
    "Require the normal repository route.\n====================================\nHistorical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "an indented-code list item",
    "Require\n-     `git remote get-url --push --all origin` before synchronization.",
  ],
  [
    "a marker-only sibling list item",
    "1. Require the normal repository route.\n2.\n   Historical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "a paragraph dedented after a nested empty item",
    "- Require the normal repository route.\n  1.\nHistorical context may name credential.helper without making it a Plugin directive.",
  ],
  [
    "a negated direct-push sentence",
    "Do not run `git push --force origin main` directly.",
  ],
  [
    "historical direct-push prose",
    "Historical context may say that agents run `git push --force origin main`; this is not a Plugin directive.",
  ],
  [
    "a nested negated direct-push sentence",
    "- Context:\n  - Do not run `git push origin main` directly.",
  ],
  [
    "a standalone do-not direct-push scope",
    "- Do not:\n  - Run `git push origin main` directly.",
  ],
  [
    "a standalone modal-negative direct-push scope",
    "- Must not:\n  - Run `git push origin main` directly.",
  ],
  [
    "a standalone forbidden direct-push scope",
    "- Forbidden:\n  - Run `git push origin main` directly.",
  ],
  [
    "nested historical direct-push prose",
    "- Context:\n  - Historical context: Run `git push origin main` was the old workflow.",
  ],
  [
    "a nested canonical direct-push reference",
    "- Context:\n  - For an ordinary `git push`, use the normal repository route.",
  ],
  [
    "a long non-push option sequence",
    `Run \`git ${"-a ".repeat(2_000)}status\` only as a syntax example.`,
  ],
])("allows non-directive references to Git policy terms in %s", async (_name, text) => {
  const artifact = await copyArtifact();
  const skillPath = join(artifact, "skills", "use-workspace-skills", "SKILL.md");
  await appendFile(skillPath, `\n${text}\n`);

  expectSuccessful(
    await runValidator(artifactArgs(artifact, { canonicalSkill: skillPath })),
  );
});

function replaceInSecondLevelSection(
  markdown: string,
  heading: string,
  from: string,
  to: string,
) {
  const marker = `## ${heading}`;
  const headingStart = markdown.indexOf(marker);
  expect(headingStart).not.toBe(-1);
  const contentStart = headingStart + marker.length;
  const followingHeading = markdown.indexOf("\n## ", contentStart);
  const contentEnd = followingHeading < 0 ? markdown.length : followingHeading;
  const section = markdown.slice(contentStart, contentEnd);
  expect(section).toContain(from);
  return `${markdown.slice(0, contentStart)}${section.replace(from, to)}${markdown.slice(contentEnd)}`;
}

function artifactArgs(
  root: string,
  overrides: { canonicalSkill?: string; endpoint?: string; version?: string } = {},
) {
  return [
    "--root",
    root,
    "--canonical-skill",
    overrides.canonicalSkill ?? canonicalSkillPath,
    "--canonical-endpoint",
    productionEndpoint,
    "--expected-endpoint",
    overrides.endpoint ?? productionEndpoint,
    "--expected-version",
    overrides.version ?? "0.1.0",
  ];
}

async function copyArtifact() {
  const workspace = await mkdtemp(join(tmpdir(), "skillsplane-artifact-"));
  temporaryRoots.push(workspace);
  const artifact = join(workspace, "skillsplane");
  await cp(portableRoot, artifact, { recursive: true });
  return artifact;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function calculateContentDigest(root: string) {
  const manifestLines = [contentDigestDomain];
  for (const relativePath of contentDigestPaths) {
    const bytes = await readFile(join(root, relativePath));
    manifestLines.push(`${relativePath}\t${bytes.byteLength}\tsha256:${sha256(bytes)}`);
  }
  return `sha256:${sha256(Buffer.from(`${manifestLines.join("\n")}\n`, "utf8"))}`;
}

function sha256(value: NodeJS.ArrayBufferView) {
  return createHash("sha256").update(value).digest("hex");
}

async function runValidator(arguments_: string[]) {
  return runScript(validatorPath, arguments_);
}

async function runScript(path: string, arguments_: string[]) {
  return new Promise<{ code: number | null; stderr: string; stdout: string }>(
    (resolvePromise, reject) => {
      const child = spawn(process.execPath, [path, ...arguments_], {
        cwd: repoRoot,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolvePromise({ code, stderr, stdout }));
    },
  );
}

function expectSuccessful(result: {
  code: number | null;
  stderr: string;
  stdout: string;
}) {
  expect(result.code, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toMatch(/Portable Agent Plugin artifact validation passed/);
}

function expectDigestOnly(result: {
  code: number | null;
  stderr: string;
  stdout: string;
}) {
  expect(result.code, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toMatch(/^sha256:[a-f0-9]{64}\n$/);
  return result.stdout.trim();
}
