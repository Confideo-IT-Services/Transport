export type NfcScanResult = {
  /** Tag serial number if available (best-effort). */
  serialNumber: string;
};

function getNdefReader(): any | null {
  const w = typeof window !== "undefined" ? (window as any) : null;
  return w && typeof w.NDEFReader !== "undefined" ? w.NDEFReader : null;
}

export function isWebNfcSupported(): boolean {
  return Boolean(getNdefReader());
}

/**
 * Scan one NFC tag and resolve its serialNumber.
 *
 * Notes:
 * - Works on Android Chrome in secure contexts (HTTPS). localhost is allowed.
 * - iOS Safari does not support Web NFC.
 * - Some tags/cards may not expose a readable serialNumber via Web NFC.
 */
export async function scanOneNfcTagSerialNumber(opts?: { timeoutMs?: number }): Promise<NfcScanResult> {
  const NDEFReader = getNdefReader();
  if (!NDEFReader) {
    throw new Error("NFC not supported on this device/browser. Use Android Chrome (HTTPS) or enter UID manually.");
  }

  const timeoutMs = Math.max(2000, Number(opts?.timeoutMs || 20000));
  const reader = new NDEFReader();
  const ac = new AbortController();

  const timeoutId = window.setTimeout(() => {
    try {
      ac.abort();
    } catch {
      // ignore
    }
  }, timeoutMs);

  try {
    await reader.scan({ signal: ac.signal });
  } catch (e: any) {
    window.clearTimeout(timeoutId);
    const msg = e?.message ? String(e.message) : String(e);
    throw new Error(msg || "Failed to start NFC scan");
  }

  return await new Promise<NfcScanResult>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      try {
        ac.abort();
      } catch {
        // ignore
      }
      try {
        reader.onreading = null;
        reader.onreadingerror = null;
      } catch {
        // ignore
      }
    };

    reader.onreading = (event: any) => {
      const serial = event?.serialNumber != null ? String(event.serialNumber).trim() : "";
      cleanup();
      if (!serial) {
        return reject(new Error("NFC tag detected, but serial number was not available. Try another tag or enter UID manually."));
      }
      resolve({ serialNumber: serial });
    };

    reader.onreadingerror = () => {
      cleanup();
      reject(new Error("NFC read error. Hold the tag near the phone and try again."));
    };
  });
}

