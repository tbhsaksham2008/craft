import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getServerEnv,
  requiredServerEnv,
  runWithWorkerBindings,
} from "./server-env.server";

const testVariable = "CRAFT_SERVER_ENV_TEST";
const originalValue = process.env[testVariable];

afterEach(() => {
  vi.restoreAllMocks();
  if (originalValue === undefined) {
    delete process.env[testVariable];
  } else {
    process.env[testVariable] = originalValue;
  }
});

describe("server environment", () => {
  it("reads Cloudflare Worker bindings within the request scope", () => {
    process.env[testVariable] = "local-value";

    expect(
      runWithWorkerBindings({ [testVariable]: "worker-value" }, () =>
        getServerEnv(testVariable),
      ),
    ).toBe("worker-value");
  });

  it("keeps Worker bindings available across asynchronous work", async () => {
    await expect(
      runWithWorkerBindings({ [testVariable]: "worker-value" }, async () => {
        await Promise.resolve();
        return getServerEnv(testVariable);
      }),
    ).resolves.toBe("worker-value");
  });

  it("does not fall back to local process variables in a Worker request", () => {
    process.env[testVariable] = "local-value";

    expect(
      runWithWorkerBindings({}, () => getServerEnv(testVariable)),
    ).toBeUndefined();
  });

  it("does not replace missing Worker bindings with an empty-object fallback", () => {
    process.env[testVariable] = "local-value";

    expect(
      runWithWorkerBindings(undefined, () => getServerEnv(testVariable)),
    ).toBeUndefined();
  });

  it("isolates bindings between concurrent Worker requests", async () => {
    const values = await Promise.all([
      runWithWorkerBindings({ [testVariable]: "first-request" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getServerEnv(testVariable);
      }),
      runWithWorkerBindings({ [testVariable]: "second-request" }, async () => {
        await Promise.resolve();
        return getServerEnv(testVariable);
      }),
    ]);

    expect(values).toEqual(["first-request", "second-request"]);
  });

  it("uses local process variables outside a Worker request", () => {
    process.env[testVariable] = "local-value";

    expect(getServerEnv(testVariable)).toBe("local-value");
  });

  it("reports only the missing configuration name", () => {
    process.env[testVariable] = "do-not-log-this-value";
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      runWithWorkerBindings({}, () => requiredServerEnv(testVariable)),
    ).toThrow(`Missing server configuration: ${testVariable}`);
    expect(diagnostic).toHaveBeenCalledWith(
      `Missing server configuration binding: ${testVariable}`,
    );
    expect(diagnostic.mock.calls.flat().join(" ")).not.toContain(
      "do-not-log-this-value",
    );
  });
});
