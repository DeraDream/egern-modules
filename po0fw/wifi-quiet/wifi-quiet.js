const KEY = "po0_fw_wifi_quiet";

function parseNames(raw) {
  return String(raw || "")
    .split(/[|,;、\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function (ctx) {
  const names = parseNames(ctx.env && ctx.env.wifi_names);
  const ssid = String(
    (ctx.device && ctx.device.wifi && ctx.device.wifi.ssid) || ""
  ).trim();

  ctx.storage.setJSON(KEY, {
    names,
    ssid,
    matched:
      !!ssid &&
      names.some((name) => name.toLowerCase() === ssid.toLowerCase()),
    updatedAt: Date.now(),
  });
}
