/*
 * Egern 出口 IP 检测
 * 数据接口：https://my.ippure.com/v1/info
 * 接口用法参考：Likhixang/Egerny IPPure
 */

const API_URL = "https://my.ippure.com/v1/info";
const markIP = ($argument || "false").toLowerCase() === "true";

$httpClient.get(API_URL, function (error, response, body) {
  if (error) {
    $done({
      title: "出口 IP 检测失败",
      content: String(error),
      icon: "network.slash",
      "icon-color": "#FF3B30"
    });
    return;
  }

  const status = response && (response.status || response.statusCode);
  if (status && status !== 200) {
    $done({
      title: "出口 IP 检测失败",
      content:
        "HTTP 状态：" + status + "\n" +
        "接口返回：" + String(body || "空"),
      icon: "exclamationmark.triangle.fill",
      "icon-color": "#FF3B30"
    });
    return;
  }

  try {
    const data = JSON.parse(body);
    const ip = data.ip || "未知";
    const shownIP = markIP ? maskIP(ip) : ip;
    const ipVersion = ip.indexOf(":") !== -1 ? "IPv6" : "IPv4";
    const asn = data.asn ? "AS" + data.asn : "未知";
    const organization = data.asOrganization || "未知";
    const location = [
      flagEmoji(data.countryCode),
      data.country,
      data.city
    ].filter(Boolean).join(" ");
    const residential = data.isResidential
      ? "✅ 是（住宅/原生）"
      : "🏢 否（机房/商业）";
    const score = Number(data.fraudScore);
    const risk = riskLevel(Number.isFinite(score) ? score : null);

    $done({
      title: "出口 IP · " + risk.label,
      content:
        ipVersion + "：" + shownIP + "\n" +
        "ASN：" + asn + " " + organization + "\n" +
        "位置：" + (location || "未知") + "\n" +
        "住宅 IP：" + residential + "\n" +
        "纯净度：" + risk.purity + "\n" +
        "欺诈风险：" + risk.description,
      icon: risk.icon,
      "icon-color": risk.color,
      "title-color": risk.color
    });
  } catch (parseError) {
    $done({
      title: "出口 IP 检测失败",
      content:
        "JSON 解析失败：" + parseError.message + "\n" +
        "接口返回：" + String(body || "空").slice(0, 300),
      icon: "exclamationmark.triangle.fill",
      "icon-color": "#FF3B30"
    });
  }
});

function riskLevel(score) {
  if (score === null) {
    return {
      label: "风险未知",
      purity: "无法评分",
      description: "接口未返回 fraudScore",
      color: "#8E8E93",
      icon: "questionmark.circle.fill"
    };
  }

  const purity = Math.max(0, Math.min(100, 100 - score));

  if (score >= 80) {
    return {
      label: "极高风险",
      purity: purity + "/100",
      description: score + "/100（极高）",
      color: "#FF3B30",
      icon: "xmark.octagon.fill"
    };
  }
  if (score >= 70) {
    return {
      label: "高风险",
      purity: purity + "/100",
      description: score + "/100（高）",
      color: "#FF9500",
      icon: "exclamationmark.triangle.fill"
    };
  }
  if (score >= 40) {
    return {
      label: "中等风险",
      purity: purity + "/100",
      description: score + "/100（中等）",
      color: "#FFCC00",
      icon: "exclamationmark.circle.fill"
    };
  }
  return {
    label: "低风险",
    purity: purity + "/100",
    description: score + "/100（低）",
    color: "#34C759",
    icon: "checkmark.seal.fill"
  };
}

function maskIP(ip) {
  if (!ip) return "";
  if (ip.indexOf(".") !== -1) {
    const parts = ip.split(".");
    return parts[0] + "." + parts[1] + ".*.*";
  }
  const parts = ip.split(":");
  return (parts[0] || "") + ":" + (parts[1] || "") + ":*:*:*:*:*:*";
}

function flagEmoji(code) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint.apply(
    String,
    code.toUpperCase().split("").map(function (character) {
      return 127397 + character.charCodeAt(0);
    })
  );
}
