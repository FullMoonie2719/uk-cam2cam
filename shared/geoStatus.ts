export function getRegionStatusText(country: string | null, source: string | undefined) {
  return `Detected region: ${country ?? "unavailable"} · Lookup: ${source ?? "unknown"}`;
}
