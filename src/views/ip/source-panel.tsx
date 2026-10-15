import { ToolCard } from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { t } from "@/i18n";
import { IpAssessmentPanel } from "./assessment-panel";
import type { CoffeeLookup } from "./coffee";
import {
  compareField,
  evidenceFields,
  type SourceObservation,
} from "./source-evidence";
import { useIpAssessment } from "./use-ip-assessment";

const labels = {
  country_code: t("国家"),
  asn: "ASN",
  tor_exit: t("Tor 出口"),
  vpn_exit: t("VPN 出口"),
  proxy: t("来源代理标记"),
  abuse: t("滥用记录"),
};
const states = {
  available: t("已取得数据"),
  stale: t("数据已过期"),
  not_configured: t("未导入数据库"),
  no_record: t("未收录"),
  unavailable: t("来源不可用"),
  sample: t("样例，不参与核验"),
};
const comparisons = {
  different: t("来源分歧"),
  consistent: t("结果一致"),
  single: t("单一来源"),
  unknown: t("证据不足"),
};
function display(source: SourceObservation, field: string) {
  if (!source.capabilities.includes(field)) return t("不支持此字段");
  if (source.state !== "available") return states[source.state];
  const value = source.fields[field];
  return typeof value === "boolean"
    ? value
      ? t("检出")
      : t("未检出")
    : typeof value === "string" && value
      ? value
      : t("未知");
}
const date = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : t("未知");

export function SourceEvidencePanel({ data }: { data: CoffeeLookup }) {
  const { query, sources, assessment, scoring } = useIpAssessment(data);
  return (
    <>
      <IpAssessmentPanel
        assessment={assessment}
        scoring={scoring}
        loading={query.isFetching}
        referenceScore={
          data.sourceState === "unavailable"
            ? undefined
            : data.coffee.trust_score
        }
      />
      <ToolCard title={t("免费来源核验")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {data.sourceState === "unavailable"
              ? t("信誉数据暂缺")
              : t("信誉：仅 Net.Coffee 参考")}
          </Badge>
          {assessment.abuse.reported && (
            <Badge variant="warning">{t("来源记录了滥用活动，请核实")}</Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? t("查询中…") : t("刷新核验")}
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t(
            "免费库分别核验国家、ASN 和 Tor 出口，不提供第二家综合信誉评分。未检出不等于不存在风险。",
          )}
        </p>
        {query.error && (
          <p role="status" className="mb-2 text-xs text-muted-foreground">
            {t("免费来源暂不可用，保留已有来源结果。")}
          </p>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("核验字段")}</TableHead>
                {sources.map((source) => (
                  <TableHead key={source.id}>{source.name}</TableHead>
                ))}
                <TableHead>{t("核验结论")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidenceFields.map((field) => {
                const comparison = compareField(sources, field);
                return (
                  <TableRow key={field}>
                    <TableCell>{labels[field]}</TableCell>
                    {sources.map((source) => (
                      <TableCell key={source.id}>
                        {query.isFetching && source.state === "unavailable"
                          ? t("查询中…")
                          : display(source, field)}
                      </TableCell>
                    ))}
                    <TableCell>
                      <Badge
                        variant={
                          comparison.state === "different"
                            ? "warning"
                            : "secondary"
                        }
                      >
                        {comparisons[comparison.state]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary>{t("来源时间与许可")}</summary>
          {sources.map((source) => (
            <div key={source.id} className="mt-2">
              <a
                className="underline"
                href={source.source}
                target="_blank"
                rel="noreferrer"
              >
                {source.name}
              </a>
              {" · "}
              {states[source.state]}
              <p>
                {t("查询时间：{0}；数据版本时间：{1}", [
                  date(source.queried_at),
                  date(source.dataset_updated_at),
                ])}
              </p>
              <p>
                {t("最近观测：{0}", [date(source.observed_at ?? undefined)])}
              </p>
              {source.license && <p>{source.license}</p>}
            </div>
          ))}
          <p className="mt-2">
            {t(
              "IPinfo Lite 数据来源为 IPinfo（CC BY-SA 4.0）；Tor Project 出口记录为 CC0。归属地一致不能证明原生线路，网络类型与匿名用途可以同时成立。",
            )}
          </p>
        </details>
      </ToolCard>
    </>
  );
}
