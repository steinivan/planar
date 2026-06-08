import { describe, test, expect } from "bun:test";
import { browserCommand } from "../../packages/server/browser";

const URL = "http://localhost:1234";

describe("browserCommand", () => {
  test("uses `open` on macOS", () => {
    expect(browserCommand(URL, "darwin", undefined)).toEqual(["open", URL]);
  });

  test("uses `xdg-open` on Linux", () => {
    expect(browserCommand(URL, "linux", undefined)).toEqual(["xdg-open", URL]);
  });

  test("uses `cmd /c start` on Windows", () => {
    expect(browserCommand(URL, "win32", undefined)).toEqual([
      "cmd",
      "/c",
      "start",
      "",
      URL,
    ]);
  });

  test("returns null on an unsupported platform", () => {
    expect(browserCommand(URL, "freebsd" as NodeJS.Platform, undefined)).toBe(
      null,
    );
  });

  test("PLANAR_BROWSER overrides the platform default", () => {
    expect(browserCommand(URL, "darwin", "firefox")).toEqual(["firefox", URL]);
  });

  test("PLANAR_BROWSER supports flags", () => {
    expect(browserCommand(URL, "linux", "firefox --new-window")).toEqual([
      "firefox",
      "--new-window",
      URL,
    ]);
  });

  test("PLANAR_BROWSER collapses extra whitespace", () => {
    expect(browserCommand(URL, "linux", "  chromium   --incognito  ")).toEqual([
      "chromium",
      "--incognito",
      URL,
    ]);
  });

  test("returns null when PLANAR_BROWSER is only whitespace", () => {
    expect(browserCommand(URL, "linux", "   ")).toBe(null);
  });

  test("PLANAR_BROWSER=true (the test no-op) yields a runnable command", () => {
    // Tests set PLANAR_BROWSER=true to make the launch a harmless no-op.
    expect(browserCommand(URL, "linux", "true")).toEqual(["true", URL]);
  });
});
