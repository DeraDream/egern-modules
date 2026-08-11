const API_URL = "https://api.ipapi.is";

function text(value, fallback = "未知") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function evaluatePurity(data) {
  let score = 100;
  const reasons = [];

  const deduct = (condition, points, label) => {
    if (condition) {
      score -= points;
      reasons.push(label);
    }
  };

  deduct(data.is_tor, 65, "Tor");
  deduct(data.is_proxy, 40, "代理");
  deduct(data.is_vpn, 30, "VPN");
  deduct(data.is_abuser, 35, "滥用记录");
  deduct(data.is_datacenter, 25, "机房 IP");
  deduct(data.is_bogon, 80, "Bogon");
  deduct(data.is_crawler, 20, "爬虫");

  const asnType = String(data.asn?.type || data.company?.type || "").toLowerCase();
  if (asnType === "hosting" && !data.is_datacenter) {
    score -= 15;
    reasons.push("托管 ASN");
  }

  score = Math.max(0, Math.min(100, score));

  let grade;
  let color;
  if (score >= 90) {
    grade = "很纯净";
    color = "#30D158";
  } else if (score >= 75) {
    grade = "较纯净";
    color = "#A4D65E";
  } else if (score >= 55) {
    grade = "一般";
    color = "#FFD60A";
  } else if (score >= 30) {
    grade = "风险较高";
    color = "#FF9F0A";
  } else {
    grade = "高风险";
    color = "#FF453A";
  }

  return {
    score,
    grade,
    color,
    reason: reasons.length ? reasons.join("、") : "未发现明显风险信号"
  };
}

function errorWidget(message) {
  return {
    type: "widget",
    padding: 16,
    backgroundGradient: {
      type: "linear",
      colors: ["#291C24", "#111827"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 }
    },
    children: [
      {
        type: "text",
        text: "出口 IP 检测失败",
        font: { size: "headline", weight: "bold" },
        textColor: "#FF453A"
      },
      { type: "spacer", length: 8 },
      {
        type: "text",
        text: text(message, "网络请求失败"),
        font: { size: "caption" },
        textColor: "#D1D5DB"
      }
    ]
  };
}

export default async function (ctx) {
  try {
    const response = await ctx.http.get(API_URL, {
      timeout: 12000,
      headers: { Accept: "application/json" }
    });
    const data = await response.json();

    if (data.error) throw new Error(data.error);
    if (!data.ip) throw new Error("API 未返回出口 IP");

    const purity = evaluatePurity(data);
    const asn = data.asn || {};
    const location = data.location || {};
    const company = data.company || {};
    const asNumber = asn.asn ? `AS${asn.asn}` : "ASN 未知";
    const organization = text(asn.org || company.name || asn.descr);
    const place = [location.country, location.state, location.city]
      .filter(Boolean)
      .join(" · ") || "位置未知";
    const family = ctx.widgetFamily;

    if (family === "accessoryInline") {
      return {
        type: "widget",
        children: [{
          type: "text",
          text: `${data.ip} · ${asNumber} · ${purity.grade} ${purity.score}`
        }]
      };
    }

    if (family === "accessoryCircular") {
      return {
        type: "widget",
        children: [
          {
            type: "text",
            text: String(purity.score),
            font: { size: "title2", weight: "bold" }
          },
          {
            type: "text",
            text: "纯净度",
            font: { size: "caption2" }
          }
        ]
      };
    }

    if (family === "accessoryRectangular") {
      return {
        type: "widget",
        children: [
          {
            type: "text",
            text: `${data.ip}  ${purity.grade} ${purity.score}`,
            font: { size: "headline", weight: "semibold" }
          },
          {
            type: "text",
            text: `${asNumber} · ${organization}`,
            font: { size: "caption" }
          }
        ]
      };
    }

    const compact = family === "systemSmall";
    const details = compact
      ? [
          {
            type: "text",
            text: data.ip,
            font: { size: "headline", weight: "bold" },
            textColor: "#FFFFFF",
            lineLimit: 1,
            minimumScaleFactor: 0.65
          },
          {
            type: "text",
            text: `${asNumber} · ${text(asn.type || company.type)}`,
            font: { size: "caption" },
            textColor: "#C7D2FE",
            lineLimit: 1,
            minimumScaleFactor: 0.7
          },
          {
            type: "text",
            text: place,
            font: { size: "caption2" },
            textColor: "#D1D5DB",
            lineLimit: 1,
            minimumScaleFactor: 0.7
          }
        ]
      : [
          {
            type: "stack",
            direction: "row",
            gap: 8,
            children: [
              {
                type: "text",
                text: data.ip,
                font: { size: "title3", weight: "bold" },
                textColor: "#FFFFFF",
                flex: 1,
                lineLimit: 1,
                minimumScaleFactor: 0.7
              },
              {
                type: "text",
                text: place,
                font: { size: "caption" },
                textColor: "#D1D5DB",
                lineLimit: 1
              }
            ]
          },
          {
            type: "text",
            text: `${asNumber} · ${organization}`,
            font: { size: "subheadline", weight: "semibold" },
            textColor: "#C7D2FE",
            lineLimit: 1,
            minimumScaleFactor: 0.7
          },
          {
            type: "text",
            text: `线路类型：${text(asn.type || company.type)} · 网段：${text(asn.route)}`,
            font: { size: "caption" },
            textColor: "#D1D5DB",
            lineLimit: 1
          }
        ];

    return {
      type: "widget",
      padding: compact ? 14 : 16,
      backgroundGradient: {
        type: "linear",
        colors: ["#111827", "#172554"],
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
              text: "出口 IP",
              font: { size: "headline", weight: "bold" },
              textColor: "#FFFFFF"
            },
            { type: "spacer" },
            {
              type: "text",
              text: `${purity.grade} ${purity.score}`,
              font: { size: "caption", weight: "bold" },
              textColor: purity.color
            }
          ]
        },
        { type: "spacer", length: compact ? 8 : 12 },
        ...details,
        { type: "spacer" },
        {
          type: "text",
          text: purity.reason,
          font: { size: "caption2" },
          textColor: purity.color,
          lineLimit: compact ? 1 : 2,
          minimumScaleFactor: 0.7
        },
        {
          type: "date",
          date: new Date().toISOString(),
          format: "relative",
          font: { size: "caption2" },
          textColor: "#94A3B8"
        }
      ]
    };
  } catch (error) {
    return errorWidget(error?.message || error);
  }
}

