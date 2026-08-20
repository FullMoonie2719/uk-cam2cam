import { describe, expect, it } from "vitest";
import { getRegionStatusText } from "../shared/geoStatus";

describe("region status messaging", () => {
  it("explains the detected country and lookup source", () => {
    expect(getRegionStatusText("GB", "IP geolocation fallback")).toBe("Detected region: GB · Lookup: IP geolocation fallback");
  });

  it("makes unavailable lookups explicit", () => {
    expect(getRegionStatusText(null, "unavailable")).toBe("Detected region: unavailable · Lookup: unavailable");
  });
});
