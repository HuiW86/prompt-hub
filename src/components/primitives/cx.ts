export type Layer = "task" | "protocol" | "neutral";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
