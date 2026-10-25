const UPI_VPA_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/;

export function isValidUpiVpa(value: string) {
  return UPI_VPA_PATTERN.test(value);
}

export function buildUpiPaymentUri(input: {
  vpa: string;
  amountPaise: number;
  orderId: string;
}) {
  if (!isValidUpiVpa(input.vpa))
    throw new Error("The merchant UPI ID is not valid.");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise < 1)
    throw new Error("The payment amount is not valid.");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.orderId,
    )
  ) {
    throw new Error("The order ID is not valid.");
  }

  const parameters = new URLSearchParams({
    pa: input.vpa,
    pn: "Craft SMP",
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `Craft SMP order ${input.orderId}`,
    tr: input.orderId.replace(/-/g, ""),
  });

  return `upi://pay?${parameters.toString()}`;
}
