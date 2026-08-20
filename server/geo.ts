import type { IncomingHttpHeaders } from "http";
import type { Request } from "express";

const UK_CODES = new Set(["GB", "UK"]);

export function normalizeCountryCode(value: string | undefined | null) {
  return value?.trim().toUpperCase() || null;
}

export function canonicalCountryCode(value: string | undefined | null) {
  const normalized = normalizeCountryCode(value);
  return normalized === "UK" ? "GB" : normalized;
}

export function isUkCountry(value: string | undefined | null) {
  const normalized = normalizeCountryCode(value);
  return normalized ? UK_CODES.has(normalized) : false;
}

export function countryFromHeaders(headers: IncomingHttpHeaders) {
  const candidates = [
    headers["cf-ipcountry"],
    headers["x-country-code"],
    headers["x-vercel-ip-country"],
    headers["x-geo-country"],
  ];
  for (const candidate of candidates) {
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    const normalized = normalizeCountryCode(value);
    if (normalized) return normalized;
  }
  return null;
}

export function countryFromRequest(req: Request) {
  const headerCountry = countryFromHeaders(req.headers);
  if (headerCountry) return headerCountry;
  if (process.env.NODE_ENV === "development") return "GB";
  return null;
}

export async function resolveRequestCountry(req: Request) {
  const headerCountry = countryFromHeaders(req.headers);
  if (headerCountry) return headerCountry;
  if (process.env.NODE_ENV === "development") return "GB";

  const endpoint = process.env.GEOIP_API_URL;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { country_code?: string; country?: string };
    return normalizeCountryCode(payload.country_code ?? payload.country);
  } catch {
    return null;
  }
}

export async function resolveUpgradeCountry(headers: IncomingHttpHeaders) {
  const headerCountry = countryFromHeaders(headers);
  if (headerCountry) return headerCountry;
  if (process.env.NODE_ENV === "development") return "GB";
  const endpoint = process.env.GEOIP_API_URL;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { country_code?: string; country?: string };
    return normalizeCountryCode(payload.country_code ?? payload.country);
  } catch {
    return null;
  }
}
