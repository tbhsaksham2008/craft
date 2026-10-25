import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const scanInput = z.object({ accessToken: z.string().min(1) });
const checkoutScanInput = z.object({
  accessToken: z.string().min(1),
  orderId: z.string().uuid(),
});

export const scanGmailPaymentNotifications = createServerFn({
  method: "POST",
})
  .validator(scanInput)
  .handler(async ({ data }) => {
    const { scanGmailForAdmin } = await import("./gmail-payments.server");
    return scanGmailForAdmin(data.accessToken);
  });

export const scanGmailForCheckoutOrder = createServerFn({ method: "POST" })
  .validator(checkoutScanInput)
  .handler(async ({ data }) => {
    const { scanGmailForCheckoutOrder } =
      await import("./gmail-payments.server");
    return scanGmailForCheckoutOrder(data.accessToken, data.orderId);
  });
