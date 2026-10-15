import { describe, expect, it } from "vitest";
import { salesEventCanTransition, salesEventIsSelectable, salesEventLocalDate, salesEventSchema } from "@/lib/sales-events";

const input = { code: " bazar-2026 ", name: " Bazar Bandung ", startsAt: "2026-10-12T09:00:15", endsAt: "2026-10-12T17:00:15", status: "draft" };

describe("sales event rules", () => {
  it("normalizes identity and converts WIB independently of browser/server timezone", () => {
    const value = salesEventSchema.parse(input);
    expect(value.code).toBe("BAZAR-2026");
    expect(value.name).toBe("Bazar Bandung");
    expect(value.startsAt.toISOString()).toBe("2026-10-12T02:00:15.000Z");
    expect(salesEventLocalDate(value.startsAt)).toBe(input.startsAt);
    expect(value.inventoryLocationId).toBeNull();
  });

  it.each(["2026-02-30T09:00", "2026-10-12T25:00", "2026-10-12T09:00Z", "1999-12-31T09:00", "2038-01-01T09:00"])("rejects invalid/out-of-range dates: %s", startsAt => {
    expect(salesEventSchema.safeParse({ ...input, startsAt }).success).toBe(false);
  });

  it.each([input.startsAt, "2026-10-12T08:00"])("requires a strictly later end: %s", endsAt => {
    expect(salesEventSchema.safeParse({ ...input, endsAt }).success).toBe(false);
  });

  it("rejects malformed codes and invalid location IDs", () => {
    expect(salesEventSchema.safeParse({ ...input, code: "event / one" }).success).toBe(false);
    expect(salesEventSchema.safeParse({ ...input, inventoryLocationId: -1 }).success).toBe(false);
  });

  it("includes the start but excludes the end and all inactive statuses", () => {
    const event = salesEventSchema.parse({ ...input, status: "active" });
    expect(salesEventIsSelectable(event, event.startsAt)).toBe(true);
    expect(salesEventIsSelectable(event, new Date(event.startsAt.getTime() - 1))).toBe(false);
    expect(salesEventIsSelectable(event, event.endsAt)).toBe(false);
    for (const status of ["draft", "closed", "cancelled"] as const) expect(salesEventIsSelectable({ ...event, status }, event.startsAt)).toBe(false);
  });

  it("permits only forward transitions, never reopens terminal events", () => {
    expect(salesEventCanTransition("draft", "active")).toBe(true);
    expect(salesEventCanTransition("draft", "cancelled")).toBe(true);
    expect(salesEventCanTransition("active", "closed")).toBe(true);
    expect(salesEventCanTransition("active", "cancelled")).toBe(true);
    expect(salesEventCanTransition("active", "draft")).toBe(false);
    expect(salesEventCanTransition("draft", "closed")).toBe(false);
    expect(salesEventCanTransition("closed", "active")).toBe(false);
    expect(salesEventCanTransition("cancelled", "active")).toBe(false);
  });
});
