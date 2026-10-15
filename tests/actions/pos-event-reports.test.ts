import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), select: vi.fn(), execute: vi.fn() }));
vi.mock("@/lib/pos-auth", () => ({ requirePosAdmin: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { transaction: mocks.transaction } }));
import { getEventSalesReport } from "@/app/actions/pos-event-reports";
function chain(rows: unknown[]) { const query={ from: () => query, where: () => query, orderBy: async () => rows }; return query; }

describe("event revenue action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ ok:true, actor:{ id:1,role:"admin" } });
    mocks.select.mockReturnValueOnce(chain([{ id:5, code:"BDG",name:"Bazar",status:"closed" }]))
      .mockReturnValueOnce(chain([{ id:2,name:"Kasir" }])).mockReturnValueOnce(chain([{ id:7,name:"POS" }]));
    mocks.execute.mockResolvedValueOnce([[{rowKind:"summary",totalGroups:"1",transactions:"1",salesBeforeRefunds:"500000",netSales:"400000",refunds:"100000"},{rowKind:"detail",groupId:5,netSales:"400000"}]])
      .mockResolvedValueOnce([[{excludedOrders:0}]]);
    mocks.transaction.mockImplementation((callback: (tx: unknown)=>unknown) => callback({select:mocks.select,execute:mocks.execute}));
  });
  it.each(["cashier","customer","inventory_staff","disabled admin"])("denies %s before DB access", async role => {
    mocks.auth.mockResolvedValueOnce({ok:false,error:`Denied ${role}`});
    expect((await getEventSalesReport()).success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([{eventId:-1},{eventId:"bad"},{from:"2026-02-30"},{from:"2025-01-01",to:"2026-10-01"}])("validates filters before queries", async input => {
    expect((await getEventSalesReport(input)).success).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it.each([{eventId:99},{cashierId:99},{locationId:99}])("rejects unknown choices without broadening", async input => {
    expect((await getEventSalesReport(input)).success).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("returns an all-page summary in a read-only snapshot", async () => {
    const result=await getEventSalesReport();
    expect(result).toMatchObject({success:true,data:{totalEvents:1,summary:{netSales:400000,averageTransaction:500000},rows:[{id:5,event:{name:"Bazar"}}]}});
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:"repeatable read",accessMode:"read only"});
  });
  it("fetches daily/cashier aggregates only when a single event is selected", async () => {
    mocks.execute.mockResolvedValueOnce([[{rowKind:"detail",groupId:"2026-10-01",netSales:400000}]])
      .mockResolvedValueOnce([[{rowKind:"summary",totalCashiers:1},{rowKind:"cashier",cashierId:2,cashierName:"Kasir",netSales:400000}]]);
    expect(await getEventSalesReport({eventId:5})).toMatchObject({success:true,data:{days:[{date:"2026-10-01"}],cashierRows:[{id:2,name:"Kasir"}],selectedEvent:{status:"closed"}}});
    expect(mocks.execute).toHaveBeenCalledTimes(4);
  });
});
