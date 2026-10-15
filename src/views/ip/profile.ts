import { t } from "@/i18n";
import { referenceScore } from "@/lib/ip-assessment";
import { coffeeThreatLabels, type CoffeeIp } from "./coffee.ts";

export function ipProfile(data: CoffeeIp) {
  const score = referenceScore(data.trust_score);
  const companyTypes: Record<string, string> = {
    isp: t("网络运营商"),
    hosting: t("托管服务商"),
    business: t("商业企业"),
    education: t("教育机构"),
    government: t("政府机构"),
    banking: t("金融机构"),
  };
  const companyType = data.company_type?.trim().toLowerCase();
  const company = companyType
    ? (companyTypes[companyType] ?? data.company_type!)
    : t("未知");
  const conflict = data.isResidential === true && data.is_datacenter === true;
  const type = data.is_public_service
    ? t("公共服务")
    : conflict
      ? t("类型标记冲突")
      : data.is_mobile
        ? t("移动网络")
        : data.isResidential
          ? t("家庭住宅 IP")
          : data.is_datacenter
            ? t("数据中心")
            : t("未知");
  const country = data.countryCode?.trim().toUpperCase();
  const registered = data.registered_country_code?.trim().toUpperCase();
  const sameCountry =
    country && registered && !data.is_public_service
      ? country === registered
      : null;
  const flags: [string, boolean | undefined][] = [
    ["VPN", data.is_vpn],
    [t("代理"), data.is_proxy],
    ["Tor", data.is_tor],
    [t("爬虫标记"), data.is_crawler],
    [t("滥用标记"), data.is_abuser],
    ["Bogon", data.is_bogon],
  ];
  const detected = flags
    .filter(([, value]) => value === true)
    .map(([label]) => label);
  const unknownFlags = flags.filter(
    ([, value]) => typeof value !== "boolean",
  ).length;
  const threats = coffeeThreatLabels(data, true);
  const clear = !detected.length && !unknownFlags && !threats.length;
  // Network type and registration are facts, never a universal quality ranking.
  const preferred = false;
  const seriousFlags = [
    ...(data.is_abuser ? [t("滥用标记")] : []),
    ...(data.is_bogon ? ["Bogon"] : []),
    ...threats,
  ];
  const risk = seriousFlags.length
    ? {
        severity: "danger" as const,
        title: t("发现风险信号"),
        flags: [...new Set([...detected, ...threats])],
        description: t(
          "数据源返回滥用、保留地址或威胁记录。建议核实网络来源，必要时更换出口后重新检测。",
        ),
      }
    : detected.length
      ? {
          severity: "notice" as const,
          title: t("检测到网络标记"),
          flags: detected,
          description: t(
            "代理、VPN、Tor 或爬虫标记可能影响部分网站的访问验证；标记本身不等于恶意行为。",
          ),
        }
      : null;
  const level = null;
  let grade = t("信息不足");
  let explanation = t("缺少网络类型或风险记录，证据不足。");
  let tone: "good" | "warn" | "bad" | "neutral" = "neutral";
  if (data.is_public_service) {
    grade = t("公共服务网络");
    explanation = t(
      "公共 DNS、CDN 等服务可能使用任播，不按个人住宅或机房出口评定档位。",
    );
  } else if (conflict) {
    grade = t("类型待确认");
    explanation = t(
      "数据源同时返回住宅与数据中心标记，不能据此认定为优质住宅。",
    );
    tone = "warn";
  } else if (detected.length || threats.length) {
    grade = t("存在网络标记");
    explanation = t("已返回 {0}；代理、VPN 等标记本身不等于恶意行为。", [
      [...detected, ...threats].join("、"),
    ]);
    tone = data.is_abuser || data.is_bogon || threats.length ? "bad" : "warn";
  } else if (clear) {
    grade = t("暂未发现相关记录");
    explanation = t("单一来源未返回相关标记，尚未完成独立多源信誉核验。");
  }
  const checks: {
    label: string;
    value: string;
    requirement: string;
    passed: boolean | null;
  }[] = [
    {
      label: t("IP 类型"),
      value: type,
      requirement: t("住宅且非机房、非移动网络"),
      passed:
        data.is_public_service ||
        conflict ||
        data.is_mobile ||
        data.isResidential === false ||
        data.is_datacenter === true
          ? false
          : data.isResidential === true && data.is_datacenter === false
            ? true
            : null,
    },
    {
      label: t("厂商类型"),
      value: company,
      requirement: t("厂商类型为 ISP"),
      passed: companyType ? companyType === "isp" : null,
    },
    {
      label: t("注册地对照"),
      value:
        sameCountry === null
          ? t("待确认")
          : sameCountry
            ? t("注册地一致")
            : t("注册地不同"),
      requirement: t("注册国家与定位国家一致"),
      passed: sameCountry,
    },
    {
      label: t("网络标记"),
      value:
        detected.length || threats.length
          ? t("有标记")
          : unknownFlags
            ? t("缺少 {0} 项数据", [unknownFlags])
            : t("6 项均未检出"),
      requirement: t("六项标记均未检出，且无已知威胁"),
      passed:
        detected.length || threats.length ? false : unknownFlags ? null : true,
    },
    {
      label: t("IP 信誉分"),
      value: score === null ? t("未知") : `${score} / 100`,
      requirement: t("仅保留来源原值，不参与本站结论"),
      passed: null,
    },
  ];
  return {
    score,
    scoreBand: null,
    grade,
    explanation,
    tone,
    checks,
    preferred,
    level,
    risk,
  };
}
