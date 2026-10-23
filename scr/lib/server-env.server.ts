import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type WorkerBindings = Record<string, unknown>;

const workerBindingsStorage = new AsyncLocalStorage<{
  bindings: WorkerBindings | undefined;
}>();

function isWorkerBindings(value: unknown): value is WorkerBindings {
  return typeof value === "object" && value !== null;
}

export function runWithWorkerBindings<T>(
  bindings: unknown,
  callback: () => T,
): T {
  return workerBindingsStorage.run(
    { bindings: isWorkerBindings(bindings) ? bindings : undefined },
    callback,
  );
}

export function getServerEnv(name: string) {
  const requestScope = workerBindingsStorage.getStore();
  if (requestScope) {
    const value = requestScope.bindings?.[name];
    return typeof value === "string" ? value : undefined;
  }

  return typeof process === "undefined" ? undefined : process.env[name];
}

export function requiredServerEnv(name: string, fallback?: string) {
  const value = (getServerEnv(name) ?? fallback)?.trim();
  if (!value) {
    if (workerBindingsStorage.getStore()) {
      console.error(`Missing server configuration binding: ${name}`);
    }
    throw new Error(`Missing server configuration: ${name}`);
  }
  return value;
}
