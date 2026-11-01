import { useSearchParams } from "react-router-dom";
import { CopyButton } from "@/components/copy-button";
import { PageHeading } from "@/components/toolkit";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n";
import { calculateCidr } from "@/lib/cidr";

const examples = [
  "192.168.1.10/24",
  "10.0.0.0 255.255.240.0",
  "172.16.5.4/30",
  "2001:db8:abcd::1/48",
];

export default function CidrPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "192.168.1.10/24";
  const result = calculateCidr(q);
  const rows: [string, string][] = !result
    ? []
    : result.version === 4
      ? [
          [t("网络地址"), result.network],
          [t("CIDR"), result.cidr],
          [t("子网掩码"), result.mask],
          [t("通配符掩码"), result.wildcard],
          [t("广播地址"), result.broadcast],
          [t("第一个可用地址"), result.first],
          [t("最后一个可用地址"), result.last],
          [t("地址总数"), result.total.toLocaleString()],
          [t("可用主机数"), result.usable.toLocaleString()],
          [t("二进制掩码"), result.binaryMask],
        ]
      : [
          [t("网络地址"), result.network],
          [t("CIDR"), result.cidr],
          [t("最后一个地址"), result.last],
          [t("前缀长度"), `/${result.prefix}`],
          [t("地址总数"), result.total],
        ];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeading
        title={t("IP 子网 / CIDR 计算器")}
        description={t("计算网络地址、掩码、广播地址与可用主机范围")}
      />
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <label className="text-sm font-medium" htmlFor="cidr-input">
            {t("输入 IP/前缀 或 IP 与子网掩码")}
          </label>
          <Input
            id="cidr-input"
            value={q}
            spellCheck={false}
            autoComplete="off"
            inputMode="text"
            onChange={(event) =>
              setParams({ q: event.target.value }, { replace: true })
            }
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded border px-2 py-1 text-muted-foreground hover:text-foreground"
                onClick={() => setParams({ q: example }, { replace: true })}
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {result ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="flex min-w-0 items-center gap-1 font-mono text-sm break-all">
                    {value}
                    <CopyButton value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-destructive" role="alert">
              {t("格式无效：请输入如 192.168.1.0/24 或 2001:db8::/32")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
