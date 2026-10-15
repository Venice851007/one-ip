import { ToolCard } from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import type { explainIpAssessment } from "@/lib/ip-assessment";
import { AssessmentVerdict, ProviderReference } from "./assessment-verdict";

type Explanation = ReturnType<typeof explainIpAssessment>;
const fieldNames = {
  country_code: t("国家"),
  asn: "ASN",
  vpn_exit: t("VPN 出口"),
  proxy: t("来源代理标记"),
  tor_exit: t("Tor 出口"),
  abuse: t("滥用记录"),
};
const fieldStates = {
  conflict: t("来源分歧"),
  unknown: t("证据不足"),
  detected: t("检出"),
  not_detected: t("未检出"),
  reported: t("已取得数据"),
};
const supportNames = {
  none: t("证据不足"),
  single: t("单一来源"),
  multiple: t("多个来源报告"),
};
const networkLabels = {
  isResidential: t("住宅线路"),
  is_datacenter: t("数据中心"),
  is_mobile: t("移动网络"),
  is_public_service: t("公共服务"),
  is_crawler: t("爬虫标记"),
};
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString() : t("未知");

export function IpAssessmentPanel({
  assessment,
  loading = false,
  referenceScore,
}: {
  assessment: Explanation;
  loading?: boolean;
  referenceScore?: number;
}) {
  const networkTags = Object.entries(assessment.network.flags)
    .filter(([, value]) => value === true)
    .map(([key]) => networkLabels[key as keyof typeof networkLabels]);
  return (
    <ToolCard title={t("IP 风险判断")}>
      <div aria-busy={loading} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AssessmentVerdict assessment={assessment} prominent />
          {loading && (
            <span className="text-xs text-muted-foreground">
              {t("查询中…")}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {t("已取得 {0}/{1} 项核验字段", [
              assessment.coverage.available,
              assessment.coverage.total,
            ])}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            "保留 Net.Coffee 原始信誉分，按证据解释网络用途与风险记录；本页不另算综合安全分。",
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            "滥用、VPN 和代理仍仅由 Net.Coffee 提供，尚未完成独立多源信誉核验。",
          )}
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">{t("查看来源原始分")}</summary>
          <p className="mt-2">
            <ProviderReference value={referenceScore} />
          </p>
          <p className="mt-1">
            {t(
              "该数值未经本站校准，不用来评定安全等级，也不代表风险发生概率。",
            )}
          </p>
        </details>
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-xl border p-3">
            <h3 className="mb-2 text-sm font-medium">{t("网络属性")}</h3>
            <div className="flex flex-wrap gap-1.5">
              {networkTags.length ? (
                networkTags.map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))
              ) : (
                <Badge variant="secondary">{t("类型证据不足")}</Badge>
              )}
              {assessment.network.type_conflict && (
                <Badge variant="warning">{t("类型标记冲突")}</Badge>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "机房、住宅、移动和公共服务描述网络属性；这些标签本身不证明存在滥用。",
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("来源：Net.Coffee；未返回的标签保留未知。")}
            </p>
          </section>
          <section className="rounded-xl border p-3">
            <h3 className="mb-2 text-sm font-medium">{t("匿名用途")}</h3>
            <dl className="space-y-1.5 text-xs">
              {(["vpn_exit", "proxy", "tor_exit"] as const).map((key) => {
                const field = assessment.fields[key];
                return (
                  <div
                    key={key}
                    className="flex flex-wrap justify-between gap-1"
                  >
                    <dt>{fieldNames[key]}</dt>
                    <dd>
                      {fieldStates[field.state]} · {supportNames[field.support]}
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "匿名用途与恶意行为分别判断；来源分歧保留，未检出不能排除匿名用途。",
              )}
            </p>
          </section>
          <section className="rounded-xl border p-3">
            <h3 className="mb-2 text-sm font-medium">{t("滥用与异常记录")}</h3>
            <p className="text-sm">
              {t("滥用记录")}：{fieldStates[assessment.fields.abuse.state]} ·{" "}
              {supportNames[assessment.fields.abuse.support]}
            </p>
            {assessment.abuse.bogon === true && (
              <p className="mt-1 text-xs">
                {t("来源报告了 Bogon 标记，请核实地址分类。")}
              </p>
            )}
            {assessment.abuse.threats.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs">
                {assessment.abuse.threats.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "当前滥用记录仅由 Net.Coffee 提供，记录时间未知；来源高分不会消除已报告的记录。",
              )}
            </p>
          </section>
          <section className="rounded-xl border p-3">
            <h3 className="mb-2 text-sm font-medium">{t("ASN 环境")}</h3>
            <p className="text-sm">{t("网络信誉未评估")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(
                "ASN 归属可按来源核验；尚无 ASN 滥用占比数据，不因同网段其他地址的行为连带评判该 IP。",
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ASN：
              {assessment.fields.asn.reports
                .map((report) => report.value)
                .filter((value, index, all) => all.indexOf(value) === index)
                .join(" / ") || t("未知")}{" "}
              · {supportNames[assessment.fields.asn.support]}
            </p>
          </section>
        </div>
        {(assessment.coverage.conflicts.length > 0 ||
          assessment.network.type_conflict) && (
          <p
            role="status"
            className="text-xs text-amber-700 dark:text-amber-400"
          >
            {t("请保留分歧并核实来源，不能用多数票覆盖相反记录。")}
          </p>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {t("查看判断规则与证据时间")}
          </summary>
          <p className="mt-2">
            {t(
              "来源数量表示报告服务数量，上游数据库的独立性尚未验证；字段覆盖数不代表安全概率或置信度。",
            )}
          </p>
          <p className="mt-1">
            {t(
              "滥用或异常记录优先提示核实；其次是来源分歧、证据不足与匿名用途。来源原分不改变本站结论。",
            )}
          </p>
          <p className="mt-1">
            {t(
              "数据版本时间和最近观测时间分别展示；未知时间不以查询时间替代，也不据此计算衰减。",
            )}
          </p>
          <p className="mt-1">
            {t("过期、样例、未导入和请求失败的来源不参与判断。")}
          </p>
          <div className="mt-2 space-y-2">
            {Object.entries(assessment.fields).map(([key, field]) => (
              <div key={key}>
                <strong className="font-medium">
                  {fieldNames[key as keyof typeof fieldNames]} ·{" "}
                  {fieldStates[field.state]}
                </strong>
                {field.reports.length ? (
                  field.reports.map((report) => (
                    <p key={report.source} className="mt-0.5">
                      {report.name} ·{" "}
                      {typeof report.value === "boolean"
                        ? report.value
                          ? t("检出")
                          : t("未检出")
                        : report.value}
                      <br />
                      {t("数据版本：{0}；最近观测：{1}；查询时间：{2}", [
                        time(report.dataset_updated_at),
                        time(report.observed_at),
                        time(report.queried_at),
                      ])}
                    </p>
                  ))
                ) : (
                  <p>{t("暂无可用于判断的来源记录。")}</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2">
            {t("解释规则版本：{0}", [assessment.rule_version])}
          </p>
        </details>
      </div>
    </ToolCard>
  );
}
