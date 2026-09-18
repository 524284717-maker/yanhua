/* ==========================================================================
 * 04-op-dataset.js —— 扫码出入库流水数据集
 *
 * @层          数据模型层（core）
 * @技术特征
 *   【特征 S1-1】扫码出入库流水 OP：每条记录由 (时刻 at, 方向 act, 品名 name, 量 qty)
 *                四元组构成，是 S1 库存饱和度计算、S4 账面下降幅度计算的唯一数据来源。
 *   【特征 S4-4】phantom 标记：标记「已在系统登记出库、但围栏内未监测到对应车辆驶离轨迹」
 *                的记录。该标记使「账面动作」与「物理动作」可在同一条流水上直接对照。
 * @说明
 *   数据集按时刻升序排列（构造末尾统一 sort），因此所有指标可用单次线性扫描求值。
 * ========================================================================== */
(function (NS) {
  'use strict';

  /** 【特征 S1-1】扫码出入库流水（含 S4-4 phantom 标记）。 */
  var OP = [
    // S1（T+0~9）：常规出入库
    { at: 0.6,  act: 'in',  name: '组合烟花（产成品）', qty: 12.6 },
    { at: 2.0,  act: 'in',  name: '爆竹类（产成品）',   qty: 18.4 },
    { at: 3.4,  act: 'out', name: '组合烟花（发运）',   qty: 9.8 },
    { at: 4.8,  act: 'in',  name: '黑火药（原料）',     qty: 6.2 },
    { at: 6.2,  act: 'in',  name: '喷花类（产成品）',   qty: 14.2 },
    { at: 7.8,  act: 'in',  name: '引火线（原材料）',   qty: 3.6 },
    // S2（T+9~17）：电子围栏构建、轨迹接入
    { at: 9.4,  act: 'out', name: '爆竹类（发运）',     qty: 12.1 },
    { at: 10.8, act: 'in',  name: '组合烟花（产成品）', qty: 21.4 },
    { at: 12.2, act: 'in',  name: '升空类（产成品）',   qty: 11.8 },
    { at: 13.6, act: 'in',  name: '玩具烟花（产成品）', qty: 9.2 },
    { at: 15.0, act: 'out', name: '喷花类（发运）',     qty: 8.6 },
    { at: 16.4, act: 'in',  name: '黑火药（原料）',     qty: 4.8 },
    // S3（T+17~32）：入库集中放量，饱和度突破满载阈值
    { at: 17.6, act: 'in',  name: '爆竹类（产成品）',   qty: 18.6 },
    { at: 19.0, act: 'in',  name: '喷花类（产成品）',   qty: 14.2 },
    { at: 20.4, act: 'out', name: '升空类（发运）',     qty: 7.4 },
    { at: 21.8, act: 'in',  name: '组合烟花（产成品）', qty: 14.4 },
    { at: 23.2, act: 'in',  name: '玩具烟花（产成品）', qty: 11.6 },
    { at: 24.6, act: 'in',  name: '组合烟花（产成品）', qty: 19.2 },
    { at: 26.0, act: 'out', name: '喷花类（发运）',     qty: 6.2 },
    { at: 27.4, act: 'in',  name: '爆竹类（产成品）',   qty: 16.8 },
    { at: 28.8, act: 'in',  name: '组合烟花（产成品）', qty: 24.4 },
    { at: 30.0, act: 'in',  name: '黑火药（原料）',     qty: 12.6 },
    { at: 31.4, act: 'out', name: '玩具烟花（发运）',   qty: 5.2 },
    // S4 前半段（T+32~36）：饱和度维持 86% 以上
    { at: 32.8, act: 'in',  name: '组合烟花（产成品）', qty: 10.4 },
    { at: 34.2, act: 'out', name: '喷花类（发运）',     qty: 4.6 },
    { at: 35.6, act: 'in',  name: '爆竹类（产成品）',   qty: 8.2 },
    // S4 后半段（T+36~41）：批量「扫码出库」但围栏内无驶离轨迹
    { at: 36.8, act: 'out', name: '组合烟花（发运）',   qty: 26.4, phantom: true },
    { at: 37.8, act: 'out', name: '爆竹类（发运）',     qty: 28.6, phantom: true },
    { at: 38.8, act: 'out', name: '喷花类（发运）',     qty: 24.8, phantom: true },
    { at: 39.8, act: 'out', name: '升空类（发运）',     qty: 30.2, phantom: true },
    { at: 40.6, act: 'out', name: '组合烟花（发运）',   qty: 22.4, phantom: true },
    // S5（T+41~60）：账面仍在「发货」，滞留车辆始终未驶离
    { at: 42.4, act: 'out', name: '玩具烟花（发运）',   qty: 18.6, phantom: true },
    { at: 44.6, act: 'out', name: '黑火药（发运）',     qty: 15.4, phantom: true },
    { at: 47.0, act: 'out', name: '爆竹类（发运）',     qty: 12.8, phantom: true },
    { at: 50.0, act: 'out', name: '组合烟花（发运）',   qty: 10.2, phantom: true },
    { at: 53.0, act: 'out', name: '喷花类（发运）',     qty: 8.4,  phantom: true },
    { at: 56.0, act: 'out', name: '升空类（发运）',     qty: 6.2,  phantom: true }
  ].sort(function (a, b) { return a.at - b.at; });

  NS.__declare('04-op-dataset', ['OP']);
  NS.OP = OP;
})(window.FWCore);
