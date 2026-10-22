import { describe, expect, it } from "vitest";
import { parseFamAppNotification } from "./gmail";

describe("FamApp payment email evidence parser", () => {
  const headers = [
    { name: "From", value: "FamApp <notify@example.test>" },
    {
      name: "Authentication-Results",
      value: "mx.google.com; dkim=pass header.d=example.test; spf=pass",
    },
  ];

  it("extracts the labeled received amount and transaction evidence", () => {
    const candidate = parseFamAppNotification({
      headers,
      receivedAt: "2026-10-22T12:00:00.000Z",
      body: [
        "Hey Test Customer,",
        "You have successfully received",
        "₹125.50",
        "Transaction ID: TEST-TXN-012345",
        "Date: 12:00 PM IST",
        "UTR: 123456789012",
      ].join("\n"),
      configuredSender: "notify@example.test",
      configuredDkimDomain: "example.test",
    });

    expect(candidate.sender).toBe("notify@example.test");
    expect(candidate.amountPaise).toBe(12550);
    expect(candidate.currency).toBe("INR");
    expect(candidate.transactionId).toBe("TEST-TXN-012345");
    expect(candidate.utr).toBe("123456789012");
    expect(candidate.dkimPass).toBe(true);
    expect(candidate.paymentStatus).toBe("received");
    expect(candidate.reviewReason).toContain("evidence only");
  });

  it("leaves mismatched, unauthenticated and unstructured emails ambiguous", () => {
    const candidate = parseFamAppNotification({
      headers: [{ name: "From", value: "attacker@example.test" }],
      receivedAt: null,
      body: "₹100 received",
      configuredSender: "notify@example.test",
      configuredDkimDomain: "example.test",
    });

    expect(candidate.dkimPass).toBe(false);
    expect(candidate.paymentStatus).toBe("ambiguous");
    expect(candidate.amountPaise).toBeNull();
    expect(candidate.reviewReason).toContain("Sender did not match");
    expect(candidate.reviewReason).toContain("DKIM");
  });

  it("does not accept a later duplicate authentication header", () => {
    const candidate = parseFamAppNotification({
      headers: [
        { name: "From", value: "notify@example.test" },
        {
          name: "Authentication-Results",
          value: "mx.google.com; dkim=fail header.d=example.test",
        },
        {
          name: "Authentication-Results",
          value: "mx.google.com; dkim=pass header.d=example.test",
        },
      ],
      receivedAt: null,
      body: "You have successfully received ₹50.00, UTR: 123456789",
      configuredSender: "notify@example.test",
      configuredDkimDomain: "example.test",
    });

    expect(candidate.dkimPass).toBe(false);
  });

  it("does not choose an order by amount alone", () => {
    const candidate = parseFamAppNotification({
      headers,
      receivedAt: null,
      body: "You have successfully received ₹50.00",
      configuredSender: "notify@example.test",
      configuredDkimDomain: "example.test",
    });

    expect(candidate.orderIdHint).toBeNull();
    expect(candidate.reviewReason).toContain("No transaction ID");
    expect(candidate.paymentStatus).toBe("received");
  });
});
