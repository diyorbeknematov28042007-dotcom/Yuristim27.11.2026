import { SELF } from "cloudflare:test";
import {
  generateTotpCode,
  toBase64Url,
  utf8,
  verifyTelegramOidcIdToken,
  verifyTotpCode,
} from "@yuristim/security";
import { describe, expect, it } from "vitest";
import { createBotSession, signedMiniAppData } from "../helpers/auth";

describe("authentication security controls", () => {
  it("enforces double-submit CSRF for cookie-authenticated mutations", async () => {
    const initData = await signedMiniAppData(820000001);
    const login = await SELF.fetch("https://example.test/api/v1/auth/telegram/mini-app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get("set-cookie") ?? "";
    const session = setCookie.match(/__Host-yuristim_session=([^;,]+)/u)?.[1];
    const csrf = setCookie.match(/__Host-yuristim_csrf=([^;,]+)/u)?.[1];
    expect(session).toBeTypeOf("string");
    expect(csrf).toBeTypeOf("string");
    const cookie = `__Host-yuristim_session=${session}; __Host-yuristim_csrf=${csrf}`;

    const missing = await SELF.fetch("https://example.test/api/v1/account/profile", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ locale: "en" }),
    });
    expect(missing.status).toBe(403);

    const valid = await SELF.fetch("https://example.test/api/v1/account/profile", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json", "x-csrf-token": csrf ?? "" },
      body: JSON.stringify({ locale: "en" }),
    });
    expect(valid.status).toBe(200);
  });

  it("default-denies non-admin users from admin authentication", async () => {
    const { accessToken } = await createBotSession(SELF, "820000002");
    const response = await SELF.fetch("https://example.test/api/v1/admin/auth/totp/setup", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("accepts a TOTP only once per time step", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const step = Math.floor(Date.now() / 30_000);
    const code = await generateTotpCode(secret, step);
    await expect(verifyTotpCode({ secret, code, now: new Date(step * 30_000) })).resolves.toBe(
      step,
    );
    await expect(
      verifyTotpCode({ secret, code, now: new Date(step * 30_000), lastUsedStep: step }),
    ).resolves.toBeNull();
  });

  it("requires an owner role and TOTP before exposing admin context", async () => {
    const { accessToken } = await createBotSession(SELF, "900000001");
    const headers = { authorization: `Bearer ${accessToken}`, "content-type": "application/json" };
    const beforeTotp = await SELF.fetch("https://example.test/api/v1/admin/auth/context", {
      headers,
    });
    expect(beforeTotp.status).toBe(403);

    const setup = await SELF.fetch("https://example.test/api/v1/admin/auth/totp/setup", {
      method: "POST",
      headers,
    });
    expect(setup.status).toBe(201);
    const setupBody = await setup.json<{ data: { secret: string } }>();
    const step = Math.floor(Date.now() / 30_000);
    const code = await generateTotpCode(setupBody.data.secret, step);
    const confirm = await SELF.fetch("https://example.test/api/v1/admin/auth/totp/confirm", {
      method: "POST",
      headers,
      body: JSON.stringify({ code }),
    });
    expect(confirm.status).toBe(200);

    const context = await SELF.fetch("https://example.test/api/v1/admin/auth/context", { headers });
    expect(context.status).toBe(200);
    const contextBody = await context.json<{
      success: boolean;
      data: { roles: string[]; permissions: string[] };
    }>();
    expect(contextBody.success).toBe(true);
    expect(contextBody.data.roles).toContain("owner");
    expect(contextBody.data.permissions).toEqual(["admin:*"]);
  });

  it("verifies Telegram OIDC RS256 signature, audience, issuer and nonce", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const now = Math.floor(Date.now() / 1_000);
    const header = toBase64Url(utf8(JSON.stringify({ alg: "RS256", kid: "telegram-test" })));
    const payload = toBase64Url(
      utf8(
        JSON.stringify({
          iss: "https://oauth.telegram.org",
          aud: "synthetic-oidc-client",
          sub: "820000003",
          iat: now,
          exp: now + 300,
          nonce: "synthetic-nonce",
          name: "OIDC User",
        }),
      ),
    );
    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keyPair.privateKey,
      Uint8Array.from(utf8(signingInput)).buffer,
    );
    const token = `${signingInput}.${toBase64Url(signature)}`;
    await expect(
      verifyTelegramOidcIdToken({
        idToken: token,
        jwks: { keys: [{ ...publicJwk, kid: "telegram-test" }] },
        clientId: "synthetic-oidc-client",
        nonce: "synthetic-nonce",
        now: new Date(now * 1_000),
      }),
    ).resolves.toMatchObject({ telegramUserId: "820000003", displayName: "OIDC User" });
    await expect(
      verifyTelegramOidcIdToken({
        idToken: token,
        jwks: { keys: [{ ...publicJwk, kid: "telegram-test" }] },
        clientId: "synthetic-oidc-client",
        nonce: "wrong-nonce",
        now: new Date(now * 1_000),
      }),
    ).rejects.toThrow(/claims/);
  });
});
