const API_URL = "https://my.ippure.com/v1/info";

export default async function (ctx) {
  try {
    const response = await ctx.http.get(API_URL, { timeout: 15000 });
    const data = await response.json();

    if (!data || !data.ip) {
      throw new Error("接口没有返回 IP");
    }

    return renderWidget(ctx.widgetFamily, data);
  } catch (error) {
    return renderError(error && error.message ? error.message : String(error));
  }
}

function renderWidget(family, data) {
  const ip = String(data.ip);
  const isIPv6 = ip.indexOf(":") !== -1;
  const risk = Number(data.fraudScore);
  const hasRisk = Number.isFinite(risk);
  const style = riskStyle(risk);
  const asn = data.asn ? "AS" + data.asn : "ASN 未知";
  const organization = data.asOrganization || "运营商未知";
  const location = [
    flagEmoji(data.countryCode),
    data.country,
    data.city
  ].filter(Boolean).join(" ");
  const lineType = data.isResidential ? "住宅 / 原生" : "机房 / 商业";

  if (family === "accessoryInline") {
    return {
      type: "widget",
      url: "https://ippure.com/cloudflare",
      refreshAfter: refreshDate(10),
      children: [{
        type: "text",
        text: "出口 " + shortIP(ip) + " · " + style.label
      }]
    };
  }

  if (family === "accessoryCircular") {
    return {
      type: "widget",
      url: "https://ippure.com/cloudflare",
      refreshAfter: refreshDate(10),
      children: [
        {
          type: "text",
          text: hasRisk ? String(risk) : "?",
          font: { size: "title2", weight: "bold" }
        },
        {
          type: "text",
          text: "IPPure",
          font: { size: "caption2", weight: "medium" }
        }
      ]
    };
  }

  if (family === "accessoryRectangular") {
    return {
      type: "widget",
      url: "https://ippure.com/cloudflare",
      refreshAfter: refreshDate(10),
      children: [
        {
          type: "text",
          text: shortIP(ip) + " · IPPure " + (hasRisk ? risk + "%" : "?"),
          font: { size: "headline", weight: "semibold" },
          maxLines: 1,
          minScale: 0.65
        },
        {
          type: "text",
          text: asn + " · " + lineType,
          font: { size: "caption1" },
          maxLines: 1,
          minScale: 0.7
        }
      ]
    };
  }

  const compact = family === "systemSmall";

  return {
    type: "widget",
    url: "https://ippure.com/cloudflare",
    refreshAfter: refreshDate(10),
    padding: compact ? 14 : 16,
    gap: compact ? 7 : 9,
    backgroundGradient: {
      type: "linear",
      colors: ["#0B1220", "#172554", "#1E3A5F"],
      stops: [0, 0.58, 1],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 7,
        children: [
          {
            type: "image",
            src: "sf-symbol:network",
            color: "#60A5FA",
            width: 18,
            height: 18
          },
          {
            type: "text",
            text: "当前海外IP出口",
            font: { size: "headline", weight: "bold" },
            textColor: "#FFFFFF"
          },
          { type: "spacer" },
          {
            type: "text",
            text: "IPPure " + (hasRisk ? risk + "%" : "未评分"),
            font: { size: "caption1", weight: "bold" },
            textColor: style.color
          }
        ]
      },
      {
        type: "text",
        text: (isIPv6 ? "IPv6  " : "IPv4  ") + ip,
        font: { size: compact ? "subheadline" : "title3", weight: "bold", family: "Menlo" },
        textColor: "#FFFFFF",
        maxLines: 1,
        minScale: 0.55
      },
      {
        type: "text",
        text: asn + " · " + organization,
        font: { size: compact ? "caption1" : "subheadline", weight: "semibold" },
        textColor: "#BFDBFE",
        maxLines: 1,
        minScale: 0.6
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "text",
            text: location || "位置未知",
            font: { size: "caption1" },
            textColor: "#D1D5DB",
            maxLines: 1,
            minScale: 0.7,
            flex: 1
          },
          {
            type: "text",
            text: lineType,
            font: { size: "caption1", weight: "semibold" },
            textColor: data.isResidential ? "#86EFAC" : "#FDE68A",
            maxLines: 1
          }
        ]
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "text",
            text: "IPPure 系数",
            font: { size: "caption1", weight: "semibold" },
            textColor: "#CBD5E1"
          },
          { type: "spacer" },
          {
            type: "text",
            text: hasRisk ? risk + "% · " + style.label : "未返回",
            font: { size: "caption1", weight: "bold" },
            textColor: style.color
          }
        ]
      },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "text",
            text: "Cloudflare 系数",
            font: { size: "caption1", weight: "semibold" },
            textColor: "#CBD5E1"
          },
          { type: "spacer" },
          {
            type: "text",
            text: "点按浏览器检测",
            font: { size: "caption1", weight: "bold" },
            textColor: "#60A5FA"
          }
        ]
      },
      { type: "spacer" },
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        children: [
          {
            type: "image",
            src: "sf-symbol:" + style.icon,
            color: style.color,
            width: 14,
            height: 14
          },
          {
            type: "text",
            text: style.label + (hasRisk ? " · 风险 " + risk : ""),
            font: { size: "caption1", weight: "bold" },
            textColor: style.color,
            maxLines: 1
          },
          { type: "spacer" },
          {
            type: "date",
            date: new Date().toISOString(),
            format: "relative",
            font: { size: "caption2" },
            textColor: "#94A3B8",
            maxLines: 1
          }
        ]
      }
    ]
  };
}

function renderError(message) {
  return {
    type: "widget",
    refreshAfter: refreshDate(5),
    padding: 16,
    gap: 8,
    backgroundGradient: {
      type: "linear",
      colors: ["#2A1016", "#111827"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: [
      {
        type: "image",
        src: "sf-symbol:network.slash",
        color: "#FF453A",
        width: 22,
        height: 22
      },
      {
        type: "text",
        text: "出口检测失败",
        font: { size: "headline", weight: "bold" },
        textColor: "#FFFFFF"
      },
      {
        type: "text",
        text: message,
        font: { size: "caption1" },
        textColor: "#FCA5A5",
        maxLines: 4,
        minScale: 0.7
      }
    ]
  };
}

function riskStyle(score) {
  if (!Number.isFinite(score)) {
    return {
      label: "风险未知",
      color: "#A1A1AA",
      icon: "questionmark.circle.fill"
    };
  }
  if (score >= 80) {
    return {
      label: "极高风险",
      color: "#FF453A",
      icon: "xmark.octagon.fill"
    };
  }
  if (score >= 70) {
    return {
      label: "高风险",
      color: "#FF9F0A",
      icon: "exclamationmark.triangle.fill"
    };
  }
  if (score >= 40) {
    return {
      label: "中等风险",
      color: "#FFD60A",
      icon: "exclamationmark.circle.fill"
    };
  }
  return {
    label: "低风险",
    color: "#30D158",
    icon: "checkmark.seal.fill"
  };
}

function refreshDate(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function shortIP(ip) {
  if (ip.length <= 24) return ip;
  return ip.slice(0, 10) + "…" + ip.slice(-7);
}

function flagEmoji(code) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map(character => 127397 + character.charCodeAt())
  );
}
