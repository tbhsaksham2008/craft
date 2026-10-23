import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { getGameDeliveryClient } from "@/lib/game-delivery.server";
import { getServerEnv } from "@/lib/server-env.server";
import {
  getPublicServerStatus,
  isValidServerHeartbeat,
} from "@/lib/server-status";

export const Route = createFileRoute("/api/game/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const supabase = createPublicSupabaseClient();
          const { data, error } = await supabase
            .from("server_status")
            .select("online,online_players,max_players,updated_at")
            .eq("id", "main")
            .maybeSingle();
          if (error) throw error;
          return Response.json(getPublicServerStatus(data));
        } catch (error) {
          console.error("Could not load public Minecraft server status", error);
          return Response.json(
            { error: "Server status is temporarily unavailable." },
            { status: 503 },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const supabase = await getGameDeliveryClient(request);
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Request body must be valid JSON." },
              { status: 400 },
            );
          }
          if (!isValidServerHeartbeat(body)) {
            return Response.json(
              { error: "Server status data is invalid." },
              { status: 400 },
            );
          }
          const { error } = await supabase.from("server_status").upsert(
            {
              id: "main",
              online: body.online,
              online_players: body.onlinePlayers,
              max_players: body.maxPlayers,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
          if (error) throw error;
          return Response.json({ success: true });
        } catch (error) {
          if (error instanceof Response) return error;
          console.error("Could not save Minecraft server heartbeat", error);
          return Response.json(
            { error: "Server status could not be saved." },
            { status: 500 },
          );
        }
      },
    },
  },
});

function createPublicSupabaseClient() {
  const url =
    getServerEnv("VITE_SUPABASE_URL") ?? import.meta.env["VITE_SUPABASE_URL"];
  const anonKey =
    getServerEnv("VITE_SUPABASE_ANON_KEY") ??
    import.meta.env["VITE_SUPABASE_ANON_KEY"];
  if (!url || !anonKey) {
    throw new Error("Public Supabase settings are not configured.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
