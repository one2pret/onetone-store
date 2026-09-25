export type BarcodeBuffer = {
  value: string;
  startedAt: number;
  lastAt: number;
};

export const EMPTY_BARCODE_BUFFER: BarcodeBuffer = {
  value: "",
  startedAt: 0,
  lastAt: 0,
};

const MAX_CHARACTER_GAP_MS = 80;
const MAX_AVERAGE_GAP_MS = 50;
const MAX_ENTER_GAP_MS = 100;
const MIN_BARCODE_LENGTH = 3;

export function appendBarcodeCharacter(
  buffer: BarcodeBuffer,
  character: string,
  timestamp: number,
): BarcodeBuffer {
  if (character.length !== 1) return buffer;

  const startsNewScan = buffer.lastAt > 0 && timestamp - buffer.lastAt > MAX_CHARACTER_GAP_MS;
  if (!buffer.value || startsNewScan) {
    return { value: character, startedAt: timestamp, lastAt: timestamp };
  }

  return {
    ...buffer,
    value: buffer.value + character,
    lastAt: timestamp,
  };
}

export function consumeBarcodeBuffer(buffer: BarcodeBuffer, timestamp: number): string | null {
  if (buffer.value.length < MIN_BARCODE_LENGTH || timestamp - buffer.lastAt > MAX_ENTER_GAP_MS) {
    return null;
  }

  const characterIntervals = Math.max(1, buffer.value.length - 1);
  const averageGap = (buffer.lastAt - buffer.startedAt) / characterIntervals;
  return averageGap <= MAX_AVERAGE_GAP_MS ? buffer.value : null;
}
