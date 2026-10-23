import { createFileRoute } from "@tanstack/react-router";
import {
  expandDeliveryCommands,
  getGameDeliveryClient,
  parseMinecraftUsername,
  type OrderItemRow,
  type OrderRow,
  type QueueRow,
} from "@/lib/game-delivery.server";

export const Route = createFileRoute("/api/game/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const admin = await getGameDeliveryClient(request);
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json(
              { error: "Request body must be valid JSON." },
              { status: 400 },
            );
          }
          const username = parseMinecraftUsername(
            (body as { username?: unknown } | null)?.username,
          );
          const { data: queued, error: queueError } = await admin
            .from("fulfillment_queue")
            .select("id,order_item_id,attempts")
            .eq("status", "queued")
            .order("created_at", { ascending: true })
            .limit(100);
          if (queueError) throw queueError;
          const queueRows = (queued ?? []) as QueueRow[];
          if (!queueRows.length)
            return Response.json({ deliveries: [] satisfies unknown[] });

          const itemIds = queueRows.map((row) => row.order_item_id);
          const { data: items, error: itemError } = await admin
            .from("order_items")
            .select("id,order_id,name,quantity,delivery_commands")
            .in("id", itemIds);
          if (itemError) throw itemError;
          const itemRows = (items ?? []) as OrderItemRow[];
          const orderIds = [...new Set(itemRows.map((item) => item.order_id))];
          const { data: orders, error: orderError } = await admin
            .from("orders")
            .select("id,status,minecraft_username")
            .in("id", orderIds);
          if (orderError) throw orderError;
          const orderRows = (orders ?? []) as OrderRow[];
          const itemsById = new Map(itemRows.map((item) => [item.id, item]));
          const ordersById = new Map(
            orderRows.map((order) => [order.id, order]),
          );
          const deliveries = [];

          for (const queueRow of queueRows) {
            const item = itemsById.get(queueRow.order_item_id);
            const order = item ? ordersById.get(item.order_id) : undefined;
            if (
              !item ||
              !order ||
              order.status !== "paid" ||
              order.minecraft_username.toLowerCase() !== username.toLowerCase()
            ) {
              continue;
            }

            const { data: claimed, error: claimError } = await admin
              .from("fulfillment_queue")
              .update({
                status: "processing",
                attempts: queueRow.attempts + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", queueRow.id)
              .eq("status", "queued")
              .select("id")
              .maybeSingle();
            if (claimError) throw claimError;
            if (!claimed) continue;
            let commands: string[];
            try {
              commands = expandDeliveryCommands(item.delivery_commands, {
                player: username,
                quantity: item.quantity,
                orderId: order.id,
                itemId: item.id,
              });
            } catch (commandError) {
              const detail =
                commandError instanceof Error
                  ? commandError.message
                  : "Product delivery commands are invalid.";
              const { error: rejectError } = await admin
                .from("fulfillment_queue")
                .update({
                  status: "failed",
                  last_error: detail,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", queueRow.id)
                .eq("status", "processing");
              if (rejectError) throw rejectError;
              continue;
            }
            deliveries.push({
              queueId: queueRow.id,
              orderItemId: item.id,
              orderId: order.id,
              productName: item.name,
              quantity: item.quantity,
              commands,
            });
          }

          return Response.json({ deliveries });
        } catch (error) {
          if (error instanceof Response) return error;
          console.error("Minecraft reward claim failed", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Could not claim Minecraft rewards.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
