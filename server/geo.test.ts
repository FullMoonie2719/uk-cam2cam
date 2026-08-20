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

  it("allows local development only when explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_LOCAL_DEV", "true");
    expect(countryFromRequest({ headers: {} } as never)).toBe("GB");
    vi.unstubAllEnvs();
  });
});
