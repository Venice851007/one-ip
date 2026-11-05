import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { referenceScore, type explainIpAssessment } from "@/lib/ip-assessment";

type Explanation = ReturnType<typeof explainIpAssessment>;
const summaries = {
  review_records: t("存在待核实风险"),
  review_conflicts: t("来源存在分歧"),
  incomplete_evidence: t("证据不足"),
  anonymity_reported: t("存在匿名用途标记"),
  no_records_reported: t("暂未发现相关记录"),
};

export function AssessmentVerdict({
  assessment,
  prominent = false,
}: {
  assessment: Explanation;
  prominent?: boolean;
}) {
  const warning =
    assessment.summary === "review_records" ||
    assessment.summary === "review_conflicts";
  return (
    <div className="space-y-1.5" role="status">
      <p
        className={`${prominent ? "text-lg" : "text-sm"} font-semibold ${warning ? "text-amber-800 dark:text-amber-300" : "text-foreground"}`}
      >
        {summaries[assessment.summary]}
      </p>
      {assessment.findings
        .filter((finding) => finding !== assessment.summary)
        .map((finding) => (
          <Badge
            key={finding}
            variant="secondary"
            className="mr-1 whitespace-normal"
          >
            {summaries[finding as keyof typeof summaries]}
          </Badge>
        ))}
    </div>
  );
}

export function ProviderReference({ value }: { value: unknown }) {
  const score = referenceScore(value);
  return (
    <span className="text-xs font-normal text-muted-foreground">
      {t("Net.Coffee 原始分：{0}", [
        score === null ? t("未知") : `${score}/100`,
      ])}
    </span>
  );
}
