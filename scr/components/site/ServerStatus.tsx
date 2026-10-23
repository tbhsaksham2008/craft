import { useQuery } from "@tanstack/react-query";
import { Copy, Users, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { site } from "@/config/site";
import type { PublicServerStatus } from "@/lib/server-status";

export function copyAddress() {
  navigator.clipboard.writeText(site.serverAddress).then(
    () =>
      toast.success("Server address copied!", {
        description: site.serverAddress,
      }),
    () => toast.error("Couldn't copy — please copy it manually."),
  );
}

export function CopyIp() {
  return (
    <button
      onClick={copyAddress}
      className="glass group inline-flex items-center gap-3 rounded-xl px-4 py-2.5 font-mono text-sm shadow-soft transition hover:bg-card"
    >
      <span className="size-2 rounded-full bg-success" aria-hidden />
      {site.serverAddress}
      <Copy className="size-4 text-ink transition-transform group-hover:scale-110" />
      <span className="sr-only">Copy server address</span>
    </button>
  );
}

export function ServerStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["server-status"],
    queryFn: async (): Promise<PublicServerStatus> => {
      const response = await fetch("/api/game/status", {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("status unavailable");
      return (await response.json()) as PublicServerStatus;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const unavailable = isError || !data?.available;
  return (
    <div className="glass w-full max-w-sm rounded-2xl p-5 shadow-glow">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg">Server status</h3>
        {isLoading ? (
          <Skeleton className="h-6 w-16 rounded-full" />
        ) : unavailable ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            Unavailable
          </span>
        ) : data?.online ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <Wifi className="size-3.5" />
            Online
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
            <WifiOff className="size-3.5" />
            Offline
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-brand">
          <Users className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Players</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-5 w-20" />
          ) : (
            <p className="font-semibold">
              {!unavailable && data?.players
                ? `${data.players.online} / ${data.players.max}`
                : "—"}
            </p>
          )}
        </div>
      </div>
      {unavailable && !isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Waiting for a status update from the Minecraft server plugin.
        </p>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
        <span className="truncate font-mono text-sm">{site.serverAddress}</span>
        <Button size="sm" variant="soft" onClick={copyAddress}>
          <Copy /> Copy
        </Button>
      </div>
    </div>
  );
}
