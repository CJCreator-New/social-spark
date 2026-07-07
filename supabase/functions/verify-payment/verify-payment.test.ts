import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  })),
}));

vi.mock("../_shared/promptHelpers.ts", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getCorsHeaders: vi.fn(() => ({})),
}));

const ENV: Record<string, string> = {
  SUPABASE_URL: "https://dummy.supabase.co",
  SUPABASE_ANON_KEY: "dummy-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-key",
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "rzp_test_secret",
};

vi.stubGlobal("Deno", { env: { get: (key: string) => ENV[key] } });

const { handleVerifyPayment } = await import("./index.ts");

const USER_ID = "a0000000-0000-0000-0000-000000000001";
const OTHER_USER_ID = "b0000000-0000-0000-0000-000000000002";

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildRequest(body: Record<string, unknown>): Request {
  return new Request("https://dummy.supabase.co/functions/v1/verify-payment", {
    method: "POST",
    headers: {
      Authorization: "Bearer dummy-user-jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function mockRazorpayOrderFetch(order: Record<string, unknown>, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => order,
      text: async () => JSON.stringify(order),
    }))
  );
}

describe("verify-payment", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRpc.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mockRpc.mockResolvedValue({
      data: [{ tier: "pro", period_end: "2026-08-01T00:00:00.000Z" }],
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("Deno", { env: { get: (key: string) => ENV[key] } });
  });

  it("rejects a bad signature", async () => {
    mockRazorpayOrderFetch({
      amount: 49900,
      status: "paid",
      notes: { user_id: USER_ID, plan: "pro" },
    });

    const req = buildRequest({
      razorpay_order_id: "order_1",
      razorpay_payment_id: "pay_1",
      razorpay_signature: "not-a-real-signature",
    });

    const res = await handleVerifyPayment(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.verified).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects when the order belongs to a different user", async () => {
    const orderId = "order_2";
    const paymentId = "pay_2";
    const signature = await hmacSha256Hex(`${orderId}|${paymentId}`, ENV.RAZORPAY_KEY_SECRET);

    mockRazorpayOrderFetch({
      amount: 49900,
      status: "paid",
      notes: { user_id: OTHER_USER_ID, plan: "pro" },
    });

    const req = buildRequest({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    const res = await handleVerifyPayment(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.verified).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects when the charged amount does not match the plan price", async () => {
    const orderId = "order_3";
    const paymentId = "pay_3";
    const signature = await hmacSha256Hex(`${orderId}|${paymentId}`, ENV.RAZORPAY_KEY_SECRET);

    mockRazorpayOrderFetch({
      amount: 1, // tampered: should be 49900 for "pro"
      status: "paid",
      notes: { user_id: USER_ID, plan: "pro" },
    });

    const req = buildRequest({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    const res = await handleVerifyPayment(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.verified).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects when the order has no valid plan in its notes", async () => {
    const orderId = "order_4";
    const paymentId = "pay_4";
    const signature = await hmacSha256Hex(`${orderId}|${paymentId}`, ENV.RAZORPAY_KEY_SECRET);

    mockRazorpayOrderFetch({
      amount: 49900,
      status: "paid",
      notes: { user_id: USER_ID, plan: "not-a-real-plan" },
    });

    const req = buildRequest({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    const res = await handleVerifyPayment(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.verified).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rejects requests missing required payment fields", async () => {
    const req = buildRequest({ razorpay_order_id: "order_5" });
    const res = await handleVerifyPayment(req);
    expect(res.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("grants the tier on a fully valid, matching payment", async () => {
    const orderId = "order_6";
    const paymentId = "pay_6";
    const signature = await hmacSha256Hex(`${orderId}|${paymentId}`, ENV.RAZORPAY_KEY_SECRET);

    mockRazorpayOrderFetch({
      amount: 49900,
      status: "paid",
      notes: { user_id: USER_ID, plan: "pro" },
    });

    const req = buildRequest({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    const res = await handleVerifyPayment(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.verified).toBe(true);
    expect(json.granted).toBe(true);
    expect(json.tier).toBe("pro");
    expect(mockRpc).toHaveBeenCalledWith(
      "grant_tier_from_payment",
      expect.objectContaining({
        p_user_id: USER_ID,
        p_tier: "pro",
        p_order_id: orderId,
        p_payment_id: paymentId,
        p_amount: 49900,
      })
    );
  });
});
