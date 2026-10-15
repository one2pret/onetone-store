import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readCashierMetrics } from "@/lib/pos-reporting";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const mocks=vi.hoisted(()=>({report:vi.fn()}));
vi.mock("@/app/actions/pos-event-reports",()=>({getEventSalesReport:mocks.report}));
import EventSalesPage from "@/app/(admin)/dashboard/reports/events/sales/page";

export function eventRevenueFixture() {
  const metrics=readCashierMetrics({transactions:1,grossSales:500000,salesBeforeRefunds:500000,netSales:400000,refunds:100000,itemsSold:5,returnedItems:1,cashSales:500000,transferRefunds:100000});
  const event={id:5,name:"Bazar Bandung",code:"BDG",status:"closed" as const,venueName:"Bandung",startsAt:new Date("2026-10-01T01:00:00Z"),endsAt:new Date("2026-10-02T10:00:00Z")};
  return {filters:{from:"2026-10-01",to:"2026-10-31",eventId:5,page:1,locationId:7,cashierId:2},asOf:"2026-11-02T00:00:00Z",pageSize:25,summary:metrics,totalEvents:1,rows:[{id:5,event,metrics}],events:[event],cashiers:[{id:2,name:"Kasir A"}],locations:[{id:7,name:"POS A",code:"POS-A"}],selectedEvent:event,days:[{date:"2026-10-01",metrics}],cashierRows:[{id:2,name:"Kasir A",metrics}],totalCashiers:1,excludedOrders:0};
}

describe("event revenue screens",()=>{
  beforeEach(()=>{cleanup();vi.resetAllMocks();mocks.report.mockResolvedValue({success:true,data:eventRevenueFixture()});});
  it("provides actual GET filters and drill-downs that preserve the filter context",async()=>{
    const page = await EventSalesPage({searchParams:Promise.resolve({eventId:"5"})});
    if (process.env.POS_EVENT_UI_ARTIFACT_DIR) writeFileSync(join(process.env.POS_EVENT_UI_ARTIFACT_DIR,"populated.html"),renderToStaticMarkup(page));
    render(page);
    expect(screen.getByLabelText("Event")).toHaveValue("5");
    const form=screen.getByRole("button",{name:"Tampilkan laporan"}).closest("form");
    expect(form).toHaveAttribute("action","/dashboard/reports/events/sales");
    expect(form).toHaveAttribute("method","get");
    expect(screen.getByRole("link",{name:"Lihat seluruh kasir event"})).toHaveAttribute("href","/dashboard/reports/cashiers?from=2026-10-01&to=2026-10-31&page=1&eventId=5&cashierId=2&locationId=7");
    expect(screen.getByText(/Refund mengikuti event dan kasir penjualan asal/)).toBeInTheDocument();
    expect(screen.getByText(/ini bukan arus kas refund harian/)).toBeInTheDocument();
    expect(screen.getByText(/Transfer:/)).toHaveTextContent("100.000");
  });
  it("shows empty rather than fabricated event sales",async()=>{
    const data=eventRevenueFixture();mocks.report.mockResolvedValueOnce({success:true,data:{...data,totalEvents:0,rows:[],days:[],cashierRows:[],summary:readCashierMetrics({})}});
    const page=await EventSalesPage({searchParams:Promise.resolve({})});
    if (process.env.POS_EVENT_UI_ARTIFACT_DIR) writeFileSync(join(process.env.POS_EVENT_UI_ARTIFACT_DIR,"empty.html"),renderToStaticMarkup(page));
    render(page);
    expect(screen.getByText(/Belum ada penjualan event yang cocok/)).toBeInTheDocument();
    expect(screen.getByText(/Belum ada penjualan harian/)).toBeInTheDocument();
  });
  it("rejects duplicate parameters instead of silently selecting one",async()=>{
    render(await EventSalesPage({searchParams:Promise.resolve({eventId:["5","6"]})}));
    expect(screen.getByRole("alert")).toHaveTextContent("Gunakan satu nilai");
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("provides explicit validation recovery",async()=>{
    mocks.report.mockResolvedValueOnce({success:false,error:"Event pada filter tidak ditemukan"});
    const page=await EventSalesPage({searchParams:Promise.resolve({eventId:"99"})});
    if (process.env.POS_EVENT_UI_ARTIFACT_DIR) writeFileSync(join(process.env.POS_EVENT_UI_ARTIFACT_DIR,"error.html"),renderToStaticMarkup(page));
    render(page);
    expect(screen.getByRole("alert")).toHaveTextContent("Event pada filter tidak ditemukan");
    expect(screen.getByRole("link",{name:"Gunakan filter awal"})).toHaveAttribute("href","/dashboard/reports/events/sales");
  });
  it("keeps summary, pagination and completeness warnings visible",async()=>{
    const data=eventRevenueFixture();mocks.report.mockResolvedValueOnce({success:true,data:{...data,totalEvents:26,excludedOrders:2,summary:{...data.summary,legacyPriceOrders:1,missingItemOrders:1}}});
    render(await EventSalesPage({searchParams:Promise.resolve({})}));
    expect(screen.getByRole("link",{name:"Berikutnya"})).toHaveAttribute("href",expect.stringContaining("page=2"));
    expect(screen.getByRole("region",{name:"Kelengkapan data"})).toHaveTextContent("2 order event");
    expect(screen.getByText(/maksimal 25 kasir pertama/)).toBeInTheDocument();
  });
});
