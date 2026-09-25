import { describe, expect, it } from "vitest";
import {
  appendBarcodeCharacter,
  consumeBarcodeBuffer,
  EMPTY_BARCODE_BUFFER,
} from "@/lib/pos-barcode-scanner";

function typeCharacters(value: string, gapMs: number) {
  let buffer = EMPTY_BARCODE_BUFFER;
  let timestamp = 1_000;
  for (const character of value) {
    buffer = appendBarcodeCharacter(buffer, character, timestamp);
    timestamp += gapMs;
  }
  return { buffer, timestamp };
}

describe("POS barcode scanner buffer", () => {
  it("accepts fast scanner input followed by Enter", () => {
    const { buffer, timestamp } = typeCharacters("89910001", 10);
    expect(consumeBarcodeBuffer(buffer, timestamp)).toBe("89910001");
  });

  it("does not treat normal human typing as a barcode scan", () => {
    const { buffer, timestamp } = typeCharacters("89910001", 120);
    expect(consumeBarcodeBuffer(buffer, timestamp)).toBeNull();
  });

  it("rejects short input and a delayed Enter suffix", () => {
    const short = typeCharacters("12", 10);
    expect(consumeBarcodeBuffer(short.buffer, short.timestamp)).toBeNull();

    const delayed = typeCharacters("89910001", 10);
    expect(consumeBarcodeBuffer(delayed.buffer, delayed.timestamp + 150)).toBeNull();
  });

  it("starts a new buffer after a pause", () => {
    let buffer = appendBarcodeCharacter(EMPTY_BARCODE_BUFFER, "A", 1_000);
    buffer = appendBarcodeCharacter(buffer, "B", 1_010);
    buffer = appendBarcodeCharacter(buffer, "9", 1_200);
    expect(buffer.value).toBe("9");
  });
});
