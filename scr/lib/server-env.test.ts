import { afterEach, describe, expect, it } from "vitest";
import {
  getServerEnv,
  requiredServerEnv,
  runWithWorkerBindings,
} from "./server-env.server";

const testVariable = "CRAFT_SERVER_ENV_TEST";
const originalValue = process.env[testVariable];

afterEach(() => {
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

  it("uses local process variables outside a Worker request", () => {
    process.env[testVariable] = "local-value";

    expect(getServerEnv(testVariable)).toBe("local-value");
  });

  it("reports only the missing configuration name", () => {
    expect(() =>
      runWithWorkerBindings({}, () => requiredServerEnv(testVariable)),
    ).toThrow(`Missing server configuration: ${testVariable}`);
  });
});
