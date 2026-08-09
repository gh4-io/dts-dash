import { describe, it, expect } from "vitest";
import {
  FOCUS_SCOPES,
  FOCUS_PATH,
  focusHref,
  parseFocus,
  focusViewKey,
} from "@/lib/utils/flight-board-focus";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

function wp(overrides: Partial<SerializedWorkPackage> = {}): SerializedWorkPackage {
  return {
    id: 1,
    documentSetId: 10,
    aircraftReg: "N753CS",
    aircraftId: 5,
    customer: "Atlas Air",
    flightId: null,
    arrival: "2026-08-08T01:00:00.000Z",
    departure: "2026-08-08T09:00:00.000Z",
    totalMH: 12,
    groundHours: 8,
    status: "Approved",
    hasWorkpackage: true,
    workpackageNo: "WP-1",
    calendarComments: null,
    isActive: true,
    effectiveMH: 12,
    mhSource: "wp",
    manualMHOverride: null,
    inferredType: "B767",
    groundEventTypes: null,
    _commentCount: 0,
    ...overrides,
  };
}

describe("focusHref", () => {
  it("carries the caller's window and filters through unchanged", () => {
    const carry = new URLSearchParams({
      start: "2026-08-08T01:00:00.000Z",
      end: "2026-08-11T01:00:00.000Z",
      tz: "America/New_York",
      op: "Atlas Air",
    });
    const href = focusHref("aircraft", "N753CS", carry);
    const params = new URLSearchParams(href.split("?")[1]);

    expect(href.startsWith(`${FOCUS_PATH}?`)).toBe(true);
    expect(params.get("start")).toBe("2026-08-08T01:00:00.000Z");
    expect(params.get("end")).toBe("2026-08-11T01:00:00.000Z");
    expect(params.get("tz")).toBe("America/New_York");
    expect(params.get("op")).toBe("Atlas Air");
    expect(params.get("scope")).toBe("aircraft");
    expect(params.get("subject")).toBe("N753CS");
  });

  it("overwrites an existing subject rather than stacking one", () => {
    const carry = new URLSearchParams({ scope: "aircraft", subject: "N753CS" });
    const params = new URLSearchParams(focusHref("operator", "Atlas Air", carry).split("?")[1]);

    expect(params.get("scope")).toBe("operator");
    expect(params.getAll("subject")).toEqual(["Atlas Air"]);
  });

  it("encodes names containing spaces and slashes", () => {
    const href = focusHref("operator", "Kalitta Air / Cargo");
    expect(href).not.toContain("Kalitta Air / Cargo");
    expect(parseFocus(new URLSearchParams(href.split("?")[1]))).toEqual({
      scope: "operator",
      subject: "Kalitta Air / Cargo",
    });
  });

  it("works with no params to carry", () => {
    expect(focusHref("aircraft", "N753CS")).toBe(`${FOCUS_PATH}?scope=aircraft&subject=N753CS`);
  });
});

describe("parseFocus", () => {
  it("reads a valid scope and subject", () => {
    expect(parseFocus(new URLSearchParams("scope=operator&subject=Atlas%20Air"))).toEqual({
      scope: "operator",
      subject: "Atlas Air",
    });
  });

  it.each([
    ["no params", ""],
    ["missing subject", "scope=aircraft"],
    ["missing scope", "subject=N753CS"],
    ["empty subject", "scope=aircraft&subject="],
    ["unknown scope", "scope=nonsense&subject=N753CS"],
  ])("returns null for %s", (_label, qs) => {
    expect(parseFocus(new URLSearchParams(qs))).toBeNull();
  });

  it("does not treat inherited Object prototype keys as scopes", () => {
    expect(parseFocus(new URLSearchParams("scope=toString&subject=x"))).toBeNull();
  });
});

describe("FOCUS_SCOPES", () => {
  it("labels the way the drawer's links read", () => {
    expect(FOCUS_SCOPES.aircraft.label("N753CS")).toBe("All N753CS visits");
    expect(FOCUS_SCOPES.operator.label("Atlas Air")).toBe("All Atlas Air work packages");
  });

  it("narrows rows to the subject", () => {
    const rows = [
      wp({ id: 1, aircraftReg: "N753CS", customer: "Atlas Air" }),
      wp({ id: 2, aircraftReg: "N401KZ", customer: "Atlas Air" }),
      wp({ id: 3, aircraftReg: "N753CS", customer: "Kalitta Air" }),
    ];

    expect(rows.filter((r) => FOCUS_SCOPES.aircraft.match(r, "N753CS")).map((r) => r.id)).toEqual([
      1, 3,
    ]);
    expect(
      rows.filter((r) => FOCUS_SCOPES.operator.match(r, "Atlas Air")).map((r) => r.id),
    ).toEqual([1, 2]);
  });

  it("matches exactly, not by prefix", () => {
    expect(FOCUS_SCOPES.aircraft.match(wp({ aircraftReg: "N753CSX" }), "N753CS")).toBe(false);
  });
});

describe("focusViewKey", () => {
  it("gives the board and each subject their own cache slot", () => {
    expect(focusViewKey(null)).toBe("flight-board");
    expect(focusViewKey({ scope: "aircraft", subject: "N753CS" })).toBe(
      "flight-board:focus:aircraft:N753CS",
    );
    expect(focusViewKey({ scope: "aircraft", subject: "N753CS" })).not.toBe(
      focusViewKey({ scope: "operator", subject: "N753CS" }),
    );
  });
});
