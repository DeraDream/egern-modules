const API_BASE = "https://124.221.69.228/api/firewall/";

function clean(value) {
  return String(value == null ? "" : value).replace(/[\r\n\t]/g, " ");
}

function validToken(raw) {
  const token = String(raw || "").trim().replace(/@\d+$/, "");
  return /^pgnfw_[A-Za-z0-9_-]+$/.test(token) ? token : "";
}

function text(value, extra = {}) {
  return { type: "text", text: String(value), ...extra };
}

function sameCurrent(entryIp, currentIp) {
  return !!entryIp && !!currentIp && String(entryIp) === String(currentIp);
}

function render(ctx, data, err) {
  const family = ctx.widgetFamily;
  const compact =
    family === "systemSmall" ||
    family === "accessoryRectangular" ||
    family === "accessoryCircular" ||
    family === "accessoryInline";

  if (err) {
    return {
      type: "widget",
      padding: 12,
      gap: 6,
      children: [
        text("po0fw · 查询失败", { font: { size: "headline", weight: "bold" } }),
        text(err, { font: { size: "caption1" }, maxLines: 4 }),
      ],
    };
  }

  const list = Array.isArray(data.whitelist) ? data.whitelist : [];
  const current = typeof data.currentIp === "string" ? data.currentIp : "";
  const limit = Number.isFinite(Number(data.limit)) ? Number(data.limit) : null;
  const fixed = [];
  const fifo = [];
  const other = [];

  list.forEach((entry) => {
    if (!entry || typeof entry.ip !== "string") return;
    if (
      entry.slot !== null &&
      entry.slot !== undefined &&
      /^\d+$/.test(String(entry.slot))
    ) {
      fixed.push(entry);
    } else if (entry.slot === null || entry.slot === undefined) {
      fifo.push(entry);
    } else {
      other.push(entry);
    }
  });

  fixed.sort((a, b) => Number(a.slot) - Number(b.slot));
  const hit = list.some((entry) => sameCurrent(entry && entry.ip, current));
  const rows = [];

  fixed.forEach((entry) => {
    rows.push(
      text(
        (sameCurrent(entry.ip, current) ? "● " : "○ ") +
          "固定槽 " +
          entry.slot +
          "  " +
          clean(entry.ip),
        { font: { size: "caption1", family: "Menlo" }, maxLines: 1, minScale: 0.65 }
      )
    );
  });

  fifo.forEach((entry, index) => {
    rows.push(
      text(
        (sameCurrent(entry.ip, current) ? "● " : "○ ") +
          "FIFO " +
          (index + 1) +
          "  " +
          clean(entry.ip),
        { font: { size: "caption1", family: "Menlo" }, maxLines: 1, minScale: 0.65 }
      )
    );
  });

  other.forEach((entry, index) => {
    rows.push(
      text(
        (sameCurrent(entry.ip, current) ? "● " : "○ ") +
          "未标注 " +
          (index + 1) +
          "  " +
          clean(entry.ip),
        { font: { size: "caption1", family: "Menlo" }, maxLines: 1, minScale: 0.65 }
      )
    );
  });

  const capacity =
    "占用 " +
    list.length +
    "/" +
    (limit === null ? "?" : limit) +
    " · 剩余 " +
    (limit === null ? "?" : Math.max(0, limit - list.length));

  return {
    type: "widget",
    refreshAfter: new Date(Date.now() + 60000).toISOString(),
    padding: 12,
    gap: 5,
    children: [
      text("po0fw · 全部槽位", { font: { size: "headline", weight: "bold" } }),
      text(capacity, { font: { size: "caption1" } }),
      text("本机出口：" + (current || "接口未返回"), {
        font: { size: "caption1", family: "Menlo" },
        maxLines: 1,
        minScale: 0.65,
      }),
      text(
        current
          ? hit
            ? "✓ 当前出口已在白名单"
            : "⚠ 当前出口未在白名单"
          : "当前出口命中状态未知",
        { font: { size: "caption1", weight: "semibold" } }
      ),
      {
        type: "stack",
        direction: "column",
        gap: 3,
        children: (compact ? rows.slice(0, 3) : rows.slice(0, 12)).length
          ? compact
            ? rows.slice(0, 3)
            : rows.slice(0, 12)
          : [text("白名单为空", { font: { size: "caption1" } })],
      },
    ],
  };
}

export default async function (ctx) {
  const token = validToken(ctx.env && ctx.env.token);
  if (!token) return render(ctx, null, "请在模块参数 token 中填写有效的 pgnfw_ token。");

  try {
    const response = await ctx.http.get(API_BASE + encodeURIComponent(token), {
      policy: "DIRECT",
      timeout: 10000,
      redirect: "manual",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403) {
      return render(ctx, null, "认证失败，请检查 token。");
    }
    if (response.status < 200 || response.status >= 300) {
      return render(ctx, null, "接口返回 HTTP " + response.status + "。");
    }
    const data = await response.json();
    if (!data || !Array.isArray(data.whitelist)) {
      return render(ctx, null, "接口数据格式不符合预期。");
    }
    return render(ctx, data, null);
  } catch (e) {
    return render(ctx, null, "网络或 TLS 连接失败：" + String((e && e.message) || e));
  }
}
