import { createFileRoute } from "@tanstack/react-router";
import {
  getGameDeliveryClient,
  parseDeliveryCompletion,
} from "@/lib/game-delivery.server";

export const Route = createFileRoute("/api/game/complete")({
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
          const result = parseDeliveryCompletion(body);
          const { data: queueRow, error: queueError } = await admin
            .from("fulfillment_queue")
            .select("id,order_item_id,status")
            .eq("id", result.queueId)
            .eq("status", "processing")
            .maybeSingle();
          if (queueError) throw queueError;
          if (!queueRow)
            return Response.json(
              {
                error: "Delivery was not claimed or was already acknowledged.",
              },
              { status: 409 },
            );

          const { data: item, error: itemError } = await admin
            .from("order_items")
            .select("order_id")
            .eq("id", queueRow.order_item_id)
            .single();
          if (itemError) throw itemError;

          const { error: updateError } = await admin
            .from("fulfillment_queue")
            .update({
              status: result.success ? "delivered" : "failed",
              last_error: result.success ? null : result.error,
              updated_at: new Date().toISOString(),
            })
            .eq("id", result.queueId)
            .eq("status", "processing");
          if (updateError) throw updateError;

          if (!result.success) return Response.json({ completed: false });

          const { data: orderItems, error: orderItemsError } = await admin
            .from("order_items")
            .select("id")
            .eq("order_id", item.order_id);
          if (orderItemsError) throw orderItemsError;
          const orderItemIds = (orderItems ?? []).map(
            (orderItem) => orderItem.id,
          );
          const { data: queueRows, error: statusError } = orderItemIds.length
            ? await admin
                .from("fulfillment_queue")
                .select("status")
                .in("order_item_id", orderItemIds)
            : { data: [], error: null };
          if (statusError) throw statusError;
          if (
            orderItemIds.length > 0 &&
            queueRows?.length === orderItemIds.length &&
            queueRows.every((row) => row.status === "delivered")
          ) {
            const { data: completedOrder, error: completionError } = await admin
              .from("orders")
              .update({ status: "completed" })
              .eq("id", item.order_id)
              .eq("status", "paid")
              .select("id")
              .maybeSingle();
            if (completionError) throw completionError;
            if (completedOrder) {
              const { error: eventError } = await admin
                .from("order_status_events")
                .insert({
                  order_id: item.order_id,
                  previous_status: "paid",
                  new_status: "completed",
                  changed_by: null,
                  change_source: "minecraft_delivery",
                });
              if (eventError) throw eventError;
            }
          }

          return Response.json({ completed: true });
        } catch (error) {
          if (error instanceof Response) return error;
          console.error("Minecraft reward acknowledgement failed", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Could not record Minecraft reward delivery.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
