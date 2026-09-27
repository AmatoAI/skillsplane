import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const pluginRoot = new URL("../plugins/agent-plugins/skillsplane/", import.meta.url);
const pluginJson = readJson(new URL("plugin.json", pluginRoot));
const marketplaceJson = readJson(
  new URL("../.agents/plugins/marketplace.json", import.meta.url),
);

test("repository exposes one portable Plugin product", () => {
  assert.equal(packageJson.private, true);
  assert.equal("bin" in packageJson, false);
  assert.equal("exports" in packageJson, false);
  assert.equal("files" in packageJson, false);
  assert.equal("publishConfig" in packageJson, false);
  assert.equal("dependencies" in packageJson, false);
  assert.equal("build" in packageJson.scripts, false);
  assert.equal("prepack" in packageJson.scripts, false);
  // 配布形式の詳細はartifact validatorで検証する。ここでは製品の入口を限定する。
  assert.deepEqual(readdirSync(new URL("../plugins/", import.meta.url)), [
    "agent-plugins",
  ]);
  assert.deepEqual(readdirSync(new URL("../plugins/agent-plugins/", import.meta.url)), [
    "skillsplane",
  ]);
});

test("public catalogs withhold the package until live status verification", () => {
  assert.equal(marketplaceJson.name, "skillsplane");
  assert.equal(marketplaceJson.interface.displayName, "SkillsPlane");
  assert.deepEqual(marketplaceJson.plugins, []);
  const cursor = readJson(new URL("../.cursor-plugin/marketplace.json", import.meta.url));
  assert.equal(cursor.name, marketplaceJson.name);
  assert.equal(cursor.owner.name, pluginJson.author.name);
  assert.deepEqual(cursor.plugins, []);
});

// biome-ignore lint/suspicious/noExplicitAny: plugin fixture JSON is intentionally dynamic.
function readJson(path: URL): Record<string, any> {
  return JSON.parse(readFileSync(path, "utf8"));
}
