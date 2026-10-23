import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isValidMinecraftName } from "@/lib/minecraft";

const orderInput = z.object({
  accessToken: z.string().min(1),
  minecraftUsername: z
    .string()
    .refine(isValidMinecraftName, "Enter a valid Minecraft username."),
  items: z
    .array(
      z.object({
        productId: z.string().min(2).max(64),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  discountCode: z.string().max(32).optional(),
});

const orderLookupInput = z.object({
  accessToken: z.string().min(1),
  orderId: z.string().uuid(),
});

export type CreateUpiCheckoutOrderInput = z.infer<typeof orderInput>;
export type GetUpiOrderDetailsInput = z.infer<typeof orderLookupInput>;

export const createUpiCheckoutOrder = createServerFn({ method: "POST" })
  .validator(orderInput)
  .handler(async ({ data }) => {
    const { createUpiCheckoutOrderImpl } = await import("./payments.server");
    return createUpiCheckoutOrderImpl(data);
  });

export const getUpiOrderDetails = createServerFn({ method: "POST" })
  .validator(orderLookupInput)
  .handler(async ({ data }) => {
    const { getUpiOrderDetailsImpl } = await import("./payments.server");
    return getUpiOrderDetailsImpl(data);
  });
