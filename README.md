# egern-modules

## Egern 主配置模块段

将 [`Profile.modules.yaml`](./Profile.modules.yaml) 中的整个 `modules:` 段合并到
Egern 当前订阅使用的 `Profile.yaml` 顶层。该文件是配置片段，不要作为单个模块导入。

模块顺序已经安排好：应用去广告与出口小组件在前，广告平台拦截器和 HTTPDNS
拦截器这两个基础依赖位于列表最下方，以便优先生效。
