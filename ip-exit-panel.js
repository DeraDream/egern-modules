function purity(data) {
  let score = 100;
  const risks = [];

  function deduct(condition, points, name) {
    if (condition) {
      score -= points;
      risks.push(name);
    }
  }

  deduct(data.is_tor, 65, "Tor");
  deduct(data.is_proxy, 40, "代理");
  deduct(data.is_vpn, 30, "VPN");
  deduct(data.is_abuser, 35, "滥用记录");
  deduct(data.is_datacenter, 25, "机房 IP");
  deduct(data.is_bogon, 80, "Bogon");
  deduct(data.is_crawler, 20, "爬虫");

  const asnType = String(
    (data.asn && data.asn.type) ||
    (data.company && data.company.type) ||
    ""
  ).toLowerCase();

  if (asnType === "hosting" && !data.is_datacenter) {
    score -= 15;
    risks.push("托管 ASN");
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 90) return { score, grade: "很纯净", color: "#30D158", risks };
  if (score >= 75) return { score, grade: "较纯净", color: "#A4D65E", risks };
  if (score >= 55) return { score, grade: "一般", color: "#FFD60A", risks };
  if (score >= 30) return { score, grade: "风险较高", color: "#FF9F0A", risks };
  return { score, grade: "高风险", color: "#FF453A", risks };
}

function finish(data) {
  const result = purity(data);
  const asn = data.asn || {};
  const company = data.company || {};
  const location = data.location || {};
  const asNumber = asn.asn ? "AS" + asn.asn : "未知";
  const organization = asn.org || company.name || asn.descr || "未知";
  const asnType = asn.type || company.type || "未知";
  const place = [location.country, location.state, location.city]
    .filter(Boolean)
    .join(" · ") || "未知";
  const riskText = result.risks.length
    ? result.risks.join("、")
    : "未发现明显风险信号";

  $done({
    title: "出口 IP · " + result.grade + " " + result.score,
    content:
      "IP：" + (data.ip || "未知") + "\n" +
      "位置：" + place + "\n" +
      "ASN：" + asNumber + "\n" +
      "运营商：" + organization + "\n" +
      "线路：" + asnType + "\n" +
      "网段：" + (asn.route || "未知") + "\n" +
      "风险：" + riskText,
    icon: "network",
    "icon-color": result.color
  });
}

$httpClient.get(
  {
    url: "https://api.ipapi.is",
    headers: { Accept: "application/json" },
    timeout: 12
  },
  function (error, response, body) {
    if (error) {
      $done({
        title: "出口 IP 检测失败",
        content: String(error),
        icon: "exclamationmark.triangle",
        "icon-color": "#FF453A"
      });
      return;
    }

    try {
      const data = JSON.parse(body);
      if (data.error) throw new Error(data.error);
      finish(data);
    } catch (parseError) {
      $done({
        title: "出口 IP 检测失败",
        content: "接口返回解析失败：" + parseError.message,
        icon: "exclamationmark.triangle",
        "icon-color": "#FF453A"
      });
    }
  }
);
