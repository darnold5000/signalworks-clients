import { describe, expect, it } from "vitest";
import {
  mapUptimeRobotMonitorStatus,
  websiteLabelFromStatus,
} from "@/lib/client-health/uptimerobot/map-status";

describe("mapUptimeRobotMonitorStatus", () => {
  it("maps monitor up to healthy", () => {
    expect(mapUptimeRobotMonitorStatus(2)).toBe("healthy");
  });

  it("maps monitor down to critical", () => {
    expect(mapUptimeRobotMonitorStatus(9)).toBe("critical");
  });

  it("maps seems down to warning", () => {
    expect(mapUptimeRobotMonitorStatus(8)).toBe("warning");
  });

  it("maps not checked yet to unknown", () => {
    expect(mapUptimeRobotMonitorStatus(1)).toBe("unknown");
  });
});

describe("websiteLabelFromStatus", () => {
  it("labels confirmed down as Down", () => {
    expect(websiteLabelFromStatus("critical")).toBe("Down");
  });

  it("labels unknown distinctly from down", () => {
    expect(websiteLabelFromStatus("unknown")).toBe("Unknown");
    expect(websiteLabelFromStatus("not_configured")).toBe("Not configured");
  });
});
