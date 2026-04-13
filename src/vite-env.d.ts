/// <reference types="vite/client" />

// Minimal Web NFC typings for TS (Android Chrome).
// https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API
declare class NDEFReader {
  constructor();
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((event: { serialNumber?: string }) => void) | null;
  onreadingerror: ((event: unknown) => void) | null;
}
