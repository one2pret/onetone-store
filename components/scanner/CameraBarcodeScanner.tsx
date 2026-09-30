"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new () => BarcodeDetectorInstance;

type Props = {
  onScan: (code: string) => void;
  label?: string;
  className?: string;
};

function getBarcodeDetector(): BarcodeDetectorConstructor | null {
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector ?? null;
}

export function CameraBarcodeScanner({ onScan, label = "Scan kamera", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef(onScan);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stream: MediaStream | null = null;
    let videoElement: HTMLVideoElement | null = null;

    async function start() {
      const Detector = getBarcodeDetector();
      if (!Detector || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        toast.error("Kamera scanner tidak didukung browser ini. Gunakan Chrome Android, scanner hardware, atau input manual.");
        setOpen(false);
        return;
      }

      setStarting(true);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) throw new Error("Preview kamera tidak tersedia");
        videoElement = video;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector();

        const detect = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const code = results.find(result => result.rawValue.trim())?.rawValue.trim();
            if (code) {
              navigator.vibrate?.(40);
              callbackRef.current(code);
              setOpen(false);
              return;
            }
          } catch {
            // Frame may be unreadable while autofocus is settling; retry quietly.
          }
          timer = setTimeout(detect, 180);
        };

        detect();
      } catch (error) {
        const message = error instanceof DOMException && error.name === "NotAllowedError"
          ? "Izin kamera ditolak. Izinkan kamera pada pengaturan browser lalu coba lagi."
          : "Kamera tidak dapat dibuka. Gunakan scanner hardware atau input manual.";
        toast.error(message);
        setOpen(false);
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, [open]);

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-accent ${className}`}
    >
      <Camera className="h-4 w-4" />
      {label}
    </button>

    {open && <div role="dialog" aria-modal="true" aria-label="Scanner barcode kamera" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-slate-950 text-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div><p className="font-semibold">Arahkan kamera ke barcode atau QR</p><p className="text-xs text-slate-300">Kode hanya dibaca di perangkat dan tidak direkam.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Tutup kamera" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
          {starting && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="h-7 w-7 animate-spin" /></div>}
        </div>
        <p className="px-4 py-3 text-center text-xs text-slate-300">Pastikan kode terang, tidak terpotong, dan berada di dalam bingkai.</p>
      </div>
    </div>}
  </>;
}
