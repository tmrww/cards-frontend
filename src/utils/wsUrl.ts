export type WsEnv = Record<string, string | undefined>;

/**
 * Builds the WebSocket URL from Vite env vars.
 * VITE_WS_URL wins outright; otherwise host (required), protocol and port are combined.
 * The port is left out when blank, "none", or the protocol default (443 / 80).
 */
export function buildWebSocketUrl(env: WsEnv, isHttps: boolean): string {
  if (env.VITE_WS_URL) return env.VITE_WS_URL;

  const host = env.VITE_WS_HOST || env.VITE_HOST;
  if (!host) throw new Error("Missing VITE_WS_HOST environment variable.");

  const protocol = env.VITE_WS_PROTOCOL || (isHttps ? "wss:" : "ws:");
  const port = env.VITE_WS_PORT ?? env.VITE_PORT ?? "";
  const defaultPort = protocol === "wss:" ? "443" : protocol === "ws:" ? "80" : undefined;

  return !port || port === "none" || port === defaultPort
    ? `${protocol}//${host}`
    : `${protocol}//${host}:${port}`;
}

export function getWebSocketUrl(): string {
  return buildWebSocketUrl(import.meta.env, window.location.protocol === "https:");
}
