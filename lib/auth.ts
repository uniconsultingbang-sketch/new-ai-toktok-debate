export const AUTH_COOKIE_NAME = "new_ai_toktok_session";

export type LoginUser = {
  id: string;
  name: string;
  password: string;
};

export type AuthSession = {
  id: string;
  name: string;
  expiresAt: number;
};

const sessionDays = 7;
const encoder = new TextEncoder();

export function getLoginUsers(): LoginUser[] {
  const raw = process.env.APP_LOGIN_USERS?.trim() ?? "";

  if (!raw) {
    return [];
  }

  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as Array<Partial<LoginUser>>;
      return parsed
        .map((item) => ({
          id: String(item.id ?? "").trim(),
          name: String(item.name ?? item.id ?? "").trim(),
          password: String(item.password ?? "").trim(),
        }))
        .filter((item) => item.id && item.name && item.password);
    } catch {
      return [];
    }
  }

  return raw
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id = "", password = "", name = id] = entry.split(":").map((part) => part.trim());
      return { id, password, name };
    })
    .filter((item) => item.id && item.name && item.password);
}

export function isAuthConfigured() {
  return getLoginUsers().length > 0;
}

export function getSessionMaxAge() {
  return sessionDays * 24 * 60 * 60;
}

export function createSession(user: LoginUser): AuthSession {
  return {
    id: user.id,
    name: user.name,
    expiresAt: Date.now() + getSessionMaxAge() * 1000,
  };
}

export async function createSessionToken(session: AuthSession) {
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = await signValue(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<AuthSession | null> {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");
  const expected = await signValue(payload);

  if (!payload || !signature || !timingSafeEqual(signature, expected)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AuthSession;

    if (!session.id || !session.name || !session.expiresAt || session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

async function signValue(value: string) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function getAuthSecret() {
  return process.env.AUTH_SECRET || "local-development-auth-secret";
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(encoder.encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = `${value.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}
