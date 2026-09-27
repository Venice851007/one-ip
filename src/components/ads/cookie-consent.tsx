import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { siteConfig } from "@/lib/site-config";
import { setAdConsent, useAdConsent } from "./consent";

/** Shown only when ads are configured and the visitor has not chosen yet. */
export function CookieConsent() {
  const consent = useAdConsent();
  if (!siteConfig().ads || consent) return null;
  return (
    <div
      className="cookie-consent"
      role="dialog"
      aria-live="polite"
      aria-label={t("Cookie 与广告")}
    >
      <p>
        {t(
          "本站使用 Google AdSense 展示广告，广告服务可能使用 Cookie 进行个性化和效果统计。",
        )}{" "}
        <Link to="/privacy">{t("隐私政策")}</Link>
      </p>
      <div className="cookie-consent-actions">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdConsent("denied")}
        >
          {t("拒绝")}
        </Button>
        <Button size="sm" onClick={() => setAdConsent("granted")}>
          {t("同意")}
        </Button>
      </div>
    </div>
  );
}
