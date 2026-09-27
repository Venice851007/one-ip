import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { t } from "@/i18n";
import { siteConfig, type AdSlotName } from "@/lib/site-config";
import { useAdConsent } from "./consent";

let scriptRequested = false;
function loadAdSense(client: string) {
  if (scriptRequested) return;
  scriptRequested = true;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.append(script);
}

function AdUnit({ client, slot }: { client: string; slot: string }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    loadAdSense(client);
    if (!ref.current || ref.current.dataset.adsbygoogleStatus) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* Ad blockers or unfilled slots must never break the page. */
    }
  }, [client, slot]);
  return (
    <ins
      ref={ref}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

/**
 * Renders nothing unless the Worker injected an AdSense client and a slot ID
 * for this position, and the visitor accepted the consent banner.
 * Remounts on route change so single-page navigation requests a fresh ad.
 */
export function AdSlot({ name }: { name: AdSlotName }) {
  const { pathname } = useLocation();
  const consent = useAdConsent();
  const ads = siteConfig().ads;
  const slot = ads?.slots[name];
  if (!ads || !slot || consent !== "granted") return null;
  return (
    <aside className="ad-slot" aria-label={t("广告")} data-slot-name={name}>
      <AdUnit key={`${pathname}:${name}`} client={ads.client} slot={slot} />
    </aside>
  );
}
