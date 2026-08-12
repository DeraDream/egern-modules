const API_BASE = "https://124.221.69.228/api/firewall/";

function parseTokens(raw) {
  return String(raw || "")
    .split(/[,|;、\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.indexOf("pgnfw_") === 0)
    .map((value) => {
      const at = value.indexOf("@");
      if (at === -1) return { token: value, slot: null };
      const slot = parseInt(value.slice(at + 1), 10);
      return { token: value.slice(0, at), slot: Number.isNaN(slot) ? null : slot };
    });
}

async function getStatus(ctx, item) {
  let url = API_BASE + encodeURIComponent(item.token) + "/add";
  if (item.slot !== null) url += "?slot=" + encodeURIComponent(item.slot);

  try {
    const response = await ctx.http.post(url, {
      headers: { "Content-Type": "application/json" },
      body: "",
      policy: "DIRECT",
      timeout: 15000,
    });
    const text = await response.text();
    const data = JSON.parse(text);
    const whitelist = Array.isArray(data.whitelist) ? data.whitelist : [];
    const ips = whitelist.map((entry) =>
      entry && typeof entry === "object" ? entry : { ip: String(entry), slot: null }
    );
    const current = String(data.currentIp || "?");
    const applied = data.enabled === true && ips.some((entry) => sameC24(entry.ip, current));
    return { data, ips, current, applied, error: null };
  } catch (error) {
    return { data: null, ips: [], current: "?", applied: false, error: String(error.message || error) };
  }
}

function sameC24(a, b) {
  if (!a || !b) return false;
  a = String(a);
  b = String(b);
  if (a === b) return true;
  if (!a.endsWith("/24") && !b.endsWith("/24")) return false;
  const pa = a.replace("/24", "").split(".");
  const pb = b.replace("/24", "").split(".");
  return pa.length === 4 && pb.length === 4 && pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2];
}

function text(value, options = {}) {
  return { type: "text", text: String(value), ...options };
}

function renderWidget(family, results) {
  const ok = results.filter((result) => result.applied).length;
  const current = results.find((result) => result.current !== "?")?.current || "?";
  const rows = [];
  results.forEach((result, index) => {
    if (result.error) {
      rows.push(text("#" + (index + 1) + " ❌ " + result.error, { textColor: "#D64545", maxLines: 2 }));
      return;
    }
    result.ips.forEach((entry) => {
      const active = sameC24(entry.ip, result.current) ? " ←" : "";
      const slot = entry.slot === null || entry.slot === undefined ? "普通" : "📌 槽位 " + entry.slot;
      rows.push({
        type: "stack",
        direction: "row",
        gap: 6,
        children: [
          text(String(entry.ip) + active, { font: { size: "caption1", family: "Menlo" }, textColor: "#E5EDF5", flex: 1, minScale: 0.65 }),
          text(slot, { textColor: "#7B8494", font: { size: "caption2" } }),
        ],
      });
    });
  });

  const compact = family === "accessoryRectangular" || family === "accessoryInline" || family === "accessoryCircular";
  const shortRows = rows.slice(0, 3);
  if (compact) {
    return {
      type: "widget",
      refreshAfter: new Date(Date.now() + 300000).toISOString(),
      padding: 12,
      children: [
        text("po0 防火墙", { font: { size: "headline", weight: "bold" } }),
        text("当前：" + current + " · " + (ok === results.length ? "已加入白名单" : "未加入白名单"), { font: { size: "caption1" }, maxLines: 2 }),
      ],
    };
  }

  if (family === "systemSmall") {
    return {
      type: "widget",
      refreshAfter: new Date(Date.now() + 300000).toISOString(),
      padding: 12,
      backgroundColor: "#102A43",
      children: [
        text("🛡 po0", { font: { size: "headline", weight: "bold" }, textColor: "#FFFFFF" }),
        { type: "spacer", length: 6 },
        text(current, { font: { size: "caption1", family: "Menlo" }, textColor: "#D9E2EC", minScale: 0.6, maxLines: 1 }),
        text(ok === results.length ? "已加入白名单" : "未加入白名单", { font: { size: "subheadline", weight: "semibold" }, textColor: ok === results.length ? "#62D6A7" : "#FFCC66" }),
      ],
    };
  }

  if (family === "systemMedium") {
    return {
      type: "widget",
      refreshAfter: new Date(Date.now() + 300000).toISOString(),
      padding: 12,
      gap: 5,
      backgroundColor: "#102A43",
      children: [
        { type: "stack", direction: "row", alignItems: "center", children: [
          text("🛡 po0 防火墙", { font: { size: "headline", weight: "bold" }, textColor: "#FFFFFF", flex: 1 }),
          text(ok === results.length ? "已加入白名单" : "未加入白名单", { font: { size: "caption1", weight: "semibold" }, textColor: ok === results.length ? "#62D6A7" : "#FFCC66" }),
        ] },
        text("出口：" + current, { font: { size: "caption1", family: "Menlo" }, textColor: "#D9E2EC", minScale: 0.6, maxLines: 1 }),
        { type: "stack", direction: "column", gap: 2, children: shortRows.length ? shortRows : [text("暂无白名单数据", { font: { size: "caption1" }, textColor: "#CBD5E1" })] },
      ],
    };
  }

  return {
    type: "widget",
    refreshAfter: new Date(Date.now() + 300000).toISOString(),
    padding: 16,
    gap: 8,
    backgroundGradient: { type: "linear", colors: ["#102A43", "#0B172A"], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    children: [
      text("🛡 po0 防火墙", { font: { size: "title3", weight: "bold" }, textColor: "#FFFFFF" }),
      text("当前出口：" + current, { font: { size: "subheadline", family: "Menlo" }, textColor: "#D9E2EC", minScale: 0.65 }),
      text("加白状态：" + (ok === results.length ? "已加入白名单" : "未加入白名单") + " · 箭头为当前网段", { font: { size: "caption1" }, textColor: "#9FB3C8" }),
      { type: "stack", direction: "column", gap: 5, children: rows.length ? rows : [text("暂无白名单数据", { textColor: "#CBD5E1" })] },
      text("已返回白名单；网络切换仍由自动脚本处理。", { font: { size: "caption2" }, textColor: "#8FA3B8", maxLines: 2 }),
    ],
  };
}

export default async function (ctx) {
  const tokens = parseTokens(ctx.env && ctx.env.tokens);
  if (!tokens.length) return renderWidget(ctx.widgetFamily, [{ error: "未配置 token", ips: [], current: "?", applied: false }]);
  const results = [];
  for (const item of tokens) results.push(await getStatus(ctx, item));
  return renderWidget(ctx.widgetFamily, results);
}
