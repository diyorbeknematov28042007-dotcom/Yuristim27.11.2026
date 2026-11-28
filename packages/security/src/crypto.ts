import { AppError } from "@yuristim/errors";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8 = (value: string): Uint8Array => encoder.encode(value);
export const decodeUtf8 = (value: ArrayBuffer | Uint8Array): string => decoder.decode(value);

// TypeScript's Web Crypto declarations reject views backed by SharedArrayBuffer even though
// TextEncoder and Uint8Array values are ordinary ArrayBuffers at runtime. Copying at this
// boundary keeps every cryptographic input unambiguously owned and transferable.
export const asArrayBuffer = (value: Uint8Array): ArrayBuffer => Uint8Array.from(value).buffer;

export const toHex = (value: ArrayBuffer | Uint8Array): string =>
  [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const fromHex = (value: string): Uint8Array => {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new AppError("VALIDATION_ERROR", "Invalid hexadecimal value");
  }
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
};

export const toBase64Url = (value: ArrayBuffer | Uint8Array): string => {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

export const fromBase64Url = (value: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]*$/u.test(value)) {
    throw new AppError("VALIDATION_ERROR", "Invalid base64url value");
  }
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const sha256 = (value: string | Uint8Array): Promise<ArrayBuffer> =>
  crypto.subtle.digest("SHA-256", asArrayBuffer(typeof value === "string" ? utf8(value) : value));

export const sha256Hex = async (value: string | Uint8Array): Promise<string> =>
  toHex(await sha256(value));

export const hmac = async (
  algorithm: "SHA-1" | "SHA-256",
  key: string | Uint8Array,
  value: string | Uint8Array,
): Promise<ArrayBuffer> => {
  const imported = await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(typeof key === "string" ? utf8(key) : key),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return crypto.subtle.sign(
    "HMAC",
    imported,
    asArrayBuffer(typeof value === "string" ? utf8(value) : value),
  );
};

export const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  const maximum = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maximum; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
};

export const randomToken = (byteLength = 32): string => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
};

const encryptionKey = async (encodedKey: string): Promise<CryptoKey> => {
  const bytes = fromBase64Url(encodedKey);
  if (bytes.byteLength !== 32) {
    throw new AppError("SERVICE_UNAVAILABLE", "Authentication encryption key is invalid");
  }
  return crypto.subtle.importKey("raw", asArrayBuffer(bytes), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
};

export const encryptJson = async (value: unknown, encodedKey: string): Promise<string> => {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    await encryptionKey(encodedKey),
    asArrayBuffer(utf8(JSON.stringify(value))),
  );
  return `${toBase64Url(iv)}.${toBase64Url(encrypted)}`;
};

export const decryptJson = async <T>(ciphertext: string, encodedKey: string): Promise<T> => {
  const [ivValue, encryptedValue, extra] = ciphertext.split(".");
  if (ivValue === undefined || encryptedValue === undefined || extra !== undefined) {
    throw new AppError("UNAUTHORIZED", "Invalid encrypted challenge");
  }
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(fromBase64Url(ivValue)) },
      await encryptionKey(encodedKey),
      asArrayBuffer(fromBase64Url(encryptedValue)),
    );
    return JSON.parse(decodeUtf8(decrypted)) as T;
  } catch (cause) {
    throw new AppError("UNAUTHORIZED", "Invalid encrypted challenge", { cause });
  }
};
