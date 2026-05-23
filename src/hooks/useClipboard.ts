// Thin wrapper over navigator.clipboard so components can swap to a Tauri
// plugin or test mock without touching every call site.
export async function writeClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    throw new Error("clipboard API not available");
  }
  await navigator.clipboard.writeText(text);
}
