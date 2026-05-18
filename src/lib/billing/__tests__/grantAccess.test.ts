import { describe, it, expect, beforeEach, vi } from "vitest";

const { sendAccessCodeEmailMock } = vi.hoisted(() => ({
  sendAccessCodeEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { investigatorAccess: { create: vi.fn() } },
}));

vi.mock("@/lib/email/accessCodeDelivery", () => ({
  sendAccessCodeEmail: sendAccessCodeEmailMock,
}));

import { prisma } from "@/lib/prisma";
import { provisionBetaFounderAccess } from "../grantAccess";

const createMock = prisma.investigatorAccess.create as unknown as ReturnType<typeof vi.fn>;

describe("provisionBetaFounderAccess", () => {
  beforeEach(() => {
    createMock.mockReset();
    sendAccessCodeEmailMock.mockReset();
  });

  it("creates an InvestigatorAccess and sends the access code email by default", async () => {
    createMock.mockResolvedValue({ id: "acc_1", label: "BF-deadbeef" });
    sendAccessCodeEmailMock.mockResolvedValue({ delivered: true });
    const res = await provisionBetaFounderAccess({
      email: "Buyer@example.com",
      stripeCheckoutSessionId: "cs_deadbeef",
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data: { label: string; accessCodeHash: string } };
    expect(arg.data.label).toMatch(/^BF-/);
    expect(arg.data.accessCodeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sendAccessCodeEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "buyer@example.com" }),
    );
    expect(res.investigatorAccessId).toBe("acc_1");
    expect(res.emailDelivered).toBe(true);
  });

  it("skips email when sendEmail=false (used by tests)", async () => {
    createMock.mockResolvedValue({ id: "acc_2", label: "x" });
    const res = await provisionBetaFounderAccess({
      email: "x@y.com",
      stripeCheckoutSessionId: "cs_x",
      sendEmail: false,
    });
    expect(sendAccessCodeEmailMock).not.toHaveBeenCalled();
    expect(res.emailDelivered).toBe("skipped");
  });

  it("returns delivered=false with error when Resend fails", async () => {
    createMock.mockResolvedValue({ id: "acc_3", label: "x" });
    sendAccessCodeEmailMock.mockResolvedValue({ delivered: false, error: "rate_limited" });
    const res = await provisionBetaFounderAccess({
      email: "z@y.com",
      stripeCheckoutSessionId: "cs_x",
    });
    expect(res.emailDelivered).toBe(false);
    expect(res.emailError).toBe("rate_limited");
  });
});
