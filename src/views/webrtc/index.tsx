import { useState } from "react";
import { AnimatedValue } from "@/components/animated-value";
import { CountryFlag } from "@/components/country-flag";
import { LookupFaq } from "@/components/lookup-faq";
import {
  ActionButton,
  ErrorNotice,
  DataTable,
  IpText,
  Pending,
} from "@/components/toolkit";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { t } from "@/i18n";
import type { RtcResult } from "@/lib/types";
import { webrtcFaq } from "@/seo/faq";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { runWebRtc } from "./api";

const columns: ColumnDef<RtcResult>[] = [
  { id: "number", header: "#", cell: ({ row }) => row.index + 1 },
  {
    accessorKey: "ip",
    header: t("IP 地址"),
    cell: ({ row }) => <IpText ip={row.original.ip} />,
  },
  { accessorKey: "type", header: t("类型") },
  {
    id: "geo",
    header: t("归属地"),
    cell: ({ row }) =>
      row.original.geo ? (
        <>
          <CountryFlag code={row.original.geo.country_code} />{" "}
          {row.original.geo.country ?? ""} {row.original.geo.city ?? ""}
        </>
      ) : (
        t("未知")
      ),
  },
  {
    id: "state",
    header: t("状态"),
    cell: ({ row }) => (row.original.public ? t("请核对出口") : t("本地地址")),
  },
];
export default function WebRtcPage() {
  const [round, setRound] = useState(0);
  const query = useQuery({
    queryKey: ["webrtc-diagnostic", round],
    queryFn: ({ signal }) => runWebRtc(undefined, signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  return (
    <>
      <Card className="mb-3">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">{t("WebRTC 出口检测")}</CardTitle>
            <ActionButton
              size="sm"
              busy={query.isFetching}
              onClick={() => setRound((n) => n + 1)}
            >
              {query.isFetching ? t("检测中...") : t("重新检测")}
            </ActionButton>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div role="status">
            <AnimatedValue value={query.data?.verdict ?? query.isFetching}>
              {query.isFetching ? (
                <Pending>{t("正在采集 ICE 候选地址...")}</Pending>
              ) : (
                (query.data?.verdict ?? t("未完成检测"))
              )}
            </AnimatedValue>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("HTTP 基准出口")}</span>
            {query.data?.baseline ? (
              <IpText ip={query.data.baseline.ip} />
            ) : query.isFetching ? (
              <Pending>{t("加载中...")}</Pending>
            ) : (
              t("未知")
            )}
            <Badge variant="secondary">
              {query.data?.results.length ?? 0}
              {t("个地址")}
            </Badge>
          </div>
        </CardContent>
      </Card>
      <ErrorNotice error={query.error} />
      {Boolean(query.data?.results.length) && (
        <Card>
          <CardContent>
            <DataTable
              data={query.data?.results ?? []}
              columns={columns}
              getRowId={(row) => row.ip}
              animateChanges={false}
              animateEntries
            />
          </CardContent>
        </Card>
      )}
      <LookupFaq
        items={webrtcFaq.map((item) => ({
          title: t(item.title),
          text: t(item.text),
        }))}
      />
    </>
  );
}
