import { z } from "zod";
import { parseBrowserLocalDateTime } from "@/lib/browser-local-datetime";

export const SALES_EVENT_STATUSES = ["draft", "active", "closed", "cancelled"] as const;
export type SalesEventStatus = typeof SALES_EVENT_STATUSES[number];
export const SALES_EVENT_LABELS: Record<SalesEventStatus, string> = {
  draft: "Draft", active: "Aktif", closed: "Selesai", cancelled: "Dibatalkan",
};

const eventDate = z.string().transform((value, ctx) => {
  try {
    const date = parseBrowserLocalDateTime(value, -420);
    if (date.getTime() < Date.UTC(2000, 0, 1) - 7 * 3_600_000 || date.getTime() >= Date.UTC(2038, 0, 1) - 7 * 3_600_000) throw new RangeError();
    return date;
  } catch {
    ctx.addIssue({ code: "custom", message: "Tanggal/jam WIB tidak valid (tahun 2000–2037)" });
    return z.NEVER;
  }
});

export const salesEventSchema = z.object({
  code: z.string().trim().toUpperCase().min(2, "Kode minimal 2 karakter").max(50).regex(/^[A-Z0-9][A-Z0-9-]*$/, "Kode hanya huruf, angka, dan tanda hubung"),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(150),
  startsAt: eventDate,
  endsAt: eventDate,
  status: z.enum(SALES_EVENT_STATUSES),
  venueName: z.string().trim().max(150).default(""),
  inventoryLocationId: z.number().int().positive().nullable().default(null),
  notes: z.string().trim().max(500).default(""),
}).refine(data => data.endsAt > data.startsAt, { path: ["endsAt"], message: "Waktu selesai harus setelah waktu mulai" });

export type SalesEventInput = z.input<typeof salesEventSchema>;

export function salesEventIsSelectable(event: { status: SalesEventStatus; startsAt: Date; endsAt: Date }, now = new Date()) {
  return event.status === "active" && event.startsAt <= now && event.endsAt > now;
}

export function salesEventCanTransition(from: SalesEventStatus, to: SalesEventStatus) {
  return from === to || (from === "draft" && (to === "active" || to === "cancelled"))
    || (from === "active" && (to === "closed" || to === "cancelled"));
}

export function salesEventLocalDate(value: Date | string) {
  return new Date(new Date(value).getTime() + 7 * 3_600_000).toISOString().slice(0, 19);
}
