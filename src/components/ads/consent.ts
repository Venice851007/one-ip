import { useSyncExternalStore } from "react";

export type AdConsent = "granted" | "denied" | null;
const key = "ip-tools:ads-consent";
const event = "ip-tools:ads-consent";
let memory: AdConsent = null;

function read(): AdConsent {
  try {
    const value = localStorage.getItem(key);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setAdConsent(value: Exclude<AdConsent, null>) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage blocked: the choice lasts for this page view only. */
    memory = value;
  }
  window.dispatchEvent(new Event(event));
}

function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(event, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useAdConsent(): AdConsent {
  return useSyncExternalStore(
    subscribe,
    () => read() ?? memory,
    () => null,
  );
}
