import { useSearchParams } from "react-router-dom";
import { LookupFaq } from "@/components/lookup-faq";
import { LookupForm } from "@/components/lookup-form";
import {
  PageHeading,
  ToolCard,
  Facts,
  ErrorNotice,
  Pending,
} from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLookupHistory } from "@/hooks/use-lookup-history";
import { t, locale } from "@/i18n";
import { whoisFaq } from "@/seo/faq";
import { useQuery } from "@tanstack/react-query";
import type { Registration } from "./api";
import { lookupWhois } from "./api";

export default function WhoisPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const history = useLookupHistory<Registration>("ip-tools:whois-history:v1");
  const cached = history.find(q);
  const query = useQuery({
    queryKey: ["whois", q],
    enabled: !!q,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await lookupWhois(q, signal);
      history.save(q, result);
      return result;
    },
    retry: false,
  });
  const data = query.data?.data;
  return (
    <div className="lookup-page">
      <div className="lookup-search-card">
        <PageHeading
          title={t("WHOIS 查询")}
          description={t("查询域名、IP 或 ASN 注册信息")}
        />
        <LookupForm
          grouped
          value={q}
          placeholder={t("输入域名、IP 地址或 AS 号")}
          busy={query.isFetching}
          onSubmit={(value) =>
            value === q ? void query.refetch() : setParams({ q: value })
          }
        />
      </div>
      <Card className="mt-3">
        <CardContent>
          <div className="examples lookup-history">
            <span>
              {history.entries.length ? t("最近查询") : t("推荐查询")}
            </span>
            {(history.entries.length
              ? history.entries.map((entry) => entry.query)
              : ["qq.com", "1.1.1.1", "AS15169"]
            ).map((value) => (
              <Badge key={value} variant="secondary" asChild>
                <button
                  type="button"
                  className="cursor-pointer rounded-md px-2 py-1 h-auto hover:bg-accent"
                  onClick={() => setParams({ q: value })}
                >
                  {value}
                </button>
              </Badge>
            ))}
          </div>
          {cached && (
            <p className="small muted">
              {t("已保存的查询结果 ·")}{" "}
              {new Date(cached.savedAt).toLocaleString(locale)}
              {t("，点击查询可更新")}
            </p>
          )}
        </CardContent>
      </Card>
      <ErrorNotice error={query.error} />
      {query.isFetching && (
        <p className="status-line">
          <Pending>{t("正在向注册局查询…")}</Pending>
        </p>
      )}
      {data && (
        <div className="lookup-results">
          <h2 className="whois-result-name">
            {data.ldhName ?? data.name ?? q}
          </h2>
          <div className="whois-grid">
            <ToolCard title={t("基础信息")}>
              <Facts
                rows={[
                  [
                    t("查询协议"),
                    query.data?.source ? t(query.data.source) : undefined,
                  ],
                  [t("对象类型"), data.objectClassName],
                  [t("标识符"), data.handle],
                  [t("国家 / 地区"), data.country],
                  ...(data.startAddress
                    ? [
                        [
                          t("地址范围"),
                          `${data.startAddress} – ${data.endAddress}`,
                        ] as [string, string],
                      ]
                    : []),
                ]}
              />
            </ToolCard>
            {data.events?.length ? (
              <ToolCard title={t("注册时间")}>
                <Facts
                  rows={data.events.map((event) => [
                    event.eventAction,
                    new Date(event.eventDate).toLocaleString(locale),
                  ])}
                />
              </ToolCard>
            ) : null}
            {data.status?.length ? (
              <ToolCard title={t("域名状态")}>
                <div className="whois-tags">
                  {data.status.map((status) => (
                    <Badge variant="secondary" key={status}>
                      {status}
                    </Badge>
                  ))}
                </div>
              </ToolCard>
            ) : null}
            {data.nameservers?.length ? (
              <ToolCard title={t("DNS 服务器")}>
                <div className="whois-tags">
                  {data.nameservers.map((server, index) => (
                    <Badge variant="secondary" key={index}>
                      {server.ldhName}
                    </Badge>
                  ))}
                </div>
              </ToolCard>
            ) : null}
            {data.entities?.map((entity, index) => (
              <ToolCard
                key={index}
                title={entity.roles?.join(" / ") ?? t("注册实体")}
              >
                <Facts rows={[[t("标识符"), entity.handle ?? t("隐私保护")]]} />
              </ToolCard>
            ))}
          </div>
          <details className="raw-details">
            <summary>{t("查看原始 RDAP 数据")}</summary>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      )}
      <LookupFaq
        items={whoisFaq.map((item) => ({
          title: t(item.title),
          text: t(item.text),
        }))}
      />
    </div>
  );
}
