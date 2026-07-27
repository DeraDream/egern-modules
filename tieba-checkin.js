const COOKIE_STORAGE_KEY = "tieba_checkin_accounts";
const LAST_CAPTURED_ACCOUNT_KEY = "tieba_checkin_last_captured_account";
const INVALID_FORUMS = new Set(["贴吧10周年"]);
const DIRECT = "DIRECT";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cookieHeaders(cookie, referer = "https://tieba.baidu.com/") {
  return {
    Cookie: cookie,
    Referer: referer,
    "User-Agent": USER_AGENT,
  };
}

function accountFingerprint(cookie) {
  const bduss = /(?:^|;\s*)BDUSS=([^;]+)/i.exec(cookie)?.[1] || cookie;
  let hash = 2166136261;
  for (let index = 0; index < bduss.length; index += 1) {
    hash ^= bduss.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function getJson(ctx, url, options = {}) {
  const response = await ctx.http.get(url, {
    timeout: 15000,
    policy: DIRECT,
    ...options,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function getUserId(ctx, cookie) {
  const data = await getJson(ctx, "https://tieba.baidu.com/mo/q/sync", {
    headers: cookieHeaders(cookie, "https://tieba.baidu.com/home/main"),
  });
  return String(data?.data?.user_id || "default");
}

async function captureCookie(ctx) {
  const cookie =
    ctx.request?.headers?.get?.("cookie") ||
    ctx.request?.headers?.Cookie ||
    ctx.request?.headers?.cookie ||
    "";

  if (!cookie) {
    console.log("贴吧请求中没有 Cookie，跳过保存");
    return;
  }

  // 同一账号的不同请求会携带略有差异的临时 Cookie，使用稳定的 BDUSS
  // 指纹去重，且不在存储和日志中额外暴露 BDUSS 原文。
  const fingerprint = accountFingerprint(cookie);
  const shouldNotify =
    ctx.storage.get(LAST_CAPTURED_ACCOUNT_KEY) !== fingerprint;
  if (shouldNotify) {
    ctx.storage.set(LAST_CAPTURED_ACCOUNT_KEY, fingerprint);
  }

  const accounts = ctx.storage.getJSON(COOKIE_STORAGE_KEY) || {};
  let userId = "default";
  try {
    userId = await getUserId(ctx, cookie);
  } catch (error) {
    console.log(`获取贴吧用户 ID 失败，使用默认账号：${error.message || error}`);
  }

  if (accounts[userId] === cookie) {
    console.log(`贴吧账号 ${userId} 的 Cookie 没有变化`);
    return;
  }

  accounts[userId] = cookie;
  ctx.storage.setJSON(COOKIE_STORAGE_KEY, accounts);
  console.log(`已保存贴吧账号 ${userId} 的 Cookie`);

  if (shouldNotify) {
    ctx.notify({
      title: "百度贴吧",
      subtitle: `账号 ${userId}`,
      body: "🎈 获取 Cookie 成功",
      sound: true,
      duration: 5,
    });
  } else {
    console.log(`账号 ${userId} 的 Cookie 已静默更新`);
  }
}

async function getForumList(ctx, cookie) {
  const data = await getJson(ctx, "https://tieba.baidu.com/mo/q/newmoindex", {
    headers: {
      ...cookieHeaders(cookie, "https://tieba.baidu.com/index/tbwise/forum"),
      "Content-Type": "application/octet-stream",
    },
  });

  if (data?.error !== "success" || !Array.isArray(data?.data?.like_forum)) {
    throw new Error(data?.error || "贴吧列表响应格式异常");
  }

  const forums = data.data.like_forum.filter(
    (forum) =>
      forum?.forum_name &&
      !INVALID_FORUMS.has(forum.forum_name),
  );
  return { tbs: data.data.tbs, forums };
}

function signMessage(forumName, result) {
  if (
    result?.data?.errmsg === "success" &&
    result?.data?.errno === 0 &&
    result?.data?.uinfo?.is_sign_in === 1
  ) {
    return {
      ok: true,
      text:
        `${forumName}：成功，排名 ${result.data.uinfo.user_sign_rank}` +
        `，连续 ${result.data.uinfo.cont_sign_num} 天`,
    };
  }

  const messages = {
    1010: "目录错误",
    1011: "未加入此吧或等级不足",
    1101: "已经签到",
    1102: "操作过快",
    2150040: "需要验证码",
  };
  const code = Number(result?.no);
  return {
    ok: code === 1101,
    retryable: code === 1102 || code === 2150040,
    text:
      `${forumName}：${messages[code] || result?.error || "签到失败"}` +
      (Number.isFinite(code) ? `（${code}）` : ""),
  };
}

async function signForumOnce(ctx, cookie, tbs, forumName) {
  const body =
    `tbs=${encodeURIComponent(tbs)}` +
    `&kw=${encodeURIComponent(forumName)}` +
    "&ie=utf-8";
  const response = await ctx.http.post("https://tieba.baidu.com/sign/add", {
    headers: {
      ...cookieHeaders(cookie),
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
    timeout: 15000,
    policy: DIRECT,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }
  return signMessage(forumName, await response.json());
}

async function signForum(ctx, cookie, tbs, forumName) {
  let lastResult;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      lastResult = await signForumOnce(ctx, cookie, tbs, forumName);
      if (lastResult.ok || !lastResult.retryable) return lastResult;
    } catch (error) {
      lastResult = {
        ok: false,
        text: `${forumName}：${error.message || error}`,
      };
    }
    if (attempt < 3) await sleep(2000 * attempt);
  }
  return lastResult;
}

async function checkInAccount(ctx, userId, cookie) {
  const { tbs, forums } = await getForumList(ctx, cookie);
  let success = 0;
  const failures = [];

  console.log(`账号 ${userId} 共获取 ${forums.length} 个贴吧`);

  for (const forum of forums) {
    if (forum.is_sign === 1) {
      success += 1;
      continue;
    }

    const result = await signForum(
      ctx,
      cookie,
      tbs,
      forum.forum_name,
    );
    console.log(result.text);
    if (result.ok) success += 1;
    else failures.push(result.text);
    await sleep(500);
  }

  return {
    userId,
    total: forums.length,
    success,
    failures,
  };
}

async function runCheckIn(ctx) {
  const accounts = ctx.storage.getJSON(COOKIE_STORAGE_KEY) || {};
  const entries = Object.entries(accounts);

  if (entries.length === 0) {
    ctx.notify({
      title: "百度贴吧签到失败",
      body: "没有 Cookie，请先打开贴吧 App 获取登录信息",
      sound: true,
      duration: 5,
    });
    return;
  }

  const reports = [];
  for (const [userId, cookie] of entries) {
    try {
      reports.push(await checkInAccount(ctx, userId, cookie));
    } catch (error) {
      reports.push({
        userId,
        total: 0,
        success: 0,
        failures: [error.message || String(error)],
      });
    }
  }

  const total = reports.reduce((sum, report) => sum + report.total, 0);
  const success = reports.reduce((sum, report) => sum + report.success, 0);
  const failures = reports.flatMap((report) =>
    report.failures.map((message) => `${report.userId}：${message}`),
  );
  const body = [
    `账号：${reports.length}`,
    `贴吧：${total}`,
    `成功/已签：${success}`,
    `失败：${failures.length}`,
  ];
  if (failures.length) body.push("", ...failures.slice(0, 5));

  ctx.notify({
    title: failures.length ? "⚠️ 贴吧签到部分失败" : "✅ 贴吧签到完成",
    body: body.join("\n"),
    sound: true,
    duration: 5,
    action: {
      type: "openUrl",
      url: "https://tieba.baidu.com/",
    },
  });
}

export default async function (ctx) {
  try {
    if (ctx.request?.url) await captureCookie(ctx);
    else await runCheckIn(ctx);
  } catch (error) {
    console.log(`贴吧脚本异常：${error.stack || error.message || error}`);
    ctx.notify({
      title: "❌ 贴吧脚本异常",
      body: error.message || String(error),
      sound: true,
      duration: 5,
    });
  }
}
