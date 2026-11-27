import { hmac, signTelegramMiniAppTestData, toHex } from "@yuristim/security";

export const testBotToken = "synthetic-telegram-bot-token-for-tests-only";
export const testBotAdapterSecret = "synthetic-bot-adapter-secret-for-tests-only";

export const signedBotRequest = async (
  path: string,
  payload: Record<string, unknown>,
): Promise<Request> => {
  const body = JSON.stringify({ ...payload, deviceName: `test-${crypto.randomUUID()}` });
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const signature = toHex(await hmac("SHA-256", testBotAdapterSecret, `${timestamp}.${body}`));
  return new Request(`https://example.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-yuristim-bot-timestamp": timestamp,
      "x-yuristim-bot-signature": signature,
    },
    body,
  });
};

export const createBotSession = async (
  fetcher: Fetcher,
  telegramUserId: string,
): Promise<{ accessToken: string; accountId: string }> => {
  const response = await fetcher.fetch(
    await signedBotRequest("/api/v1/auth/telegram/bot/session", {
      telegramUserId,
      displayName: "Synthetic User",
      username: `synthetic_${telegramUserId}`,
      languageCode: "uz",
    }),
  );
  if (response.status !== 200) throw new Error(`Bot login failed: ${await response.text()}`);
  const payload = await response.json<{
    data: { accessToken: string; accountId: string };
  }>();
  return payload.data;
};

export const signedMiniAppData = async (telegramUserId: number): Promise<string> => {
  const parameters = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1_000)),
    query_id: crypto.randomUUID(),
    user: JSON.stringify({
      id: telegramUserId,
      first_name: "Synthetic",
      last_name: "User",
      username: `synthetic_${telegramUserId}`,
      language_code: "uz",
    }),
  });
  return signTelegramMiniAppTestData(parameters, testBotToken);
};

export const bearerHeaders = (accessToken: string): HeadersInit => ({
  authorization: `Bearer ${accessToken}`,
  "content-type": "application/json",
});
