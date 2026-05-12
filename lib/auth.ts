export const AUTH_COOKIE_NAME = "new_ai_toktok_session";

export type LoginUser = {
  id: string;
  name: string;
  password: string;
};

export type AuthSession = {
  id: string;
  name: string;
  sessionId: string;
  expiresAt: number;
};

type SupabaseRestConfig = {
  url: string;
  key: string;
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
    sessionId: createSessionId(),
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
    const session = JSON.parse(base64UrlDecode(payload)) as Partial<AuthSession>;

    if (
      !session.id ||
      !session.name ||
      !session.sessionId ||
      !session.expiresAt ||
      session.expiresAt < Date.now()
    ) {
      return null;
    }

    return {
      id: session.id,
      name: session.name,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    };
  } catch {
    return null;
  }
}

export async function verifyActiveSessionToken(token: string | undefined | null): Promise<AuthSession | null> {
  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  const isCurrent = await isCurrentLoginSession(session);
  return isCurrent ? session : null;
}

export async function registerLoginSession(session: AuthSession) {
  const config = getSupabaseRestConfig();

  if (!config) {
    return false;
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/login_sessions?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: config.key,
        authorization: `Bearer ${config.key}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: session.id,
        user_name: session.name,
        session_id: session.sessionId,
        expires_at: new Date(session.expiresAt).toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function clearLoginSession(session: AuthSession | null) {
  const config = getSupabaseRestConfig();

  if (!config || !session) {
    return;
  }

  try {
    await fetch(
      `${config.url}/rest/v1/login_sessions?user_id=eq.${encodeURIComponent(session.id)}&session_id=eq.${encodeURIComponent(
        session.sessionId,
      )}`,
      {
        method: "DELETE",
        headers: {
          apikey: config.key,
          authorization: `Bearer ${config.key}`,
          prefer: "return=minimal",
        },
      },
    );
  } catch {
    // Logout should still clear the browser cookie even if the server store is unavailable.
  }
}

async function isCurrentLoginSession(session: AuthSession) {
  const config = getSupabaseRestConfig();

  if (!config) {
    return true;
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/login_sessions?user_id=eq.${encodeURIComponent(
        session.id,
      )}&select=session_id,expires_at&limit=1`,
      {
        headers: {
          apikey: config.key,
          authorization: `Bearer ${config.key}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return true;
    }

    const rows = (await response.json()) as Array<{ session_id?: string; expires_at?: string }>;
    const active = rows[0];

    if (!active) {
      return false;
    }

    const expiresAt = active.expires_at ? new Date(active.expires_at).getTime() : 0;
    return active.session_id === session.sessionId && expiresAt >= Date.now();
  } catch {
    return true;
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

function getSupabaseRestConfig(): SupabaseRestConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

function createSessionId() {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
