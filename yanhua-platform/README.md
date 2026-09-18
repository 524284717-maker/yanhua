# 江西省烟花爆竹产业全链条监管服务平台 · 工程

本工程把两个可独立运行的数字化系统的**页面、源码、资源、文档、校验脚本**收拢为一个标准工程目录，
用 VS Code 打开即可开发、预览、调试与验证。

| 系统 | 页面内显示名 | 定位 | 页面数 | 目录 |
| --- | --- | --- | --- | --- |
| 全链条监管服务平台 | **烟花爆竹监管平台** | 省—市—县—乡镇—企业五级下钻的产业态势总览与各环节专项态势 | 11 | `platform/` |
| 风险识别系统 | **烟花爆竹全链条数字化预警监管平台** | 面向仓储隐蔽囤货与账面造假的风险智能识别 | 6 | `risk/`（运行版）、`risk-src/`（源码版） |

> **命名说明**：「江西省烟花爆竹产业全链条监管服务平台」是工程/项目层的称法，出现在本 README、
> 门户页 `index.html` 与 `docs/` 文档中；11 个页面内部显示的名称为「烟花爆竹监管平台」
> （页头 `h1` 与 `<title>` 均为该名称）。改动页面前请以页面内的实际名称为准。

---

## 一、快速开始

### 方式一：直接打开页面（最快）

所有页面都是**离线单文件 HTML**，双击即可，无需服务、无需联网、无需安装任何依赖：

```
platform/index.html      监管服务平台 · 态势总览
risk/patent.html         风险识别系统 · 功能总览
index.html               工程门户（含全部页面索引）
```

### 方式二：用 VS Code 打开工程

```bash
# 1. 打开工程（二选一）
双击 yanhua-platform.code-workspace
# 或在 VS Code 中「文件 → 打开文件夹」指向本目录

# 2. 启动本地预览服务
npm run dev            # 等价于 node tools/serve.js，默认 http://127.0.0.1:5180/
```

启动后终端会直接打印 4 个入口地址。也可按 **F5** 调试 —— `preLaunchTask` 会自动拉起服务再打开浏览器。

### 方式三：运行校验

```bash
npm run check          # 语法闸门 + 引用完整性校验
npm run zip            # 打包为 yanhua-platform.zip
```

VS Code 中按 **⇧⌘B**（Windows：`Ctrl+Shift+B`）运行默认构建任务「全量校验」，
报错会以可点击诊断的形式出现在「问题」面板。

---

## 二、目录结构

```
yanhua-platform/
├── index.html                       工程门户（两个系统入口 + 全部页面索引）
│
├── platform/                        ① 监管服务平台 · 11 个页面
│   ├── index.html                   态势总览
│   ├── purchase.html                采购态势
│   ├── production.html              生产态势
│   ├── warehouse.html               仓储态势
│   ├── transport.html               运输态势
│   ├── export.html                  出口态势
│   ├── retail.html                  经营态势
│   ├── firework.html                燃放态势
│   ├── enforcement.html             打非治违
│   ├── monitor.html                 智能监控中心
│   └── admin.html                   业务管理
│
├── risk/                            ② 风险识别系统 · 6 个运行版页面
│   ├── patent.html                  功能总览
│   └── patent-s1.html ~ patent-s5.html   5 项核心功能各一页
│
├── risk-src/                        ② 风险识别系统 · 模块化源码版
│   ├── js/core/                     14 个算法单元（S0~S6 共 27 项技术特征）
│   ├── js/compat/export-patent.js   接口兼容层：FWCore → PATENT
│   ├── js/render/                   页面外壳（时钟 / 主循环 / 时刻冻结钩子）
│   ├── js/pages/s1~s5.js            5 个功能页的渲染实现
│   ├── pages/                       组装产物（6 个可直接打开的页面）
│   ├── css/platform.css             共享样式
│   ├── tools/                       组装、基准生成、两项等价性自检
│   └── README.md                    源码包专项说明（含加载顺序契约）
│
├── shared/                          共享资源
│   ├── geo-data.js                  江西省省市县真实边界 GeoJSON（约 900 KB）
│   └── patent-model.js              风险识别数据模型（单文件版）
│
├── assets/                          图片资源
│   ├── brand-icon.png               系统品牌图标
│   └── cam/cam1~6.jpg               监控中心抓拍图
│
├── docs/                            文档
│   ├── 01-平台说明.md               监管服务平台说明
│   ├── 02-风险识别系统说明.md       风险识别系统说明
│   ├── 技术特征对照表.md            技术特征 ↔ 源码/函数/阈值/效果 逐项对照
│   └── 技术特征对照表.html          上表的可读 HTML 版
│
├── tools/                           工程工具（零第三方依赖）
│   ├── serve.js                     本地静态预览服务
│   ├── check-syntax.js              语法闸门（只编译不执行）
│   ├── check-links.js               引用完整性校验
│   └── make-zip.sh                  打包 ZIP 并校验归档完整性
│
├── .vscode/                         编辑器配置
│   ├── settings.json                编码 / 缩进 / 搜索排除 / Live Server 端口
│   ├── tasks.json                   任务面板（服务器、校验、组装、自检、打包）
│   ├── launch.json                  Chrome 调试配置（3 条，自动拉起服务）
│   └── extensions.json              推荐扩展
│
├── package.json                     npm 脚本（无第三方依赖）
├── .gitignore
└── yanhua-platform.code-workspace   双击即可在 VS Code 打开
```

---

## 三、两套风险识别页面的关系

`risk/` 与 `risk-src/pages/` 是**同一系统的两种形态**，功能完全等价：

| | `risk/`（运行版） | `risk-src/pages/`（源码版） |
| --- | --- | --- |
| 数据模型 | `shared/patent-model.js`（单文件 507 行） | `risk-src/js/core/`（14 个模块） |
| 页面脚本 | 内嵌在 HTML 的 `<script>` 中 | `risk-src/js/render/` + `js/pages/` 外链 |
| 样式 | 内嵌 `<style>` | `risk-src/css/platform.css` |
| 适用场景 | 演示、交付、快速查看 | 阅读算法、评审、二次开发 |
| 等价性 | 基准 | **完全等价**（两项自检自动校验，见下） |

> 两份都不会自动同步。改了源码版要重新组装页面（见第五节）；改了运行版则需重建对照基准。
> 若只关心演示效果，只看 `risk/` 即可。

---

## 四、可复用的约定

改这个工程前先了解三条硬约定，否则容易白改：

1. **`risk-src/tools/pages-src/` 是页面正文与脚本的真源。**
   直接改 `risk-src/pages/*.html` 会在下次重跑 `build-pages.py` 时被覆盖。要改页面，改 `pages-src/` 再重跑组装。

2. **`risk-src/js/core/` 的加载顺序就是契约。**
   `11-timeline.js` 是唯一「加载期执行计算」的模块（全时间线预计算），必须排在最后；顺序集中定义在
   `risk-src/tools/build-pages.py` 的 `CORE_MODULES` 常量中，是唯一真源。

3. **`shared/` 与 `assets/` 由跨目录引用指向。**
   `platform/*.html`、`risk/*.html` 用 `../shared/` 与 `../assets/`；
   `risk-src/pages/*.html` 与 `risk-src/tools/*` 用 `../../shared/`。
   移动页面时务必同步改这两类引用 —— `npm run check:links` 会立刻发现漏改。

---

## 五、常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地预览服务（`http://127.0.0.1:5180/`） |
| `npm run check` | 语法闸门 + 引用完整性校验（等价于 ⇧⌘B） |
| `npm run check:syntax` | 只做语法校验：25 个 HTML 的内联脚本 + 25 个独立 .js 模块 |
| `npm run check:links` | 只做引用校验：25 个成品的全部本地引用 |
| `python3 risk-src/tools/build-pages.py` | 改 `pages-src/` 后重新组装风险识别页面 |
| `python3 risk-src/tools/build-legacy.py` | 由 `risk/` 重建等价性对照基准页 |
| `npm run check:equivalence` | 界面等价性自检（5 页 × 23 个冻结时刻，需 `agent-browser`） |
| `npm run zip` | 打包 `yanhua-platform.zip` 并校验归档完整 |

---

## 六、等价性验证

风险识别系统的模块化重构经过两项自动自检，两者都可随时复跑：

| 自检 | 入口 | 规模 | 结论 |
| --- | --- | --- | --- |
| **数值等价** | 浏览器打开 `risk-src/tools/equivalence-test.html` | 55,610 项 | 差异 **0** 项，最大绝对误差 **0** |
| **界面等价** | `bash risk-src/tools/dom-diff.sh` | 115 组（5 页 × 23 冻结时刻） | **全部一致** |

界面自检会同时比对 `document.body.innerText` 与**全部 ECharts 实例的 `getOption()` 序列化结果** ——
canvas 内容不进 `innerText`，阈值线、颜色、数值都在图表配置里，只比文本会漏掉一半。

工程层面的健康度：

| 校验项 | 规模 | 结论 |
| --- | --- | --- |
| 源码语法 | 37 个 HTML（25 个内联脚本块）+ 25 个独立 .js 模块 | 全部通过 |
| 本地引用完整性 | 26 个成品页面、393 处本地引用 | 全部可解析，无路径越界 |
| 页面运行 | 24 个页面（平台 11 + 风险运行版 6 + 风险源码版 6 + 门户） | 0 JS 报错 |
| 下钻交互 | 五级页（生产等 6 页）达企业级；四级页（经营、燃放）止于乡镇级 | 面包屑跳转、返回按钮均正常 |

> 说明：首页「实时预警」列表存在一处**原文件既有**的裁切 —— `.warning-list` 高 148px、
> 内容 240px，且 `overflow-y: visible`，多出的约 78px 被父容器 `.col`（`overflow: hidden`）裁掉。
> 该现象在搬迁前的工作区根目录 `index.html` 中**完全一致**（实测数值相同），不是本次工程化引入的问题。
> 如需修复，与「预警未处置 Top5 企业」看板同样的两行样式即可：给 `.warning-list` 加 `overflow-y:auto`，
> 并给其子项加 `flex: 0 0 auto`。

---

## 七、文档索引

| 文档 | 内容 |
| --- | --- |
| `docs/01-平台说明.md` | 监管服务平台：页面清单、导航结构、五级下钻机制、指标体系 |
| `docs/02-风险识别系统说明.md` | 风险识别系统：5 项功能、算法与判定阈值、时间线设计 |
| `docs/技术特征对照表.html` | 技术特征 ↔ 文件:行号 ↔ 函数 ↔ 参数 ↔ 技术效果 逐项对照（含 11 项权利要求建议对照） |
| `risk-src/README.md` | 源码包结构、不可调整的加载顺序、与旧版单文件实现的关系 |

---

## 八、环境要求

| 用途 | 要求 | 说明 |
| --- | --- | --- |
| 打开页面 | 现代浏览器（Chrome / Edge） | 页面自带 ECharts CDN 引用；离线环境图表会不显示，其余功能与版式正常 |
| 预览服务 / 校验 | Node.js ≥ 14 | 仅用内置模块，**无需 `npm install`** |
| 页面组装 / 基准生成 | Python ≥ 3.8 | 仅用标准库 |
| 界面等价性自检 | `agent-browser` CLI | 可选，缺省时跳过该项即可 |

> 工程**零第三方依赖**，没有 `node_modules`。ECharts 5.4.3 通过 CDN 引入，
> 若需完全离线运行，可将 `echarts.min.js` 放入 `shared/` 并把各页面的 CDN 链接改为本地相对路径。
