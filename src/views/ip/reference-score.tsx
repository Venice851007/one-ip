import { t } from "@/i18n";
import type { scoreIpEvidence } from "@/lib/ip-assessment";
import { AssessmentVerdict } from "./assessment-verdict";
import type { CoffeeLookup } from "./coffee";
import { useIpAssessment } from "./use-ip-assessment";

type Scoring = ReturnType<typeof scoreIpEvidence>;
const bands = {
  unavailable: t("暂不评分"),
  higher_reference: t("参考较高"),
  caution: t("需留意"),
  review: t("重点核实"),
};
export const scoreRuleLabels = {
  single_reputation_source: t("单一信誉来源"),
  asn_evidence_missing: t("ASN 风险证据不足"),
  asn_drop_record: t("ASN 命中严重风险名单"),
  incomplete_evidence: t("资料缺失或来源失效"),
  conflicting_evidence: t("来源或类型分歧"),
  tor_exit: t("Tor 出口标记"),
  proxy: t("代理标记"),
  vpn_exit: t("VPN 标记"),
  crawler: t("爬虫用途标记"),
  abuse_record: t("滥用记录"),
  other_threat_record: t("其他威胁记录"),
  bogon_record: t("Bogon 异常记录"),
};

export function ReferenceScore({
  scoring,
  loading = false,
  compact = false,
}: {
  scoring: Scoring;
  loading?: boolean;
  compact?: boolean;
}) {
  const value = loading ? null : scoring.value;
  const tone =
    value === null
      ? "text-muted-foreground"
      : value >= 80
        ? "text-primary"
        : value >= 50
          ? "text-amber-700 dark:text-amber-400"
          : "text-red-700 dark:text-red-400";
  return (
    <div className={compact ? "space-y-1" : "space-y-2"} aria-busy={loading}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs text-muted-foreground">
          {t("本站参考评分")}
        </span>
        <strong
          className={`${compact ? "text-2xl" : "text-4xl"} font-semibold tabular-nums ${tone}`}
        >
          {value === null ? "—" : value}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            /100
          </span>
        </strong>
        <span className={`text-sm ${tone}`}>
          {loading ? t("来源核验中…") : bands[scoring.band]}
        </span>
      </div>
      {!compact && (
        <>
          <div
            role="meter"
            aria-label={t("本站参考评分")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value ?? undefined}
            aria-valuetext={
              loading
                ? t("来源核验中…")
                : value === null
                  ? t("暂不评分")
                  : `${value}/100`
            }
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            {value !== null && (
              <div
                className="h-full rounded-full bg-current transition-[width] duration-300"
                style={{
                  width: `${value}%`,
                  color:
                    value >= 80
                      ? "var(--primary)"
                      : value >= 50
                        ? "var(--warning)"
                        : "var(--danger)",
                }}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "本站试行规则分，越高表示当前记录限制较少；不是安全概率，也不保证网站或账号可用。",
            )}
          </p>
          {!loading && scoring.value === null && (
            <p className="text-xs text-muted-foreground">
              {t("缺少有效来源分或风险字段不足，暂不补分。")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function HomeIpScore({ data }: { data: CoffeeLookup }) {
  const { assessment, scoring, query } = useIpAssessment(data);
  return (
    <div className="mt-2 space-y-2">
      <ReferenceScore scoring={scoring} loading={query.isFetching} compact />
      <AssessmentVerdict assessment={assessment} />
    </div>
  );
}
