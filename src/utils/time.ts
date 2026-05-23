// Short relative-time renderer used by RecentList and Macro/Phrase cards.
// Buckets match the granularity called for in 03-product-spec §13.3 区域 5
// ("2分钟前" / "昨天" / "—" for never-used assets).
export function relativeTime(
  iso: string | null,
  now: number = Date.now(),
): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diff = now - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}小时前`;
  return `${Math.floor(diff / 86_400_000)}天前`;
}
