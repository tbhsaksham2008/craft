import { describe, expect, it } from "vitest";
import { buildUpiPaymentUri, isValidUpiVpa } from "./upi";

describe("UPI payment requests", () => {
  it("builds an exact INR intent for the server-created order", () => {
    const uri = buildUpiPaymentUri({
      vpa: "craftshop@okaxis",
      amountPaise: 12345,
      orderId: "6e4f70e6-9ea5-4cbb-9bbc-35db0de8b7f5",
    });
    const parameters = new URLSearchParams(uri.split("?")[1]);

    expect(uri).toMatch(/^upi:\/\/pay\?/);
    expect(parameters.get("pa")).toBe("craftshop@okaxis");
    expect(parameters.get("am")).toBe("123.45");
    expect(parameters.get("cu")).toBe("INR");
    expect(parameters.get("tn")).toContain(
      "6e4f70e6-9ea5-4cbb-9bbc-35db0de8b7f5",
    );
    expect(parameters.get("tr")).toBe("6e4f70e69ea54cbb9bbc35db0de8b7f5");
  });

  it("rejects invalid merchant IDs and unsafe amounts", () => {
    expect(isValidUpiVpa("merchant@bank")).toBe(true);
    expect(isValidUpiVpa("not-a-vpa")).toBe(false);
    expect(() =>
      buildUpiPaymentUri({
        vpa: "not-a-vpa",
        amountPaise: 100,
        orderId: "6e4f70e6-9ea5-4cbb-9bbc-35db0de8b7f5",
      }),
    ).toThrow("merchant UPI ID");
    expect(() =>
      buildUpiPaymentUri({
        vpa: "craftshop@okaxis",
        amountPaise: 1.5,
        orderId: "6e4f70e6-9ea5-4cbb-9bbc-35db0de8b7f5",
      }),
    ).toThrow("payment amount");
  });
});
