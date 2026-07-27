const STORAGE_KEY = "network_change_ip_last_notification_v1";
const DUPLICATE_WINDOW_MS = 20 * 1000;
const SETTLE_DELAY_MS = 3 * 1000;

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
  // 网络变化时系统可能连续触发数次，先等待路由和代理出口稳定。
  await sleep(SETTLE_DELAY_MS);

  try {
    const ip = await getExitIPv4(ctx);
    const now = Date.now();
    const previous = ctx.storage.getJSON(STORAGE_KEY);

    if (
      previous &&
      previous.ip === ip &&
      now - Number(previous.time || 0) < DUPLICATE_WINDOW_MS
    ) {
      return;
    }

    const info = ctx.lookupIP(ip) || {};
    const network = getNetworkName(ctx.device);
    const location = [countryFlag(info.country), info.country]
      .filter(Boolean)
      .join(" ");
    const asn = info.asn ? `AS${info.asn}` : "ASN 未知";
    const organization = info.organization || "运营商未知";

    ctx.storage.setJSON(STORAGE_KEY, { ip, time: now });
    ctx.notify({
      title: "网络已切换",
      subtitle: network,
      body: [
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
    ctx.notify({
      title: "网络已切换",
      subtitle: getNetworkName(ctx.device),
      body: `出口 IPv4 查询失败：${errorMessage(error)}`,
      sound: true,
      duration: 5,
    });
  }
}

async function getExitIPv4(ctx) {
  let lastError = new Error("没有可用的 IPv4 查询接口");

  for (const service of IP_SERVICES) {
    try {
      const response = await ctx.http.get(service.url, {
        timeout: 10000,
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

function getNetworkName(device) {
  const ssid = device && device.wifi && device.wifi.ssid;
  if (ssid) return `Wi-Fi：${ssid}`;

  const cellular = device && device.cellular;
  if (cellular && (cellular.carrier || cellular.radio)) {
    return ["蜂窝网络", cellular.carrier, cellular.radio]
      .filter(Boolean)
      .join(" · ");
  }

  return "当前网络";
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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error) {
  return error && error.message ? error.message : String(error);
}
