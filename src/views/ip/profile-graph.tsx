import { useLayoutEffect, useRef, useState } from "react";
import { ToolCard } from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { t } from "@/i18n";
import { gsap } from "gsap";
import { Info } from "lucide-react";
import type { CoffeeIp } from "./coffee";
import type { ipProfile } from "./profile";
import { ipProfileFields } from "./profile-fields";
import { ScenarioPanel } from "./scenario-panel";
import type { useIpLatency } from "./use-ip-latency";

export default function IpProfileGraph({
  data,
  profile,
  inbound,
}: {
  inbound: ReturnType<typeof useIpLatency>;
  data: CoffeeIp;
  profile: ReturnType<typeof ipProfile>;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const fieldsRef = useRef<HTMLDListElement>(null);
  const fields = ipProfileFields(data, profile);
  const active = selected === null ? null : fields[selected];
  useLayoutEffect(() => {
    const list = fieldsRef.current;
    if (!list) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const items = list.querySelectorAll(":scope > div");
      const tween = gsap.fromTo(
        items,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.045,
          ease: "power2.out",
          clearProps: "opacity,transform",
        },
      );
      return () => tween.kill();
    });
    return () => media.revert();
  }, [data.ip]);
  return (
    <>
      <ToolCard title={t("IP 画像")}>
        <dl ref={fieldsRef} className="ip-profile-fields">
          {fields.map((field, index) => (
            <div key={field.label}>
              <dt>
                <span>{field.label}</span>
                <button
                  type="button"
                  aria-label={t("解释 {0}", [field.label])}
                  onClick={() => setSelected(index)}
                >
                  <Info size={14} aria-hidden="true" />
                </button>
              </dt>
              <dd className="flex flex-wrap items-center gap-1">
                <Badge variant={field.tone ?? "info"}>{field.value}</Badge>
                {field.special && (
                  <Badge variant="outline">{t("特殊类型")}</Badge>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <ResponsiveDialog
          open={active !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={active?.label ?? ""}
          description={t("查看各类含义与当前 IP 的归类")}
        >
          {active && (
            <>
              <div className="ip-profile-current">
                <span>{t("当前 IP")}</span>
                <strong>{active.value}</strong>
                {active.detail && <p>{active.detail}</p>}
              </div>
              <dl className="ip-profile-catalog">
                {active.options.map((option) => (
                  <div
                    key={option.label}
                    data-current={option.current || undefined}
                  >
                    <dt>
                      <strong>{option.label}</strong>
                      {option.status ? (
                        <span>{option.status}</span>
                      ) : (
                        option.current && <span>{t("当前归类")}</span>
                      )}
                    </dt>
                    <dd>{option.description}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </ResponsiveDialog>
      </ToolCard>
      <ScenarioPanel ip={data.ip} inbound={inbound} />
    </>
  );
}
