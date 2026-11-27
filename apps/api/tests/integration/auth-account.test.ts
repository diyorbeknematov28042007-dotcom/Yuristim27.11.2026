import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  bearerHeaders,
  createBotSession,
  signedBotRequest,
  signedMiniAppData,
} from "../helpers/auth";

const dataOf = async <T>(response: Response): Promise<T> => {
  const body = await response.json<{ data: T }>();
  return body.data;
};

describe("Telegram-only authentication and unified account", () => {
  it("creates one account for bot and Mini App identities and rejects replay", async () => {
    const telegramUserId = 810000001;
    const botSession = await createBotSession(SELF, String(telegramUserId));
    const initData = await signedMiniAppData(telegramUserId);
    const request = () =>
      SELF.fetch("https://example.test/api/v1/auth/telegram/mini-app", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, deviceName: "Synthetic Mini App" }),
      });
    const miniResponse = await request();
    expect(miniResponse.status).toBe(200);
    expect(await dataOf<{ accountId: string }>(miniResponse)).toMatchObject({
      accountId: botSession.accountId,
    });

    const replay = await request();
    expect(replay.status).toBe(401);
    expect(await replay.json()).toMatchObject({
      success: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects tampered and expired Mini App initData", async () => {
    const valid = await signedMiniAppData(810000002);
    const tampered = valid.replace("Synthetic", "Changed");
    const tamperedResponse = await SELF.fetch(
      "https://example.test/api/v1/auth/telegram/mini-app",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: tampered }),
      },
    );
    expect(tamperedResponse.status).toBe(401);

    const expiredParameters = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1_000) - 3_600),
      query_id: crypto.randomUUID(),
      user: JSON.stringify({ id: 810000003, first_name: "Expired" }),
    });
    const { signTelegramMiniAppTestData } = await import("@yuristim/security");
    const expired = await signTelegramMiniAppTestData(
      expiredParameters,
      "synthetic-telegram-bot-token-for-tests-only",
    );
    const expiredResponse = await SELF.fetch("https://example.test/api/v1/auth/telegram/mini-app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: expired }),
    });
    expect(expiredResponse.status).toBe(401);
  });

  it("supports onboarding, profile, consent, sessions and Stage 05 contract", async () => {
    const { accessToken, accountId } = await createBotSession(SELF, "810000004");
    const headers = bearerHeaders(accessToken);

    const onboarding = await SELF.fetch("https://example.test/api/v1/account/onboarding", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ displayName: "Dilshod" }),
    });
    expect(onboarding.status).toBe(200);
    expect(await dataOf(onboarding)).toMatchObject({
      displayName: "Dilshod",
      onboardingCompleted: true,
    });

    const profile = await SELF.fetch("https://example.test/api/v1/account/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ locale: "ru", notificationsEnabled: false }),
    });
    expect(profile.status).toBe(200);
    expect(await dataOf(profile)).toMatchObject({ locale: "ru", notificationsEnabled: false });

    const consent = await SELF.fetch("https://example.test/api/v1/account/consents", {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "privacy", version: "2026-11", granted: true }),
    });
    expect(consent.status).toBe(201);

    const sessions = await SELF.fetch("https://example.test/api/v1/account/sessions", { headers });
    expect(sessions.status).toBe(200);
    expect((await dataOf<{ sessions: unknown[] }>(sessions)).sessions).toBeInstanceOf(Array);

    const financial = await SELF.fetch("https://example.test/api/v1/account/financial-context", {
      headers,
    });
    expect(financial.status).toBe(200);
    expect(await dataOf(financial)).toEqual({
      accountId,
      status: "active",
      eligibleForLedger: true,
    });
  });

  it("issues and consumes a one-time Telegram recovery challenge", async () => {
    await createBotSession(SELF, "810000005");
    const issue = await SELF.fetch(
      await signedBotRequest("/api/v1/auth/recovery/telegram/issue", {
        telegramUserId: "810000005",
      }),
    );
    expect(issue.status).toBe(200);
    const { recoveryCode } = await dataOf<{ recoveryCode: string }>(issue);

    const recover = () =>
      SELF.fetch("https://example.test/api/v1/auth/recovery/telegram/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recoveryCode, deviceName: "Recovered browser" }),
      });
    expect((await recover()).status).toBe(200);
    expect((await recover()).status).toBe(401);
  });

  it("fails closed for an invalid bot adapter signature", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/auth/telegram/bot/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-yuristim-bot-timestamp": String(Math.floor(Date.now() / 1_000)),
        "x-yuristim-bot-signature": "0".repeat(64),
      },
      body: JSON.stringify({ telegramUserId: "810000006" }),
    });
    expect(response.status).toBe(401);
  });

  it("starts web Telegram OIDC with PKCE, nonce, state and a secure state cookie", async () => {
    const response = await SELF.fetch("https://example.test/api/v1/auth/web/start", {
      method: "POST",
    });
    expect(response.status).toBe(200);
    const body = await response.json<{ data: { authorizationUrl: string; expiresAt: string } }>();
    const url = new URL(body.data.authorizationUrl);
    expect(url.origin).toBe("https://oauth.telegram.org");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(response.headers.get("set-cookie")).toMatch(
      /__Host-yuristim_login_state=.*Secure.*HttpOnly.*SameSite=Lax/u,
    );
  });

  it("supports export foundation and disables an account on deletion request", async () => {
    const { accessToken } = await createBotSession(SELF, "810000007");
    const headers = bearerHeaders(accessToken);
    const exported = await SELF.fetch("https://example.test/api/v1/account/export", {
      method: "POST",
      headers,
    });
    expect(exported.status).toBe(202);
    expect(await dataOf(exported)).toMatchObject({
      status: "blocked_storage",
      executionEnabled: false,
    });

    const deletion = await SELF.fetch("https://example.test/api/v1/account/deletion", {
      method: "POST",
      headers,
      body: JSON.stringify({ confirmation: "DELETE" }),
    });
    expect(deletion.status).toBe(202);
    expect(await dataOf(deletion)).toMatchObject({
      accountDisabled: true,
      irreversibleExecutionEnabled: false,
    });
    const afterDeletion = await SELF.fetch("https://example.test/api/v1/account", { headers });
    expect(afterDeletion.status).toBe(401);
  });
});
