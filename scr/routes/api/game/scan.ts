import { createFileRoute } from "@tanstack/react-router";
import { getGameDeliveryClient } from "@/lib/game-delivery.server";
import { scanGmailNotificationsWithAdmin } from "@/lib/gmail-payments";

export const Route = createFileRoute("/api/game/scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const admin = await getGameDeliveryClient(request);
          const result = await scanGmailNotificationsWithAdmin(admin);
          return Response.json(result);
        } catch (error) {
          if (error instanceof Response) return error;
          console.error("Scheduled Gmail payment scan failed", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Could not scan payment notifications.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
