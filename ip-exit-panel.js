function purity(data, reputation) {
  const organization = String(
    data.asn_organization || data.organization || data.isp || ""
  ).toLowerCase();
  const hostingWords = [
    "hosting", "cloud", "data center", "datacenter", "server",
    "amazon", "google cloud", "microsoft azure", "digitalocean",
    "vultr", "linode", "ovh", "hetzner"
  ];
  const looksHosting = hostingWords.some(function (word) {
    return organization.indexOf(word) !== -1;
  });

  if (reputation === "Y") {
    return {
      score: looksHosting ? 35 : 50,
      grade: looksHosting ? "风险较高" : "一般",
      color: looksHosting ? "#FF9F0A" : "#FFD60A",
      risk: looksHosting ? "信誉库建议拦截、疑似机房线路" : "信誉库建议拦截"
    };
  }

  if (reputation !== "N") {
    return {
      score: looksHosting ? 60 : 75,
      grade: looksHosting ? "一般" : "待确认",
      color: "#FFD60A",
      risk: looksHosting ? "信誉查询不可用、疑似机房线路" : "信誉查询暂时不可用"
    };
  }

  if (looksHosting) {
    return {
      score: 72,
      grade: "一般",
      color: "#FFD60A",
      risk: "未命中信誉风险，疑似机房线路"
    };
  }

  return {
    score: 92,
    grade: "较纯净",
    color: "#30D158",
    risk: "未命中明显信誉风险"
  };
}

function finish(data, reputation) {
  const result = purity(data, reputation);
  const asNumber = data.asn ? "AS" + data.asn : "未知";
  const organization =
    data.asn_organization || data.organization || data.isp || "未知";
  const place = [data.country, data.region, data.city]
    .filter(Boolean)
    .join(" · ") || "未知";

  $done({
    title: "出口 IP · " + result.grade + " " + result.score,
    content:
      "IP：" + (data.ip || "未知") + "\n" +
      "位置：" + place + "\n" +
      "ASN：" + asNumber + "\n" +
      "运营商：" + organization + "\n" +
      "ISP：" + (data.isp || "未知") + "\n" +
      "风险：" + result.risk,
    icon: "network",
    "icon-color": result.color
  });
}

$httpClient.get(
  {
    url: "https://api.ip.sb/geoip",
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
      if (!data.ip) throw new Error("接口没有返回 IP");

      $httpClient.get(
        {
          url: "https://blackbox.ipinfo.app/api/v1/" + encodeURIComponent(data.ip),
          headers: { Accept: "text/plain" },
          timeout: 12
        },
        function (riskError, riskResponse, riskBody) {
          if (riskError) {
            finish(data, "E");
            return;
          }
          finish(data, String(riskBody || "E").trim().toUpperCase());
        }
      );
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
