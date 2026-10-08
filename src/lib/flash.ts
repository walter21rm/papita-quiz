const KEY = "papita:flash";

/** Stores a one-time message to show on the next page. */
export function setFlashNotice(message: string): void {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // Storage can be unavailable (private mode); the notice is optional.
  }
}

export function peekFlashNotice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearFlashNotice(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
