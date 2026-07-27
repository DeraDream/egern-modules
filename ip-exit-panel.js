/*
 * Egern IPv4 出口检测
 * IPv4：https://ipv4.ippubblico.org/
 * 信誉：https://reputation.noc.org/api/?ip=
 */

const markIP = ($argument || "false").toLowerCase() === "true";

$httpClient.get("https://ipv4.ippubblico.org/", function (ipError, ipResponse, ipBody) {
  if (ipError) {
    finishError("获取出口 IPv4 失败", ipError);
    return;
  }

  const ip = String(ipBody || "").trim();
  if (!isIPv4(ip)) {
    finishError("没有获取到有效 IPv4", ipBody || "接口返回为空");
    return;
  }

  const reputationURL =
    "https://reputation.noc.org/api/?ip=" + encodeURIComponent(ip);

  $httpClient.get(reputationURL, function (riskError, riskResponse, riskBody) {
    if (riskError) {
      finishError("IP 信誉查询失败", riskError);
      return;
    }

    try {
      const data = JSON.parse(riskBody);
      if (!data || data.status === "error") {
        throw new Error(data && data.reason ? data.reason : "接口返回错误");
      }
      finish(ip, data);
    } catch (parseError) {
      finishError(
        "IP 信誉结果解析失败",
        parseError.message + "\n" + String(riskBody || "").slice(0, 240)
      );
    }
  });
});

function finish(ip, data) {
  const usage = data.usage || {};
  const reputation = data.reputation || {};
  const recommendation = data.recommendations || {};
  const risks = [];
  let score = 100;

  deduct(usage.is_tor, 55, "Tor");
  deduct(usage.is_proxy, 35, "代理");
  deduct(usage.is_hosting, 25, "机房");
  deduct(reputation.web_spam, 18, "网页垃圾");
  deduct(reputation.web_attacks, 25, "网络攻击");
  deduct(reputation.botnet, 35, "僵尸网络");
  deduct(reputation.email_spam, 15, "邮件垃圾");
  deduct(reputation.brute_force, 20, "暴力破解");
  deduct(reputation.ddos, 30, "DDoS");

  if (recommendation.block_traffic && risks.length === 0) {
    score -= 20;
    risks.push("信誉库建议拦截");
  }

  score = Math.max(0, Math.min(100, score));
  const level = purityLevel(score);
  const shownIP = markIP ? maskIPv4(ip) : ip;
  const asn = data.as_number ? "AS" + data.as_number : "未知";
  const organization = data.as_name || "未知";
  const location = [data.country, data.country_code].filter(Boolean).join(" ");

  $done({
    title: "Egern 出口 · " + level.label,
    content:
      "IPv4：" + shownIP + "\n" +
      "ASN：" + asn + " " + organization + "\n" +
      "位置：" + (location || "未知") + "\n" +
      "线路：" + (usage.is_hosting ? "🏢 机房/商业" : "🏠 非机房") + "\n" +
      "纯净度：" + score + "/100\n" +
      "风险：" + (risks.length ? risks.join("、") : "未发现明显风险"),
    icon: level.icon,
    "icon-color": level.color,
    "title-color": level.color
  });

  function deduct(condition, points, name) {
    if (condition) {
      score -= points;
      risks.push(name);
    }
  }
}

function purityLevel(score) {
  if (score >= 90) {
    return {
      label: "很纯净",
      color: "#34C759",
      icon: "checkmark.seal.fill"
    };
  }
  if (score >= 75) {
    return {
      label: "较纯净",
      color: "#A4D65E",
      icon: "checkmark.circle.fill"
    };
  }
  if (score >= 55) {
    return {
      label: "一般",
      color: "#FFCC00",
      icon: "exclamationmark.circle.fill"
    };
  }
  if (score >= 30) {
    return {
      label: "风险较高",
      color: "#FF9500",
      icon: "exclamationmark.triangle.fill"
    };
  }
  return {
    label: "高风险",
    color: "#FF3B30",
    icon: "xmark.octagon.fill"
  };
}

function finishError(title, detail) {
  $done({
    title: title,
    content: String(detail || "未知错误"),
    icon: "network.slash",
    "icon-color": "#FF3B30"
  });
}

function isIPv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every(function (part) {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255;
  });
}

function maskIPv4(ip) {
  const parts = ip.split(".");
  return parts[0] + "." + parts[1] + ".*.*";
}
