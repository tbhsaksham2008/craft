import { useEffect, useRef, useState } from "react";
import { getTurnstileSiteKey } from "@/lib/turnstile";

type TurnstileWidgetOptions = {
  sitekey: string;
  theme: "auto";
  size: "flexible";
  action: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileWidgetOptions) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]',
    );
    const script =
      existing ??
      Object.assign(document.createElement("script"), {
        src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
        async: true,
        defer: true,
      });
    function fail() {
      window.clearTimeout(loadTimeout);
      scriptPromise = undefined;
      reject(new Error("The security check could not be loaded."));
    }
    const loaded = () => {
      window.clearTimeout(loadTimeout);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    script.addEventListener("error", fail, { once: true });
    script.addEventListener("load", loaded, { once: true });
    const loadTimeout = window.setTimeout(fail, 10_000);
    if (!existing) document.head.append(script);
    if (window.turnstile) {
      window.clearTimeout(loadTimeout);
      resolve(window.turnstile);
    }
  });
  return scriptPromise;
}

type TurnstileWidgetProps = {
  action: string;
  resetKey: number;
  onTokenChange: (token: string) => void;
  onError: (message: string) => void;
};

export function TurnstileWidget({
  action,
  resetKey,
  onTokenChange,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [siteKey, setSiteKey] = useState("");

  useEffect(() => {
    let active = true;
    void getTurnstileSiteKey().then(
      (key) => {
        if (active) setSiteKey(key);
      },
      () => {
        if (active)
          onError(
            "The security check is not configured. Please try again later.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [onError]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let active = true;
    let widgetId: string | undefined;
    void loadTurnstile().then(
      (turnstile) => {
        if (!active || !containerRef.current) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          size: "flexible",
          action,
          callback: (token) => onTokenChange(token),
          "expired-callback": () => {
            onTokenChange("");
            onError("The security check expired. Please complete it again.");
          },
          "error-callback": () => {
            onTokenChange("");
            onError("The security check failed to load. Please try again.");
          },
        });
      },
      (error: unknown) => {
        if (active)
          onError(
            error instanceof Error
              ? error.message
              : "The security check could not be loaded.",
          );
      },
    );
    return () => {
      active = false;
      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [action, onError, onTokenChange, resetKey, siteKey]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[65px]" />
      <p className="text-xs text-muted-foreground">
        Complete the security check to continue.
      </p>
    </div>
  );
}
