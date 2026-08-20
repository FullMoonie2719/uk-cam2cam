import { describe, expect, it, vi } from "vitest";
import { countryFromRequest, isUkCountry, normalizeCountryCode } from "./geo";

describe("geo helpers", () => {
  it("normalizes country codes and accepts GB/UK", () => {
    expect(normalizeCountryCode(" gb ")).toBe("GB");
    expect(isUkCountry("GB")).toBe(true);
    expect(isUkCountry("uk")).toBe(true);
    expect(isUkCountry("FR")).toBe(false);
  });

  it("prefers trusted proxy country headers", () => {
    const request = { headers: { "cf-ipcountry": "GB", "x-country-code": "FR" } } as never;
    expect(countryFromRequest(request)).toBe("GB");
  });

  it("allows local development without a proxy header", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(countryFromRequest({ headers: {} } as never)).toBe("GB");
    vi.unstubAllEnvs();
  });

  it("uses the forwarded client IP for production fallback geolocation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ country_code: "GB" }) });
    vi.stubGlobal("fetch", fetchMock);
    const { resolveRequestCountry } = await import("./geo");
    await expect(resolveRequestCountry({ headers: { "x-forwarded-for": "203.0.113.7" } } as never)).resolves.toBe("GB");
    expect(fetchMock).toHaveBeenCalledWith("https://ipapi.co/203.0.113.7/json/", expect.any(Object));
    vi.unstubAllEnvs();
  });
});
