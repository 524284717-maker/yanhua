/* ==========================================================================
 * page-shell.js —— 页面外壳框架（渲染层）
 *
 * @层          渲染层（render）
 * @技术特征
 *   【特征 S6-2】监测时钟驱动：以 requestAnimationFrame 为主时钟，把真实经过时间 dt
 *                折算为监测时刻增量（dt × 1.15 × 3，即约 3 倍速推进），
 *                到达时间线终点后回到 T+0 循环播放；页面只负责实现 renderPage(t, st)，
 *                不关心时钟与数据，从而保证「同一时刻各页数值一致」不会因页面差异被破坏。
 *   【特征 S6-4】单一状态入口：每次刷新只调用一次 stateAt(t)，
 *                然后把整份状态快照交给页面的 renderPage(t, st)，
 *                页面不再各自调用数据函数，从机制上排除各页取值不一致。
 *   【特征 S6-6】测试钩子：__setT(t) / __setPaused(v) / __getT() 供等价性自检使用，
 *                可把页面冻结在任意监测时刻并重绘，使界面比对可复现。
 * @说明
 *   本模块不含任何业务计算，全部指标来自 window.PATENT（数据模型层）。
 * ========================================================================== */
(function (global) {
  'use strict';

  var M = null;        // 数据模型（window.PATENT）
  var impl = null;     // 页面实现（window.FWXPage）

  var T = 0;           // 当前监测时刻（分钟）
  var lastTs = 0;      // 上一帧时间戳
  var paused = false;  // 是否暂停推进（自检用）
  var elTick = null, elStep = null;

  /* ---------------- 自适应缩放（1920×1080 设计稿） ---------------- */
  function fitScreen() {
    var el = document.querySelector('.screen');
    var s = Math.min(global.innerWidth / 1920, global.innerHeight / 1080);
    el.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
  }

  function fmtT(t) { return 'T+' + t.toFixed(1) + '′'; }

  /* ---------------- 阶段导航 ---------------- */
  function syncLinks() {
    document.querySelectorAll('a[data-step]').forEach(function (a) {
      a.setAttribute('href', 's' + a.getAttribute('data-step') + '.html');
    });
    var navs = document.querySelectorAll('.step-nav a[data-step]');
    navs.forEach(function (a) {
      a.classList.toggle('active', +a.getAttribute('data-step') === impl.no);
    });
  }

  /* ---------------- 单次刷新 ---------------- */
  function paint() {
    var st = M.stateAt(T);                       // 【特征 S6-4】每帧只取一次状态
    elTick.textContent = fmtT(T);
    elStep.textContent = st.stage.done
      ? 'S1-S5 全流程已完成'
      : ('S' + st.stage.no + ' / S5 · 当前查看 S' + impl.no);
    elStep.classList.toggle('done', st.stage.done);
    syncLinks();
    impl.renderPage(T, st);
  }

  /* ---------------- 主循环：进页即自动推进 ---------------- */
  function tick(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min(0.12, (ts - lastTs) / 1000);
    lastTs = ts;
    if (!paused) {
      T += dt * 1.15 * 3;                        // 约 3 倍速，60 分钟约 17 秒一轮
      if (T > M.TL.end) { T = 0; if (impl.onReset) impl.onReset(); }
      paint();
    }
    requestAnimationFrame(tick);
  }

  function relayout() { if (impl && impl.relayout) impl.relayout(); }

  /* ---------------- 启动装配 ---------------- */
  /**
   * @param {object} page 页面实现对象 {no, initPage, relayout, renderPage, onReset?}
   */
  function boot(page) {
    M = global.PATENT;
    impl = page;

    elTick = document.getElementById('flowTick');
    elStep = document.getElementById('stepTag');

    fitScreen();
    global.addEventListener('resize', fitScreen);

    document.getElementById('btnReset').addEventListener('click', function () {
      T = 0; lastTs = 0;
      if (impl.onReset) impl.onReset();
      paint();
    });

    M.registerMaps();
    impl.initPage();
    paint();

    global.addEventListener('resize', function () { setTimeout(relayout, 60); });
    /* 【约定】首次布局稳定后再对齐一次画布尺寸：
       若 .screen 纵向分配在加载后被改变（如删除区块），
       立即 relayout 会读到与最终布局不一致的容器高度，导致 ECharts 画布溢出约 4px。 */
    setTimeout(relayout, 220);

    requestAnimationFrame(tick);
  }

  /* ---------------- 【特征 S6-6】等价性自检钩子 ---------------- */
  global.__paint = paint;
  global.__setT = function (t) { T = t; lastTs = 0; paused = true; paint(); };
  global.__setPaused = function (v) { paused = !!v; lastTs = 0; };
  global.__getT = function () { return T; };

  global.FWShell = { boot: boot, paint: paint, relayout: relayout };
})(window);
