# 免费 IP 证据接入

本版本不使用付费 API、不创建订阅。Net.Coffee 仍为唯一第三方综合信誉分来源；本站另外展示公开的试行规则参考分，详见 [完整评分规则](./ip-reference-score.md)。IPinfo Lite 只对照国家/ASN，Tor Project 只核验 Tor 出口。来源一致不能解释为安全概率。

## 已实现

- 评估解释规则 `evidence-explanation-v3` 按网络属性、匿名用途、滥用与异常记录、ASN 环境展示。保留来源原分，独立展示本站规则参考分。已报告滥用/异常优先提示核实；其后依次保留来源分歧、证据不足与匿名用途。原始分数不决定本站主结论。网络用途标签不等同恶意行为。
- 逐字段统计单源/多源报告，去除同一来源重复记录；来源数量不代表上游独立性或置信度。匿名用途与滥用分开，ASN 身份核验不等同 ASN 信誉；ASN 名单、排名与未知状态独立展示，不臆造全网滥用占比。当前也没有住宅代理专项数据，不将普通代理或住宅标记组合推断为住宅代理。
- 解释面板保留源数据版本、最近观测与查询时间，未知时间不以查询时间填充，也不为缺少日期的滥用记录臆造衰减。过期/样例/不可用数据不贡献判断。API v2 的 `assessment.conclusion` 与 `assessment.explanation` 返回同一主结论和解释规则；v2 接口会同时核验现有免费来源；首页和详情页共享相同的证据查询与评分函数。
- `GET /api/ip/evidence/{ip}` 返回独立来源、字段能力、数据时间和查询状态。未知、过期、未导入、未收录、样例和请求失败均不会记成未检出。
- Tor 官方 `exit-addresses` 按小时缓存；优先使用有效的 CC0 离线快照，否则从官方源刷新，并合并并发下载，失败退避一分钟。超过 24 小时的发布或观察记录不用于阴性/阳性结论。
- IPinfo Lite 离线 MMDB 通过 Workers Assets 读取，SHA-256 与清单核对。实例内缓存一小时，超过 7 天的数据标记过期。上限 25 MiB，超限导入失败，不自动改用其他存储或付费服务。
- 来源表保留同一字段的分歧，只比较支持且实际返回有效数据的来源。VPN/代理/滥用仍显示单源；Tor 专项不是第二家综合信誉。
- `GET /api/ip/health?ip=1.1.1.1&version=2` 分别返回 `reputation` 与 `assessment`。旧版 v1 的 `status` 仅是来源分数分档，不代表整体健康或安全；旧格式保持兼容。
- 场景表固定全部目标数，显示可读响应、拒绝、限流和未决，不再计算平均星级。连续 3 次基础响应后结束短测；有异常时最多 8 次、整轮最多 20 秒。HTTP 数值只是本次资源响应耗时，质量测速 AIM 星级仍独立保留。

## 风险主结论、本站参考分与原始分数

- 首页与详情显示本站规则参考数字，不将来源原分表述为安全等级。来源原值仍单独保留；详情页将原分收进“查看来源原始分”。不修改第三方原值。
- 有滥用、威胁或 Bogon 异常记录时提示“存在待核实风险”；来源或类型矛盾提示“来源存在分歧”；缺少核验字段、地址分类/爬虫标记或已配置来源失效时提示“证据不足”。同时保留其他已知发现，不用主结论覆盖它们。
- 只有单源阴性结果时只表述“暂未发现相关记录”，不推导已验证安全。匿名用途单独保留，网络类型不扣分。尚未配置的可选归属库继续明确显示未导入，不伪装为成功核验。
- API v1 旧 `score/status` 和 v2 的 `reputation.band` 保持兼容；v2 明确标注 `band_scope=legacy_numeric_bucket_only`、`calibration=unverified`。新版 `assessment.scoring` 使用 `ip-reference-score-v2` 输出本站参考分、原始基线与适用上限，未经统计校准。当前风险主判断读取 `assessment.conclusion`，规则版本为 `provider-evidence-v4` / `evidence-explanation-v3`。

## 导入免费 IPinfo Lite

1. 在 IPinfo 取得免费完整 `ipinfo_lite.mmdb`（不是示例文件），遵循 CC BY-SA 4.0 及署名要求。程序不处理账户密码或访问 token。
2. 在仓库运行：

   ```sh
   node scripts/import-ipinfo-lite.mjs /绝对路径/ipinfo_lite.mmdb YYYY-MM-DD
   ```

   日期使用下载页的源数据版本日，不是本地导入日；清单取其与 MMDB 内建构建时间中较早者。拒绝样例、超出资源大小预算和错误产品字段。

3. 将 `wrangler.toml` 的 `IPINFO_LITE_ENABLED` 改为 `"true"`，构建并在测试环境验证。
4. 导入文件位于 `public/ip-data/`，随静态资产构建，默认不提交完整数据库。发布时保留来源链接和数据许可；数据再分发/改编遵循数据本身许可。

未完成导入时保持 `false`，页面如实显示“未导入数据库”。不会将 SDK 自带样例或测试样例发布为完整数据库。

## 更新 Tor 出口快照

`pnpm run build` 会从 Tor 官方地址下载并校验免费 CC0 快照，供 GitHub/Cloudflare 的干净构建使用；下载超时、格式错误或数据过期时不会替换已有快照，运行时仍会校验时效并尝试官方在线源，失败时如实显示不可用。

从官方 https://check.torproject.org/exit-addresses 下载数据后运行：

```sh
node scripts/import-tor-exits.mjs /绝对路径/exit-addresses.txt
```

快照保留在静态资产目录但不提交 Git，随构建发布。源记录时间保留，导入操作不会将旧数据改标为新数据；超过时效后尝试在线刷新，失败时显示不可用。此功能不会自动创建定时任务。

## 验证与发布

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm test
pnpm run lint
pnpm run worker:dev
```

本地 `/api/me` 无法识别真实访客 IP，使用明确输入的公网 IP 检查详情页。不要把本地示例当真实访客数据。测试数据位于 `tests/fixtures/`，不进入 `public/` 或生产构建。

数据免费不等于无限基础设施配额；当前代码不新增 KV、D1 或 R2 绑定。数据库在现有 Assets 中发布，实际 CPU、内存和请求预算需要在部署前检查。

## 数据来源与许可

- [IPinfo Lite 下载版](https://ipinfo.io/developers/ipinfo-lite-database)：国家、ASN，CC BY-SA 4.0。
- [Tor Metrics](https://metrics.torproject.org/collector.html)：出口观察数据，CC0。
- [Spamhaus ASN-DROP](https://www.spamhaus.org/blocklists/do-not-route-or-peer/)：严重风险 ASN 名单，保留版权和日期，遵循 DROP 使用条款。
- [CIRCL BGP Ranking](https://www.circl.lu/services/bgp-ranking/)：公开 ASN 排名，仅作背景展示，附来源和数据日期。
- Net.Coffee：现有来源保留，免费额度与第三方转供范围尚未核实，不自动扩大接入。

付费匿名库、限时试用以及未经确认可用于公开 IP 查询的免费 API 不接入本版本。

## ASN 免费证据（评分 v2）

现已接入 Spamhaus ASN-DROP 快照，以及 CIRCL 上一个完整 UTC 日的公开排名。ASN-DROP 命中仅作为网络背景限制上限，未列入不加分；CIRCL 原始排名只展示、不直接转换成 IP 扣分。ASN 归属不一致时暂停匹配。单一综合 IP 信誉来源最高 79，缺少有效 ASN 名单证据最高 60。快照由仓库任务维护，Worker 复用静态文件及本仓库镜像缓存；超过 36 小时失效，不能把过期数据当阴性。完整来源说明、刷新限制和测试方法见 [评分规则](./ip-reference-score.md)。
