import { resolveBrowser } from "./config";

// Builds the argv used to launch the browser, or null when none can be
// determined (empty PLANAR_BROWSER, or an unsupported platform). Pure and
// parameterised so it can be unit-tested without spawning a process.
export function browserCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
  browser: string | undefined = resolveBrowser(),
): string[] | null {
  if (browser) {
    // Split on whitespace so users can pass flags
    // (e.g. PLANAR_BROWSER="firefox --new-window"). No shell expansion —
    // paths-with-spaces are not supported via this env var.
    const argv = browser.split(/\s+/).filter(Boolean);
    if (argv.length === 0) {
      console.error("Planar: PLANAR_BROWSER is set but empty after trim");
      return null;
    }
    return [...argv, url];
  }
  switch (platform) {
    case "darwin":
      return ["open", url];
    case "linux":
      return ["xdg-open", url];
    case "win32":
      return ["cmd", "/c", "start", "", url];
    default:
      console.error(`Planar: cannot open browser on platform ${platform}`);
      return null;
  }
}

export function openBrowser(url: string): void {
  const cmd = browserCommand(url);
  if (!cmd) return;

  try {
    const child = Bun.spawn(cmd, {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    child.unref?.();
  } catch (err) {
    console.error(`Planar: failed to launch browser (${cmd[0]}): ${err}`);
  }
}
