# 专利申请源代码包 —— 烟花爆竹全链条数字化预警监管平台

> 本目录是**风险智能识别系统（6 个页面）的工程化源码包**，用于发明专利技术交底的代码附件。
>
> 源码按「**数据模型（core）→ 兼容导出（compat）→ 渲染框架（render）→ 页面实现（pages）**」四层组织，
> 每个算法单元独立成文件，并在文件头以 `@技术特征` 标注其对应的权利要求技术特征。
>
> 源码包与线上运行的 6 个页面（`../patent.html`、`../patent-s1..s5.html`）功能完全等价，
> 等价性由 `tools/equivalence-test.html`（数值等价）与 `tools/dom-diff.html`（界面等价）自动校验。

---

## 一、系统在做什么

对烟花爆竹仓储环节，利用**已有的扫码出入库数据 + 新增的车辆定位轨迹数据**，
在**同一条时间轴上**依次完成 5 项计算与判定，最终输出「隐蔽囤货」与「账面造假」两类风险结论：

| 阶段 | 功能 | 核心输出 |
| --- | --- | --- |
| S1 T+0~9′ | 库存饱和度计算 | `S(t) = Q(t) / C` |
| S2 T+9~17′ | 电子围栏与车辆轨迹 | 围栏内车辆定位轨迹、围栏内车辆集合 |
| S3 T+17~32′ | 滞留车辆筛选与滞留指数 | 滞留车辆集合 `V_stay(t)`、异常滞留指数 `I(t)` |
| S4 T+32~41′ | 双风险判定 | `Risk_Hidden`、`Risk_Phantom` |
| S5 T+41~60′ | 置信度校验与管控预警 | `C(t)`、管控预警 + GIS 坐标呈现 |

关键设计：**所有指标都是「监测时刻 t 的纯函数」**，并且风险判定采用
「预计算时间线 + 峰值锁存」而非逐帧增量判断，因此判定结果与帧序、播放速度、页面刷新完全无关
（见 `js/core/11-timeline.js`）。

---

## 二、目录结构

```
patent-src/
├── README.md                      本文件
├── 技术特征对照表.md               权利要求技术特征 ↔ 源码文件/函数/阈值/效果 对照
├── 技术特征对照表.html             上表的可读 HTML 版
├── css/
│   └── platform.css               共享样式（深蓝科技感大屏，非创新点）
├── js/
│   ├── core/                      ★ 数据模型层（创新点实现，按算法单元拆分）
│   │   ├── 00-namespace.js        FWCore 命名空间与模块注册约定
│   │   ├── 01-params.js           S0 系统阈值参数集 P / 功能时间线 TL / 考察窗口 BOOK_WIN
│   │   ├── 02-geometry.js         平面几何基础函数（路径插值、点距）
│   │   ├── 03-geo-anchor.js       目标仓储地理锚定（省→市→县 GeoJSON 解析、质心/外接框）
│   │   ├── 04-op-dataset.js       扫码出入库流水数据集 OP（含 phantom 无轨迹标记）
│   │   ├── 05-vehicles.js         运输车辆定义、进出场路径、围栏内停靠点散布
│   │   ├── 06-s1-saturation.js    【S1】库存饱和度 S(t)
│   │   ├── 07-s2-geofence.js      【S2】电子围栏与车辆轨迹判定
│   │   ├── 08-s3-stagnation.js    【S3】滞留车辆筛选与异常滞留指数 I(t)
│   │   ├── 09-s4-dual-risk.js     【S4】双风险判定式 A / B
│   │   ├── 10-s5-confidence.js    【S5】多源数据置信度校验 C(t)
│   │   ├── 11-timeline.js         时间线预计算（判定与帧序解耦）
│   │   ├── 12-aggregate.js        状态聚合 stateAt(t) / 阶段机 stageAt(t)
│   │   └── 13-map-layers.js       GIS 5 个图层构造 + 地图注册
│   ├── compat/
│   │   └── export-patent.js       把 FWCore 导出为 window.PATENT（接口兼容层）
│   ├── render/
│   │   ├── page-shell.js          页面外壳框架：等比缩放、监测时钟、主循环、重置
│   │   └── boot.js                页面启动装配
│   └── pages/
│       ├── s1.js … s5.js          5 个功能页各自的渲染实现（renderPage / initPage）
├── pages/
│   ├── index.html                 系统功能总览
│   └── s1.html … s5.html          5 个功能页（可直接双击打开）
└── tools/
    ├── build-pages.py             由 pages-src/ + css/ 组装 pages/ 与 js/pages/
    ├── pages-src/                 页面正文片段与页面脚本源（可编辑）
    ├── build-legacy.py            生成旧版对照基准（注入时刻冻结钩子）
    ├── equivalence-test.html      ★ 数值等价性自检（新版模块 vs 旧版单文件，t=0~60）
    ├── dom-diff.sh                ★ 界面等价性自检（新版页面 vs 旧版页面，冻结时刻逐页比对）
    ├── md2html.py                 由 技术特征对照表.md 生成可读 HTML
    └── legacy/                    旧版单文件页面（等价性对照基准，含测试用时间钩子）
```

---

## 三、加载顺序（不可调整）

`core` 各模块之间存在**单向依赖**，且 `11-timeline.js` 会在**加载时**完成全时间线预计算，
因此必须严格按编号顺序加载：

```
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13
→ compat/export-patent.js
→ render/page-shell.js
→ render/boot.js
→ pages/sN.js（必须先于 boot.js 加载）
```

依赖关系（`A → B` 表示 A 在加载期需要 B 已就绪）：

```
01 params ─┬→ 05 vehicles ─→ 07 geofence ─┐
02 geometry┘                              ├→ 11 timeline → 12 aggregate → 13 map-layers
03 geo-anchor ─→ 05 vehicles              │
04 op-dataset ─→ 06 s1                    │
07 ─→ 08 s3 ─→ 11                         │
09 s4 (纯判定式) ─→ 11                     │
10 s5 (纯函数) ─→ 11 ──────────────────────┘
```

> `11-timeline.js` 是唯一的「加载期执行」模块；其余模块只做定义，不做计算。
> 这样可以保证 6 个页面无论从哪一页进入，`DERIVED` 的判定时刻（`riskHideFrom` / `bookFrom` / `alertFrom`）完全相同。

---

## 四、如何运行

### 1. 直接打开页面（推荐）

```bash
# 页面互不依赖构建，双击即可打开
open patent-src/pages/index.html
```

页面通过 `<script src>` 以经典脚本方式加载本地模块，**无需打包、无需本地服务器**。
唯一的外部依赖是工作区根目录的 `../../geo-data.js`（江西省行政区划 GeoJSON，公开数据，非创新点）。

### 2. 重新组装页面（仅在修改 `tools/pages-src/` 后需要）

```bash
/Users/xuhongtao/.workbuddy/binaries/python/versions/3.13.12/bin/python3 patent-src/tools/build-pages.py
```

### 3. 等价性自检（两项，均应 PASS）

```bash
# ① 数值等价：逐时刻比对全部导出量（55,610 项）
open patent-src/tools/equivalence-test.html

# ② 界面等价：5 个页面 × 23 个冻结时刻，比对 DOM 文本 + 全部 ECharts 配置（115 组）
bash patent-src/tools/dom-diff.sh          # 需要 agent-browser 在 PATH 中
```

数值自检页以 `PASS / FAIL` 大字提示结果，并列出差异明细；
界面自检在终端逐时刻打印哈希，末尾给出总结论与退出码（0 = PASS）。

---

## 五、与旧版单文件实现的关系

| | 旧版（线上运行） | 本源码包 |
| --- | --- | --- |
| 数据模型 | `patent-model.js` 单文件 507 行 | `js/core/` 14 个模块 |
| 页面脚本 | 内嵌在 `patent-sN.html` 的 `<script>` 中 | `js/render/` + `js/pages/` 外链模块 |
| 样式 | 内嵌 `<style>` | `css/platform.css` |
| 全局接口 | `window.PATENT` | `window.FWCore`，经 `compat/export-patent.js` 导出为 `window.PATENT` |
| 数值行为 | 基准 | **完全等价**（`equivalence-test.html` 自动校验） |

旧版页面可继续使用，源码包不修改、不替换任何线上文件。

---

## 六、代码阅读建议（按专利技术特征顺序）

1. `js/core/01-params.js` —— 先看全部阈值参数，这是权利要求的数值边界。
2. `js/core/06-s1-saturation.js` → `07` → `08` —— S1~S3 的单时刻计算。
3. `js/core/09-s4-dual-risk.js` —— 两条判定式，是整个方案的核心。
4. `js/core/10-s5-confidence.js` —— 多源置信度校验。
5. `js/core/11-timeline.js` —— 为什么判定结果与帧序无关。
6. `js/core/12-aggregate.js` —— 任意时刻的完整状态快照。

配套说明：`技术特征对照表.md`（同时提供可读的 `技术特征对照表.html`）。

---

## 七、等价性验证结论（实测）

| 校验项 | 方法 | 规模 | 结果 |
| --- | --- | --- | --- |
| 数值等价 | `tools/equivalence-test.html` | 55,610 项 | **PASS，差异 0 项，最大绝对误差 0** |
| 接口覆盖 | 旧版每个导出项在新版同名同类型 | 48 项 | PASS |
| 判定时刻 | 隐蔽囤货 32.0′ / 账面造假 40.6′ / 管控预警 41.0′ | 3 项 | 新旧完全一致 |
| 界面等价 | `tools/dom-diff.sh`（DOM 文本 + 全部 ECharts 配置） | 115 组 | **PASS，全部一致** |
| 页面健康度 | 6 个页面 JS 报错 / 面板溢出 | 6 页 | 0 报错、0 溢出 |
