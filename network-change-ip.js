const STORAGE_KEY = "proxy_exit_ip_monitor_v2";
const ERROR_STORAGE_KEY = "proxy_exit_ip_monitor_error_v2";
const ERROR_NOTIFY_INTERVAL_MS = 60 * 60 * 1000;

const IP_SERVICES = [
  {
    url: "https://api4.ipify.org?format=json",
    parse: (text) => JSON.parse(text).ip,
  },
  {
    url: "https://ipv4.icanhazip.com/",
    parse: (text) => text.trim(),
  },
];

export default async function (ctx) {
  const policy = (ctx.env && ctx.env.POLICY) || "🚀 节点选择";

  try {
    const ip = await getExitIPv4(ctx, policy);
    const previous = ctx.storage.getJSON(STORAGE_KEY);

    // 定时任务每 10 秒执行；出口没有变化时保持安静。
    if (previous && previous.ip === ip) {
      return;
    }

    const info = ctx.lookupIP(ip) || {};
    const location = [countryFlag(info.country), info.country]
      .filter(Boolean)
      .join(" ");
    const asn = info.asn ? `AS${info.asn}` : "ASN 未知";
    const organization = info.organization || "运营商未知";
    const isFirstRun = !previous || !previous.ip;

    ctx.storage.setJSON(STORAGE_KEY, { ip, time: Date.now(), policy });
    ctx.storage.delete(ERROR_STORAGE_KEY);
    ctx.notify({
      title: isFirstRun ? "代理出口监控已启动" : "海外代理出口已切换",
      subtitle: `策略：${policy}`,
      body: [
        ...(!isFirstRun ? [`原出口：${previous.ip}`] : []),
        `出口 IPv4：${ip}`,
        `${location || "位置未知"} · ${asn}`,
        organization,
      ].join("\n"),
      sound: true,
      duration: 5,
      action: {
        type: "clipboard",
        text: ip,
      },
    });
  } catch (error) {
    notifyErrorAtMostHourly(ctx, policy, error);
  }
}

async function getExitIPv4(ctx, policy) {
  let lastError = new Error("没有可用的 IPv4 查询接口");

  for (const service of IP_SERVICES) {
    try {
      const response = await ctx.http.get(service.url, {
        timeout: 10000,
        policy,
        headers: { Accept: "application/json, text/plain" },
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}`);
      }

      const ip = String(service.parse(await response.text()) || "").trim();
      if (!isIPv4(ip)) {
        throw new Error("接口没有返回有效 IPv4");
      }
      return ip;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

function notifyErrorAtMostHourly(ctx, policy, error) {
  const now = Date.now();
  const previousErrorTime = Number(ctx.storage.get(ERROR_STORAGE_KEY) || 0);
  if (now - previousErrorTime < ERROR_NOTIFY_INTERVAL_MS) return;

  ctx.storage.set(ERROR_STORAGE_KEY, String(now));
  ctx.notify({
    title: "代理出口检测失败",
    subtitle: `策略：${policy}`,
    body: errorMessage(error),
    sound: true,
    duration: 5,
  });
}

function isIPv4(value) {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) return false;
      const number = Number(part);
      return number >= 0 && number <= 255;
    })
  );
}

function countryFlag(countryCode) {
  const code = String(countryCode || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...[...code].map((character) => 127397 + character.charCodeAt(0))
  );
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}
