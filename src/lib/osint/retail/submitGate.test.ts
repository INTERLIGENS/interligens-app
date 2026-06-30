/**
 * Tests du CERVEAU de la porte (pur). Couvre tous les scénarios du sprint C1 au
 * niveau décision : kill switch, Turnstile, rate-limit, quota, dédup, précheck,
 * budget, agrégation de batch.
 */
import { describe, it, expect } from "vitest";
import {
  evaluateSubmitGate,
  classifyImageOutcome,
  aggregateBatchStatus,
} from "./submitGate";
import { SubmissionStatus, RejectReason } from "../contracts";
import { MAX_SUBMITS_PER_IP_PER_DAY, MAX_IMAGES_PER_SUBMIT } from "./retailConfig";

const okGate = {
  submitEnabled: true,
  turnstileConfigured: true,
  turnstileOk: true,
  ipSubmitCountLast24h: 0,
  imageCount: 1,
  anyImageOversize: false,
};

describe("evaluateSubmitGate", () => {
  it("kill switch OFF → 403 submissions_closed, no accept", () => {
    const d = evaluateSubmitGate({ ...okGate, submitEnabled: false });
    expect(d.accept).toBe(false);
    expect(d.httpStatus).toBe(403);
    expect(d.errorCode).toBe("submissions_closed");
  });

  it("Turnstile configured + invalid → 403 turnstile_failed", () => {
    const d = evaluateSubmitGate({ ...okGate, turnstileOk: false });
    expect(d.accept).toBe(false);
    expect(d.httpStatus).toBe(403);
    expect(d.errorCode).toBe("turnstile_failed");
  });

  it("Turnstile NOT configured → not blocking", () => {
    const d = evaluateSubmitGate({ ...okGate, turnstileConfigured: false, turnstileOk: false });
    expect(d.accept).toBe(true);
  });

  it("rate-limit reached → 429", () => {
    const d = evaluateSubmitGate({ ...okGate, ipSubmitCountLast24h: MAX_SUBMITS_PER_IP_PER_DAY });
    expect(d.accept).toBe(false);
    expect(d.httpStatus).toBe(429);
    expect(d.errorCode).toBe("rate_limited");
  });

  it("zero images → 400 no_image", () => {
    const d = evaluateSubmitGate({ ...okGate, imageCount: 0 });
    expect(d.accept).toBe(false);
    expect(d.httpStatus).toBe(400);
    expect(d.errorCode).toBe("no_image");
  });

  it("too many images → 400 too_many_images", () => {
    const d = evaluateSubmitGate({ ...okGate, imageCount: MAX_IMAGES_PER_SUBMIT + 1 });
    expect(d.accept).toBe(false);
    expect(d.errorCode).toBe("too_many_images");
  });

  it("oversize image → 413", () => {
    const d = evaluateSubmitGate({ ...okGate, anyImageOversize: true });
    expect(d.accept).toBe(false);
    expect(d.httpStatus).toBe(413);
  });

  it("valid → 202 accept", () => {
    const d = evaluateSubmitGate(okGate);
    expect(d.accept).toBe(true);
    expect(d.httpStatus).toBe(202);
  });

  it("order: kill switch wins over everything", () => {
    const d = evaluateSubmitGate({
      submitEnabled: false,
      turnstileConfigured: true,
      turnstileOk: false,
      ipSubmitCountLast24h: 999,
      imageCount: 99,
      anyImageOversize: true,
    });
    expect(d.errorCode).toBe("submissions_closed");
  });
});

describe("classifyImageOutcome", () => {
  it("duplicate → DUPLICATE, zero vision", () => {
    const o = classifyImageOutcome({ isDuplicate: true, precheckOk: true, precheckRejectReason: null, budgetExceeded: false });
    expect(o.status).toBe(SubmissionStatus.DUPLICATE);
    expect(o.willConsumeVision).toBe(false);
  });

  it("precheck fail → PRECHECK_REJECTED with reason", () => {
    const o = classifyImageOutcome({ isDuplicate: false, precheckOk: false, precheckRejectReason: RejectReason.BAD_FORMAT, budgetExceeded: false });
    expect(o.status).toBe(SubmissionStatus.PRECHECK_REJECTED);
    expect(o.rejectReason).toBe(RejectReason.BAD_FORMAT);
    expect(o.willConsumeVision).toBe(false);
  });

  it("budget exceeded → QUEUED_BUDGET_CAPPED, zero vision now", () => {
    const o = classifyImageOutcome({ isDuplicate: false, precheckOk: true, precheckRejectReason: null, budgetExceeded: true });
    expect(o.status).toBe(SubmissionStatus.QUEUED_BUDGET_CAPPED);
    expect(o.willConsumeVision).toBe(false);
  });

  it("clean → QUEUED, will consume vision", () => {
    const o = classifyImageOutcome({ isDuplicate: false, precheckOk: true, precheckRejectReason: null, budgetExceeded: false });
    expect(o.status).toBe(SubmissionStatus.QUEUED);
    expect(o.willConsumeVision).toBe(true);
  });

  it("precedence: duplicate beats precheck-fail and budget", () => {
    const o = classifyImageOutcome({ isDuplicate: true, precheckOk: false, precheckRejectReason: RejectReason.TOO_SMALL, budgetExceeded: true });
    expect(o.status).toBe(SubmissionStatus.DUPLICATE);
  });
});

describe("aggregateBatchStatus", () => {
  it("surfaces the most advanced status of the batch", () => {
    expect(
      aggregateBatchStatus([SubmissionStatus.PRECHECK_REJECTED, SubmissionStatus.QUEUED, SubmissionStatus.DUPLICATE]),
    ).toBe(SubmissionStatus.QUEUED);
  });
  it("committed beats queued", () => {
    expect(
      aggregateBatchStatus([SubmissionStatus.QUEUED, SubmissionStatus.AUTO_COMMITTED_SHADOW]),
    ).toBe(SubmissionStatus.AUTO_COMMITTED_SHADOW);
  });
  it("all rejected → PRECHECK_REJECTED", () => {
    expect(aggregateBatchStatus([SubmissionStatus.PRECHECK_REJECTED])).toBe(SubmissionStatus.PRECHECK_REJECTED);
  });
});
