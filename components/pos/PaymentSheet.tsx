"use client";

// components/pos/PaymentSheet.tsx
// Overlay pembayaran: pilih metode → konfirmasi → panggil createPosOrder.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { toast } from "sonner";
import { X, Banknote, QrCode, ArrowRightLeft, ArrowLeft, Tag, Search, UserRoundCheck, UserPlus, Copy, ExternalLink } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { createPosOrder } from "@/app/actions/pos-orders";
import {
  registerPosCustomerLead,
  searchPosMembers,
  type PosCustomerLeadResult,
  type PosMemberSearchResult,
} from "@/app/actions/pos-members";
import { calculatePosDiscountPricing, type PosDiscount } from "@/lib/pos-discounts";
import type { CartLine } from "./CashierScreen";

const QUICK_CASH = [
  { label: "Uang Pas", getValue: (t: number) => t },
  { label: "20K", value: 20000 },
  { label: "50K", value: 50000 },
  { label: "100K", value: 100000 },
  { label: "200K", value: 200000 },
  { label: "500K", value: 500000 },
];

const POS_PAYMENT_HISTORY_GUARD = "__onetonePosPaymentGuard";

type PaymentMethod = "cash" | "qris" | "transfer";

interface Props {
  sessionId: number;
  cart: CartLine[];
  total: number;
  maxDiscountPercent: number;
  qrisUrl: string | null;
  onClose: () => void;
  onSuccess: (orderId: number) => void;
}

export function PaymentSheet({ sessionId, cart, total, maxDiscountPercent, qrisUrl, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<PosMemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<PosMemberSearchResult | null>(null);
  const [selectedLead, setSelectedLead] = useState<PosCustomerLeadResult | null>(null);
  const [leadActivation, setLeadActivation] = useState<{ url: string; qrDataUrl: string | null } | null>(null);
  const [memberSearchComplete, setMemberSearchComplete] = useState(false);
  const [leadRegistrationOpen, setLeadRegistrationOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadConsent, setLeadConsent] = useState(false);
  const [leadMarketingConsent, setLeadMarketingConsent] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, PosDiscount>>({});
  const [orderDiscount, setOrderDiscount] = useState<PosDiscount>({ type: "percent", value: 0 });
  const [isPending, startTransition] = useTransition();
  const [isSearchingMember, startMemberSearch] = useTransition();
  const [isRegisteringLead, startLeadRegistration] = useTransition();
  const historyExitCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Desktop tetap mengikuti history browser normal. Guard ditujukan untuk
    // tombol Back perangkat pada layout POS mobile/tablet.
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    const guardedState = {
      ...(window.history.state ?? {}),
      [POS_PAYMENT_HISTORY_GUARD]: true,
    };

    // Tambah satu entry pada URL yang sama. Back perangkat akan kembali ke
    // entry POS sebelumnya, lalu handler di bawah mengembalikan guard.
    if (!window.history.state?.[POS_PAYMENT_HISTORY_GUARD]) {
      window.history.pushState(guardedState, "", window.location.href);
    }

    function handleHistoryBack() {
      const exitCallback = historyExitCallback.current;
      if (exitCallback) {
        historyExitCallback.current = null;
        exitCallback();
        return;
      }

      window.history.pushState(guardedState, "", window.location.href);
      toast.info("Gunakan tombol kembali di header untuk keluar dari pembayaran", {
        id: "pos-payment-back-guard",
      });
    }

    window.addEventListener("popstate", handleHistoryBack);
    return () => window.removeEventListener("popstate", handleHistoryBack);
  }, []);

  const leavePayment = useCallback((callback: () => void) => {
    if (historyExitCallback.current) return;

    if (window.history.state?.[POS_PAYMENT_HISTORY_GUARD]) {
      historyExitCallback.current = callback;
      window.history.back();
      return;
    }

    callback();
  }, []);

  const discountPricing = useMemo(() => {
    try {
      return {
        value: calculatePosDiscountPricing(
          cart.map(line => ({
            key: line.key,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            discount: lineDiscounts[line.key],
          })),
          orderDiscount,
          maxDiscountPercent,
        ),
        error: null,
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "Diskon tidak valid",
      };
    }
  }, [cart, lineDiscounts, maxDiscountPercent, orderDiscount]);
  const payableTotal = discountPricing.value?.total ?? total;
  const cashReceived = Number(cashInput) || 0;
  const change = useMemo(
    () => (method === "cash" ? cashReceived - payableTotal : 0),
    [method, cashReceived, payableTotal]
  );
  const cashOk = method !== "cash" || cashReceived >= payableTotal;

  function numpadPress(key: string) {
    if (key === "back") {
      setCashInput((v) => v.slice(0, -1));
    } else if (key === "clear") {
      setCashInput("");
    } else if (key === "000") {
      setCashInput((v) => (v === "" ? "000" : v + "000"));
    } else {
      setCashInput((v) => (v + key).replace(/^0+(?=\d)/, ""));
    }
  }

  function handleConfirm() {
    if (!discountPricing.value) {
      toast.error(discountPricing.error ?? "Diskon tidak valid");
      return;
    }
    if (!cashOk) {
      toast.error(`Uang kurang. Butuh ${formatRupiah(payableTotal)}`);
      return;
    }

    startTransition(async () => {
      const result = await createPosOrder({
        sessionId,
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          discount: lineDiscounts[l.key]?.value > 0 ? lineDiscounts[l.key] : undefined,
        })),
        paymentMethod: method,
        cashReceived: method === "cash" ? cashReceived : undefined,
        customerUserId: selectedMember?.id,
        customerLeadId: selectedLead?.id,
        customerName: selectedMember?.name || selectedLead?.name || customerName || undefined,
        orderDiscount: orderDiscount.value > 0 ? orderDiscount : undefined,
      });

      if (result.success && result.orderId) {
        toast.success("Transaksi berhasil");
        leavePayment(() => onSuccess(result.orderId));
      } else {
        toast.error(result.error ?? "Gagal proses pembayaran");
      }
    });
  }

  function handleMemberSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = memberQuery.trim();
    if (query.length < 2) {
      toast.error("Masukkan minimal 2 karakter");
      return;
    }

    startMemberSearch(async () => {
      const result = await searchPosMembers(query);
      setMemberSearchComplete(true);
      if (!result.success) {
        setMemberResults([]);
        toast.error(result.error);
        return;
      }
      setMemberResults(result.data);
    });
  }

  function selectMember(member: PosMemberSearchResult) {
    setSelectedMember(member);
    setSelectedLead(null);
    setLeadActivation(null);
    setCustomerName(member.name);
    setMemberResults([]);
    setMemberSearchComplete(false);
  }

  function clearSelectedMember() {
    setSelectedMember(null);
    setSelectedLead(null);
    setLeadActivation(null);
    setCustomerName("");
    setMemberQuery("");
    setMemberResults([]);
    setMemberSearchComplete(false);
  }

  function handleLeadRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leadConsent) {
      toast.error("Konfirmasi persetujuan pelanggan terlebih dahulu");
      return;
    }

    startLeadRegistration(async () => {
      const result = await registerPosCustomerLead({
        sessionId,
        name: leadName,
        phone: leadPhone,
        email: leadEmail,
        consent: true,
        marketingConsent: leadMarketingConsent,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (result.kind === "member") {
        selectMember(result.member);
        toast.info("Nomor sudah terdaftar. Member lama dipilih untuk transaksi ini.");
      } else {
        const activationUrl = new URL(result.lead.activationPath, window.location.origin).toString();
        let qrDataUrl: string | null = null;
        try {
          qrDataUrl = await QRCode.toDataURL(activationUrl, {
            width: 280,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#0f172a", light: "#ffffff" },
          });
        } catch {
          toast.warning("QR gagal dibuat, tetapi tautan aktivasi tetap tersedia");
        }
        setSelectedMember(null);
        setSelectedLead(result.lead);
        setLeadActivation({ url: activationUrl, qrDataUrl });
        setCustomerName(result.lead.name);
        setMemberResults([]);
        setMemberSearchComplete(false);
        toast.success(result.reused ? "Pendaftaran calon member lama diperbarui" : "Calon member berhasil didaftarkan");
      }

      setLeadRegistrationOpen(false);
      setLeadName("");
      setLeadPhone("");
      setLeadEmail("");
      setLeadConsent(false);
      setLeadMarketingConsent(false);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white text-slate-900">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <button
          onClick={() => leavePayment(onClose)}
          className="-ml-2 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900">Pembayaran</h1>
          <p className="text-xs text-slate-500">{cart.length} item</p>
        </div>
        <button
          onClick={() => leavePayment(onClose)}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Total */}
        <section className="px-4 py-6 bg-slate-900 text-white text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Belanja</p>
          <p className="text-4xl md:text-5xl font-bold mt-1">{formatRupiah(payableTotal)}</p>
          {discountPricing.value && discountPricing.value.discountTotal > 0 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              <span className="text-slate-400 line-through">{formatRupiah(discountPricing.value.subtotal)}</span>
              <span className="font-semibold text-emerald-300">
                Hemat {formatRupiah(discountPricing.value.discountTotal)}
              </span>
            </div>
          )}
        </section>

        {/* Discounts */}
        <section className="border-b border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={() => setDiscountOpen(value => !value)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Tag className="h-4 w-4" />
              Diskon POS
            </span>
            <span className="text-xs font-medium text-slate-500">
              {discountPricing.value?.discountTotal
                ? `-${formatRupiah(discountPricing.value.discountTotal)}`
                : discountOpen ? "Tutup" : "Tambah"}
            </span>
          </button>

          {discountOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-slate-500">
                Batas diskon gabungan akun ini {maxDiscountPercent}% dari subtotal.
              </p>
              {cart.map(line => (
                <div key={line.key} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{line.productName}</p>
                      {line.variantLabel && <p className="text-[10px] text-slate-500">{line.variantLabel}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-700">
                      {formatRupiah(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                  <DiscountInput
                    label="Diskon item"
                    discount={lineDiscounts[line.key] ?? { type: "percent", value: 0 }}
                    onChange={discount => setLineDiscounts(current => ({ ...current, [line.key]: discount }))}
                  />
                </div>
              ))}

              <div className="rounded-xl border border-slate-200 p-3">
                <DiscountInput
                  label="Diskon transaksi"
                  discount={orderDiscount}
                  onChange={setOrderDiscount}
                />
              </div>

              {discountPricing.error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {discountPricing.error}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Payment method tabs */}
        <section className="px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Metode Pembayaran
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MethodButton
              icon={<Banknote className="w-5 h-5" />}
              label="Tunai"
              active={method === "cash"}
              onClick={() => setMethod("cash")}
            />
            <MethodButton
              icon={<QrCode className="w-5 h-5" />}
              label="QRIS"
              active={method === "qris"}
              onClick={() => setMethod("qris")}
            />
            <MethodButton
              icon={<ArrowRightLeft className="w-5 h-5" />}
              label="Transfer"
              active={method === "transfer"}
              onClick={() => setMethod("transfer")}
            />
          </div>
        </section>

        {/* Method content */}
        {method === "cash" && (
          <section className="px-4 pb-4 space-y-3">
            {/* Input display */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[11px] text-slate-500">Uang Diterima</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {formatRupiah(cashReceived)}
              </p>
              {cashReceived > 0 && change >= 0 && (
                <p className="mt-2 text-sm font-semibold text-emerald-600">
                  Kembalian: {formatRupiah(change)}
                </p>
              )}
              {cashReceived > 0 && change < 0 && (
                <p className="mt-2 text-sm font-semibold text-rose-600">
                  Kurang: {formatRupiah(Math.abs(change))}
                </p>
              )}
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-3 gap-2">
              {QUICK_CASH.map((q, i) => {
                const val = "value" in q ? q.value : q.getValue!(payableTotal);
                return (
                  <button
                    key={i}
                    onClick={() => setCashInput(String(val))}
                    className="rounded-lg bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-950 active:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"].map(
                (k) => (
                  <button
                    key={k}
                    onClick={() => numpadPress(k)}
                    className="rounded-lg border border-slate-300 bg-white py-3.5 text-lg font-semibold text-slate-900 transition-colors hover:bg-slate-50 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    {k === "back" ? "⌫" : k}
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {method === "qris" && (
          <section className="px-4 pb-4">
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              {qrisUrl ? (
                <div className="relative w-56 h-56 mx-auto mb-4 bg-white rounded-xl overflow-hidden border border-slate-200">
                  <Image
                    src={qrisUrl}
                    alt="QRIS Merchant"
                    fill
                    unoptimized
                    sizes="224px"
                    className="object-contain p-2"
                  />
                </div>
              ) : (
                <div className="w-40 h-40 mx-auto mb-4 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center">
                  <div className="text-center px-2">
                    <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-[10px] text-slate-500">
                      Upload QRIS di<br />Pengaturan Toko
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-600 mb-1">
                {qrisUrl
                  ? "Tunjukkan QRIS ke customer, lalu konfirmasi setelah dibayar"
                  : "Upload gambar QRIS di /dashboard/settings dulu"}
              </p>
              <p className="text-lg font-bold text-slate-900 mt-2">{formatRupiah(payableTotal)}</p>
            </div>
          </section>
        )}

        {method === "transfer" && (
          <section className="px-4 pb-4">
            <div className="p-6 bg-slate-50 rounded-xl">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Transfer Bank
              </p>
              <p className="text-sm text-slate-600">
                Pastikan customer sudah transfer dan dana masuk sebelum konfirmasi.
              </p>
              <p className="text-lg font-bold text-slate-900 mt-3">{formatRupiah(payableTotal)}</p>
            </div>
          </section>
        )}

        {/* Existing member lookup or walk-in customer name */}
        <section className="px-4 pb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Pelanggan / member
            </h2>
            <span className="text-xs text-slate-500">Opsional</span>
          </div>

          {selectedMember || selectedLead ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <UserRoundCheck className="h-4.5 w-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selectedMember?.name ?? selectedLead?.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {selectedMember
                      ? selectedMember.maskedPhone ?? selectedMember.maskedEmail
                      : selectedLead?.maskedPhone}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-sky-800">
                    {selectedMember
                      ? `${selectedMember.tierName} · ${selectedMember.points.toLocaleString("id-ID")} poin`
                      : "Calon member · menunggu aktivasi"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedMember}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  Ganti
                </button>
              </div>
              {selectedLead && leadActivation && (
                <div className="mt-3 border-t border-sky-200 pt-3">
                  <div className="grid items-center gap-3 sm:grid-cols-[116px_minmax(0,1fr)]">
                    {leadActivation.qrDataUrl && (
                      <div className="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 sm:mx-0">
                        <Image
                          src={leadActivation.qrDataUrl}
                          alt="QR aktivasi member"
                          width={104}
                          height={104}
                          unoptimized
                          className="h-[104px] w-[104px]"
                        />
                      </div>
                    )}
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-xs font-semibold text-slate-900">Scan untuk aktivasi member</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        QR berlaku 24 jam dan hanya dapat dipakai satu kali. Setelah aktif, akun otomatis mendapat voucher member baru yang sedang aktif.
                      </p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(leadActivation.url);
                              toast.success("Tautan aktivasi disalin");
                            } catch {
                              toast.error("Browser tidak mengizinkan penyalinan otomatis");
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          Salin tautan
                        </button>
                        <a
                          href={leadActivation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Buka aktivasi
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <form onSubmit={handleMemberSearch} className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={memberQuery}
                    onChange={event => {
                      setMemberQuery(event.target.value);
                      setMemberSearchComplete(false);
                    }}
                    placeholder="Nama, nomor HP, atau email"
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-200"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingMember || memberQuery.trim().length < 2}
                  className="shrink-0 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {isSearchingMember ? "Mencari..." : "Cari"}
                </button>
              </form>

              {memberResults.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {memberResults.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => selectMember(member)}
                      className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">{member.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {[member.maskedPhone, member.maskedEmail].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11px] font-semibold text-sky-700">{member.tierName}</span>
                        <span className="block text-[10px] text-slate-400">
                          {member.points.toLocaleString("id-ID")} poin
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {memberSearchComplete && !isSearchingMember && memberResults.length === 0 && !leadRegistrationOpen && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    Member tidak ditemukan. Daftarkan sebagai calon member atau lanjutkan sebagai pelanggan umum.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLeadRegistrationOpen(true);
                      if (/\d/.test(memberQuery)) setLeadPhone(memberQuery);
                    }}
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    Daftarkan calon member
                  </button>
                </div>
              )}

              {leadRegistrationOpen && (
                <form onSubmit={handleLeadRegistration} className="space-y-4 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Daftarkan calon member</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Akun login belum dibuat pada tahap ini.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeadRegistrationOpen(false)}
                      className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      aria-label="Tutup formulir calon member"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pos-lead-name" className="mb-1.5 block text-xs font-semibold text-slate-600">Nama pelanggan</label>
                      <input
                        id="pos-lead-name"
                        required
                        minLength={2}
                        maxLength={255}
                        value={leadName}
                        onChange={event => setLeadName(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-200"
                        placeholder="Nama lengkap"
                      />
                    </div>
                    <div>
                      <label htmlFor="pos-lead-phone" className="mb-1.5 block text-xs font-semibold text-slate-600">Nomor WhatsApp</label>
                      <input
                        id="pos-lead-phone"
                        required
                        inputMode="tel"
                        autoComplete="tel"
                        value={leadPhone}
                        onChange={event => setLeadPhone(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-200"
                        placeholder="08xxxxxxxxxx"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pos-lead-email" className="mb-1.5 block text-xs font-semibold text-slate-600">Email (opsional)</label>
                    <input
                      id="pos-lead-email"
                      type="email"
                      autoComplete="email"
                      value={leadEmail}
                      onChange={event => setLeadEmail(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-200"
                      placeholder="nama@email.com"
                    />
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      required
                      checked={leadConsent}
                      onChange={event => setLeadConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                    />
                    <span>Pelanggan menyetujui penyimpanan data untuk pendaftaran dan pengelolaan membership.</span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 px-2.5 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={leadMarketingConsent}
                      onChange={event => setLeadMarketingConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-slate-900"
                    />
                    <span>Pelanggan bersedia menerima informasi promo melalui WhatsApp atau email.</span>
                  </label>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setLeadRegistrationOpen(false)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isRegisteringLead || !leadConsent}
                      className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      {isRegisteringLead ? "Menyimpan..." : "Simpan calon member"}
                    </button>
                  </div>
                </form>
              )}

              <div>
                <label htmlFor="pos-customer-name" className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Nama pelanggan non-member
                </label>
                <input
                  id="pos-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Misal: Ibu Rina"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-200"
                />
              </div>

              {!leadRegistrationOpen && !memberSearchComplete && (
                <button
                  type="button"
                  onClick={() => setLeadRegistrationOpen(true)}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-100 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  Daftarkan calon member baru
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Footer confirm button */}
      <footer className="px-4 py-3 border-t border-slate-200 bg-white">
        <button
          onClick={handleConfirm}
          disabled={isPending || !cashOk || !discountPricing.value}
          className="w-full rounded-xl bg-slate-900 py-4 text-base font-bold text-white shadow-lg shadow-slate-900/15 transition-colors hover:bg-slate-800 active:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
        >
          {isPending
            ? "Memproses..."
            : method === "cash"
              ? "Konfirmasi & Cetak Struk"
              : "Sudah Dibayar → Cetak Struk"}
        </button>
      </footer>
    </div>
  );
}

function DiscountInput({
  label,
  discount,
  onChange,
}: {
  label: string;
  discount: PosDiscount;
  onChange: (discount: PosDiscount) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
          {(["percent", "fixed"] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ type, value: discount.value })}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                discount.type === type ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {type === "percent" ? "%" : "Rp"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="0"
          step="1"
          value={discount.value || ""}
          onChange={event => onChange({ ...discount, value: Math.max(0, Number(event.target.value) || 0) })}
          placeholder="0"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200"
        />
        {discount.value > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...discount, value: 0 })}
            className="rounded-lg px-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}

function MethodButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition-colors active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 " +
        (active
          ? "border-slate-900 bg-slate-100 text-slate-950"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900")
      }
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
