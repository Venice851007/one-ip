import { t } from "@/i18n";
import site from "@/seo/site.json";
import { ApiCodeBlock } from "./api-code-block";

const example = JSON.stringify(
  {
    ip: "203.0.113.10",
    checked_at: "2026-09-11T08:00:00.000Z",
    score: 85,
    status: "good",
    country: "Singapore",
    region: null,
    city: "Singapore",
    isp: "Example ISP",
    asn: 64496,
    flags: {
      residential: true,
      datacenter: false,
      mobile: false,
      vpn: false,
      proxy: false,
      tor: false,
      crawler: false,
      abuser: false,
    },
  },
  null,
  2,
);

export default function ApiUsagePage() {
  const endpoint = `${window.location.origin}/api/ip/health`;
  const command = `curl -fsS '${endpoint}?version=2'`;
  return (
    <article className="api-usage mx-auto max-w-4xl space-y-6 py-4 sm:py-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {t("我的 IP 信息 API")}
      </h1>
      <p className="leading-7 text-muted-foreground">
        {t(
          "IP 查询工具提供公开 API，可查询请求出口的 IP、位置信息、ASN、信誉分和风险标记，无需 API Key。",
        )}
      </p>
      <p className="break-words leading-7">
        {t("接口地址：")}{" "}
        <a
          className="text-primary underline underline-offset-4"
          href={endpoint}
          target="_blank"
          rel="noreferrer"
        >
          {endpoint}
        </a>
      </p>
      <ApiCodeBlock code={command} language="bash" />
      <p className="text-sm leading-6 text-muted-foreground">
        {t(
          "兼容版 status 仅表示 Net.Coffee 分数分档，不是安全结论。添加 version=2 可分别取得来源信誉与风险记录。",
        )}
      </p>
      <ApiCodeBlock
        code={`curl -fsS '${endpoint}?version=2'`}
        language="bash"
      />
      <a
        className="inline-block text-sm text-primary hover:underline"
        href={site.blog}
        target="_blank"
        rel="noopener"
      >
        {t("完整使用文档")} ↗
      </a>
      <p className="text-sm leading-6 text-muted-foreground">
        {t(
          "添加 ?ip=1.1.1.1 可查询指定公网 IPv4 / IPv6；添加 ?format=text 返回终端文本。",
        )}
      </p>
      <section className="space-y-4 pt-6">
        <h2 className="text-2xl font-semibold">{t("兼容版示例输出")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("以下为示意数据，并非实时查询结果。")}
        </p>
        <ApiCodeBlock code={example} language="json" />
        <p className="text-sm leading-6 text-muted-foreground">
          {t(
            "score 是 Net.Coffee 原始分，旧 status / band 仅保留数值分档兼容，不代表安全等级。请以 version=2 的评估结论和风险记录为准；未知字段为 null，收到 429 后请稍后重试。",
          )}
        </p>
      </section>
    </article>
  );
}
