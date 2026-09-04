import assert from "node:assert/strict";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { test } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const pluginRoot = new URL("../plugins/agent-plugins/skillsplane/", import.meta.url);
const pluginJson = readJson(new URL("plugin.json", pluginRoot));
const mcpJson = readJson(new URL("mcp.json", pluginRoot));
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

test("public marketplace points directly to the portable package", () => {
  assert.equal(marketplaceJson.name, "skillsplane");
  assert.equal(marketplaceJson.interface.displayName, "SkillsPlane");
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

test("Cursor and Codex catalogs resolve the same portable package", () => {
  const cursor = readJson(new URL("../.cursor-plugin/marketplace.json", import.meta.url));
  assert.equal(cursor.name, marketplaceJson.name);
  assert.equal(cursor.owner.name, pluginJson.author.name);
  assert.equal(cursor.plugins.length, 1);
  const entry = cursor.plugins[0];
  assert.equal(entry.name, pluginJson.name);
  assert.equal(entry.source, marketplaceJson.plugins[0].source.path);
  const resolved = new URL(
    `${entry.source}/plugin.json`,
    new URL("../", import.meta.url),
  );
  assert.equal(resolved.href, new URL("plugin.json", pluginRoot).href);
  assert.deepEqual(readJson(resolved), pluginJson);
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
