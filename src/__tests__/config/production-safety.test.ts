// @vitest-environment node
/**
 * Production must not run development settings silently.
 *
 * `server.config.dev.yml` relaxes two things on purpose — it sets logging to
 * "debug" and drops the password policy to 8 characters with no character
 * requirements — because both are convenient locally. Until v1.0.0 the
 * deployment instructions told operators to copy that file to production, so
 * both settings travelled to live hosts and nothing said a word.
 *
 * `server.config.prod.yml` is the fix. This is the backstop for when someone
 * copies the wrong one anyway.
 *
 * It warns rather than overrides deliberately: raising the level to debug on a
 * live system is a legitimate thing to do while chasing a problem. What the
 * warning prevents is the temporary change nobody remembers to undo — it is on
 * every start until it is put back.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MockInstance } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;
let warnSpy: MockInstance<(...args: unknown[]) => void>;
const ORIGINAL_ENV = process.env.NODE_ENV;

/**
 * The loader keeps its state on `globalThis` on purpose — Next.js code-splits it
 * into several chunks and each would otherwise get its own null state and reload
 * the file. `vi.resetModules()` does not touch globalThis, so a second load in
 * one test file returns the first one's answers unless the keys are cleared too.
 */
function clearLoaderState(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.__serverConfig;
  delete g.__serverConfigPath;
  // The path cache is gated by a separate flag. Leaving it set makes
  // resolveConfigPath() return the (now deleted) cached path — i.e. null — so
  // the loader reads no file at all and silently answers with defaults, which
  // looks exactly like "the warning did not fire".
  delete g.__serverConfigPathResolved;
}

/** Write a config file and load it fresh. */
async function loadWith(yaml: string, nodeEnv: string): Promise<string[]> {
  const file = path.join(tmpDir, `cfg-${Math.random().toString(36).slice(2)}.yml`);
  fs.writeFileSync(file, yaml);

  process.env.SERVER_CONFIG_PATH = file;
  // NODE_ENV is readonly in the Next.js type defs; the runtime value is what matters.
  (process.env as Record<string, string>).NODE_ENV = nodeEnv;

  clearLoaderState();
  vi.resetModules();
  const { loadServerConfig } = await import("@/lib/config/loader");
  loadServerConfig();

  return warnSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith("[Config]"));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtsd-prod-safety-"));
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {}) as unknown as MockInstance<
    (...args: unknown[]) => void
  >;
});

afterEach(() => {
  warnSpy.mockRestore();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.SERVER_CONFIG_PATH;
  (process.env as Record<string, string | undefined>).NODE_ENV = ORIGINAL_ENV;
});

describe("production config safety warnings", () => {
  it("warns when production runs a verbose log level", async () => {
    const warnings = await loadWith(`logging:\n  level: "debug"\n`, "production");
    expect(warnings.join("\n")).toMatch(/logging\.level is "debug" in production/);
  });

  it("warns on trace as well as debug", async () => {
    const warnings = await loadWith(`logging:\n  level: "trace"\n`, "production");
    expect(warnings.join("\n")).toMatch(/logging\.level is "trace" in production/);
  });

  it("warns when the seed endpoint is enabled in production", async () => {
    const warnings = await loadWith(`features:\n  enableSeedEndpoint: true\n`, "production");
    expect(warnings.join("\n")).toMatch(/enableSeedEndpoint is true in production/);
  });

  it("stays silent for a correct production config", async () => {
    const warnings = await loadWith(
      `logging:\n  level: "info"\nfeatures:\n  enableSeedEndpoint: false\n`,
      "production",
    );
    expect(warnings).toEqual([]);
  });

  it("stays silent outside production — dev is allowed to be verbose", async () => {
    const warnings = await loadWith(
      `logging:\n  level: "debug"\nfeatures:\n  enableSeedEndpoint: true\n`,
      "development",
    );
    expect(warnings).toEqual([]);
  });

  it("defaults to safe values when production has no config file at all", async () => {
    // A container with nothing mounted must be correct, not merely quiet.
    process.env.SERVER_CONFIG_PATH = path.join(tmpDir, "absent.yml");
    (process.env as Record<string, string>).NODE_ENV = "production";

    clearLoaderState();
    vi.resetModules();
    const { loadServerConfig, getLogLevel, getFeatures } = await import("@/lib/config/loader");
    loadServerConfig();

    expect(getLogLevel()).toBe("info");
    expect(getFeatures().enableSeedEndpoint).toBe(false);
    expect(
      warnSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith("[Config]")),
    ).toEqual([]);
  });
});

describe("the shipped config templates", () => {
  const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), "utf-8");

  it("ships a production template with production settings", () => {
    const prod = read("server.config.prod.yml");
    expect(prod).toMatch(/level:\s*"info"/);
    expect(prod).toMatch(/enableSeedEndpoint:\s*false/);
    expect(prod).toMatch(/minLength:\s*12/);
    expect(prod).toMatch(/requireUppercase:\s*true/);
    expect(prod).toMatch(/requireSpecialChars:\s*true/);
  });

  it("keeps the dev template relaxed, and that is why it must not reach production", () => {
    // Asserting the difference on purpose: if someone "fixes" the dev template
    // to match prod, the two files have no reason to both exist, and this test
    // should be the thing that forces that conversation.
    const dev = read("server.config.dev.yml");
    expect(dev).toMatch(/level:\s*"debug"/);
    expect(dev).toMatch(/enableSeedEndpoint:\s*false/); // never relaxed, in either
  });
});
