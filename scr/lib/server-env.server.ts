import "@tanstack/react-start/server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type WorkerBindings = Record<string, unknown>;

const workerBindingsStorage = new AsyncLocalStorage<WorkerBindings>();

function isWorkerBindings(value: unknown): value is WorkerBindings {
  return typeof value === "object" && value !== null;
}

export function runWithWorkerBindings<T>(
  bindings: unknown,
  callback: () => T,
): T {
  return workerBindingsStorage.run(
    isWorkerBindings(bindings) ? bindings : {},
    callback,
  );
}

export function getServerEnv(name: string) {
  const workerBindings = workerBindingsStorage.getStore();
  if (workerBindings) {
    const value = workerBindings[name];
    return typeof value === "string" ? value : undefined;
  }

  return typeof process === "undefined" ? undefined : process.env[name];
}

export function requiredServerEnv(name: string, fallback?: string) {
  const value = (getServerEnv(name) ?? fallback)?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
