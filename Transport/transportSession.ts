const SESSION_KEY = "cp_transport_admin_session";

export function setTransportSession(): void {
  const payload = { at: new Date().toISOString(), role: "transport_admin" as const };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function clearTransportSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function isTransportAuthenticated(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { role?: string };
    return parsed.role === "transport_admin";
  } catch {
    return false;
  }
}

/** Demo credentials (replace with backend auth later). */
export const TRANSPORT_DEMO_EMAIL = "transport@conventpulse.edu";
export const TRANSPORT_DEMO_PASSWORD = "Transport@123";

export function validateTransportCredentials(email: string, password: string): boolean {
  const e = email.trim().toLowerCase();
  return e === TRANSPORT_DEMO_EMAIL.toLowerCase() && password === TRANSPORT_DEMO_PASSWORD;
}
