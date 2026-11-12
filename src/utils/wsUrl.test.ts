import { describe, expect, it } from "vitest";
import { buildWebSocketUrl } from "./wsUrl";

describe("buildWebSocketUrl", () => {
  it("uses VITE_WS_URL verbatim when set", () => {
    expect(buildWebSocketUrl({ VITE_WS_URL: "wss://x.example/ws", VITE_WS_HOST: "ignored" }, false)).toBe(
      "wss://x.example/ws"
    );
  });
  it("throws without a host", () => {
    expect(() => buildWebSocketUrl({}, false)).toThrow(/VITE_WS_HOST/);
  });
  it("derives the protocol from the page protocol", () => {
    expect(buildWebSocketUrl({ VITE_WS_HOST: "h" }, false)).toBe("ws://h");
    expect(buildWebSocketUrl({ VITE_WS_HOST: "h" }, true)).toBe("wss://h");
  });
  it("falls back to VITE_HOST and VITE_PORT", () => {
    expect(buildWebSocketUrl({ VITE_HOST: "h", VITE_PORT: "9000" }, false)).toBe("ws://h:9000");
  });
  it("prefers the WS-specific host and port variables", () => {
    expect(
      buildWebSocketUrl({ VITE_HOST: "a", VITE_WS_HOST: "b", VITE_PORT: "1", VITE_WS_PORT: "2" }, false)
    ).toBe("ws://b:2");
  });
  it("includes a custom port and honors an explicit protocol", () => {
    expect(buildWebSocketUrl({ VITE_WS_HOST: "h", VITE_WS_PORT: "8080", VITE_WS_PROTOCOL: "wss:" }, false)).toBe(
      "wss://h:8080"
    );
  });
  it.each([
    ["wss:", "443"],
    ["ws:", "80"],
    ["ws:", "none"],
    ["ws:", ""],
  ])("omits the port for %s %s", (protocol, port) => {
    expect(buildWebSocketUrl({ VITE_WS_HOST: "h", VITE_WS_PROTOCOL: protocol, VITE_WS_PORT: port }, false)).toBe(
      `${protocol}//h`
    );
  });
  it("keeps a default port of the other protocol", () => {
    expect(buildWebSocketUrl({ VITE_WS_HOST: "h", VITE_WS_PROTOCOL: "ws:", VITE_WS_PORT: "443" }, false)).toBe(
      "ws://h:443"
    );
  });
});

