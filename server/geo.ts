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

function clientIpFromHeaders(headers: IncomingHttpHeaders) {
  const forwarded = headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return first?.trim() || (typeof headers["x-real-ip"] === "string" ? headers["x-real-ip"] : null);
}

async function resolveCountryFromHeaders(headers: IncomingHttpHeaders) {
  const headerCountry = countryFromHeaders(headers);
  if (headerCountry) return headerCountry;
  if (process.env.NODE_ENV === "development") return "GB";

  const ip = clientIpFromHeaders(headers);
  const configuredEndpoint = process.env.GEOIP_API_URL || "https://ipapi.co/{ip}/json/";
  if (!ip && configuredEndpoint.includes("{ip}")) return null;
  const endpoint = configuredEndpoint.replace("{ip}", encodeURIComponent(ip || ""));
  try {
    const response = await fetch(endpoint, { headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { country_code?: string; country?: string };
    return normalizeCountryCode(payload.country_code ?? payload.country);
  } catch {
    return null;
  }
}

export async function resolveRequestCountry(req: Request) {
  return resolveCountryFromHeaders(req.headers);
}

export async function resolveUpgradeCountry(headers: IncomingHttpHeaders) {
  return resolveCountryFromHeaders(headers);
}
