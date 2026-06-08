// Signals that mean "the parent wants us gone". On Windows SIGTERM cannot be
// caught (the OS hard-terminates the process), but SIGBREAK (Ctrl+Break) and
// SIGINT (Ctrl+C) can be, so we register those too to still emit a graceful
// deny where the platform allows it. Registering SIGTERM on Windows is a
// harmless no-op.
export const TERMINATION_SIGNALS: NodeJS.Signals[] =
  process.platform === "win32"
    ? ["SIGINT", "SIGBREAK", "SIGTERM"]
    : ["SIGINT", "SIGTERM"];

export function onceSignals(handler: () => void): void {
  for (const sig of TERMINATION_SIGNALS) process.once(sig, handler);
}

export function offSignals(handler: () => void): void {
  for (const sig of TERMINATION_SIGNALS) process.off(sig, handler);
}
