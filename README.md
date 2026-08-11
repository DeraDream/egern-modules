# egern-modules

## 高德地图去广告

Egern 原生模块：[`amap-adblock.yaml`](./amap-adblock/amap-adblock.yaml)

- 清理开屏、首页、搜索、路线规划、导航结束、附近和打车页面推广
- 使用 Egern 原生 YAML 和 `export default(ctx)` 脚本
- 不依赖会将 Egern 请求重定向至 Telegram 的 Loon 脚本地址
- 需要已安装并信任 Egern MITM 证书

## Egern 主配置模块段

将 [`Profile.modules.yaml`](./Profile.modules.yaml) 中的整个 `modules:` 段合并到
Egern 当前订阅使用的 `Profile.yaml` 顶层。该文件是配置片段，不要作为单个模块导入。

模块顺序已经安排好：应用去广告与出口小组件在前，广告平台拦截器和 HTTPDNS
拦截器这两个基础依赖位于列表最下方，以便优先生效。

## 百度贴吧自动签到

Egern 原生模块：[`tieba-checkin.yaml`](./tieba-checkin/tieba-checkin.yaml)

- 打开贴吧 App 时自动保存 Cookie
- 每天 00:01 签到关注的贴吧
- Egern 内部画廊显示今日签到状态，并可点按按钮立即执行
- 支持多账号和失败重试
- 使用 Egern 原生 `ctx.notify()` 通知签到结果


## 海外代理出口切换通知

Egern 原生模块：[`network-change-ip.yaml`](./network-change-ip/network-change-ip.yaml)

- 每 10 秒通过「🚀 节点选择」策略检测代理出口
- 仅在出口 IPv4 发生变化时通知，并显示地区、ASN 和运营商
- 初次运行会通知当前出口，检测失败最多每小时通知一次
- 通知显示 5 秒，点按通知可复制出口 IP

## TikTok 自动随节点选区

Egern 原生模块：[`tiktok-auto-region.yaml`](./tiktok-auto-region/tiktok-auto-region.yaml)

- TikTok 流量强制使用「🎵 TikTok」策略组当前选中的节点
- 地区直接跟随代理出口 IP，不使用已失效的地区重写脚本
- 不需要 MITM，不修改 TikTok 请求内容
