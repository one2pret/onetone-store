"use client";

import { useEffect, useRef } from "react";
import {
  appendBarcodeCharacter,
  consumeBarcodeBuffer,
  EMPTY_BARCODE_BUFFER,
} from "@/lib/pos-barcode-scanner";

export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const callbackRef = useRef(onScan);
  const bufferRef = useRef(EMPTY_BARCODE_BUFFER);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = EMPTY_BARCODE_BUFFER;
      return;
    }

    function handleScannerKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, [contenteditable='true']") ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      ) return;

      const timestamp = performance.now();
      if (event.key === "Enter") {
        const code = consumeBarcodeBuffer(bufferRef.current, timestamp);
        bufferRef.current = EMPTY_BARCODE_BUFFER;
        if (!code) return;
        event.preventDefault();
        callbackRef.current(code);
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current = appendBarcodeCharacter(bufferRef.current, event.key, timestamp);
      }
    }

    window.addEventListener("keydown", handleScannerKey, true);
    return () => window.removeEventListener("keydown", handleScannerKey, true);
  }, [enabled]);
}
