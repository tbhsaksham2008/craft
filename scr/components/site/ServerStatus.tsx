import { Copy, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { site } from "@/config/site";

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
  return (
    <div className="glass w-full max-w-sm rounded-2xl p-5 shadow-glow">
      <div className="flex items-center justify-between">
        <h3 className="text-lg">Server status</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
          <Wifi className="size-3.5" />
          Active
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
        <span className="truncate font-mono text-sm">{site.serverAddress}</span>
        <Button size="sm" variant="soft" onClick={copyAddress}>
          <Copy /> Copy
        </Button>
      </div>
    </div>
  );
}
