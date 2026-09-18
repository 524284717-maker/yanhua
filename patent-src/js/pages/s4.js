/* ==========================================================================
 * s4.js —— 【S4】双风险判定 · 页面渲染实现
 *
 * @层          页面层（pages）
 * @技术特征
 *   【特征 S6-4】本页面不直接计算任何指标，全部数值来自 renderPage(t, st) 传入的
 *                状态快照 st（由 page-shell 每帧调用一次 stateAt(t) 得到），
 *                因此页面之间、页面与数据模型之间不会出现数值不一致。
 * @说明
 *   由 tools/build-pages.py 从 tools/pages-src/s4.frag.js 自动包装生成，请勿直接修改本文件。
 * ========================================================================== */
(function (global) {
  'use strict';
  var M = global.PATENT;

  var s4Chart;
  function initPage() { s4Chart = echarts.init(document.getElementById('s4Chart')); }
  function relayout() { if (s4Chart) s4Chart.resize(); }

  function setKV(id, txt, hot, ok) {
    var el = document.getElementById(id);
    el.className = 'kv' + (hot ? ' hot' : (ok ? ' ok' : ''));
    el.querySelector('.v').innerHTML = txt;
  }

  function renderPage(t, st) {
    var satOk = st.sat >= M.P.fullRatio, idxOk = st.index >= M.P.stayThreshold;
    var dropOk = st.bookDrop >= M.P.bookDrop, depOk = st.noDeparture;
    var bookCond = st.bookActive && dropOk && depOk;

    document.getElementById('ruleState').textContent =
      'S(t) ' + st.satPct.toFixed(1) + '%（峰值 ' + st.peakS4Pct.toFixed(1) + '%）· I(t) ' + st.index.toFixed(2) +
      ' · ΔS ' + (st.bookDrop * 100).toFixed(1) + '% · 驶离轨迹 ' + (st.bookActive ? (st.noDeparture ? '未监测到' : '已监测到') : '监测中');

    document.getElementById('stHide').textContent = st.riskHide ? '风险成立' : '未触发';
    document.getElementById('riskHide').className = 'risk-card' + (st.riskHide ? ' hit' : '');
    document.getElementById('stBook').textContent = bookCond ? '风险成立' : (st.bookActive ? '判定中' : '未触发');
    document.getElementById('riskBook').className = 'risk-card' + (bookCond ? ' hit' : (st.bookActive ? ' pend' : ''));

    // 判定式代入
    document.getElementById('fA_t').textContent = t.toFixed(1);
    var elA_s = document.getElementById('fA_s'); elA_s.textContent = st.satPct.toFixed(1) + '%';
    elA_s.className = satOk ? 'y' : 'n';
    var elA_i = document.getElementById('fA_i'); elA_i.textContent = st.index.toFixed(2);
    elA_i.className = idxOk ? 'y' : 'n';
    var elA_r = document.getElementById('fA_r'); elA_r.textContent = st.riskHide ? '风险成立' : '不成立';
    elA_r.className = st.riskHide ? 'y' : 'n';

    document.getElementById('fB_t').textContent = t.toFixed(1);
    document.getElementById('fB_p').innerHTML = (st.peakS4Pct).toFixed(1) + '%';
    document.getElementById('fB_c').innerHTML = st.satPct.toFixed(1) + '%';
    var elB_d = document.getElementById('fB_d'); elB_d.innerHTML = (st.bookDrop * 100).toFixed(1) + '%' + (dropOk ? ' ≥' : ' &lt;');
    elB_d.className = dropOk ? 'y' : 'n';
    var elB_dep = document.getElementById('fB_dep'); elB_dep.textContent = st.noDeparture ? '未监测到' : '已监测到';
    elB_dep.className = depOk ? 'y' : 'n';
    var elB_r = document.getElementById('fB_r'); elB_r.textContent = bookCond ? '风险成立' : (st.bookActive ? '判定中' : '未进入判定窗口');
    elB_r.className = bookCond ? 'y' : 'n';

    setKV('kSat', st.satPct.toFixed(1) + '<small>%</small>', satOk);
    setKV('kPeak', st.peakS4Pct.toFixed(1) + '<small>%</small>', st.peakS4 >= M.P.fullRatio);
    setKV('kIdx', st.index.toFixed(2), idxOk);
    setKV('kStay', st.stayCount + '<small>辆</small>', st.stayCount >= 3);
    setKV('kDrop', (st.bookDrop * 100).toFixed(1) + '<small>%</small>', dropOk);
    setKV('kDep', st.bookActive ? (st.noDeparture ? '未监测到' : '已监测到') : '监测中', false, st.bookActive && depOk);

    document.getElementById('s4Tag').textContent = st.riskHide || bookCond ? '已触发风险' : '判定中';
    document.getElementById('triggerTag').textContent = 'T+' + t.toFixed(1) + '′';

    var xs = [], sats = [], idxs = [];
    for (var tt = 0; tt <= M.TL.end + 1e-9; tt += 0.5) {
      xs.push(tt.toFixed(1));
      sats.push(+(M.satAt(tt) * 100).toFixed(2));
      idxs.push(+M.stagnationAt(tt).index.toFixed(3));
    }
    var ht = M.DERIVED.riskHideFrom, bt = M.DERIVED.bookFrom, at = M.DERIVED.alertFrom;
    var mlA = [
      { yAxis: 85, yAxisIndex: 0, lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1.4 },
        label: { formatter: '满载阈值 85%', color: '#ff9d9f', fontSize: 10 } },
      { xAxis: Math.round(t / 0.5), lineStyle: { color: '#ffd23f', width: 1.6 },
        label: { formatter: 'T+' + t.toFixed(1) + '′', color: '#ffe08a', fontSize: 10.5 } }
    ];
    if (ht !== null) mlA.push({ xAxis: Math.round(ht / 0.5), lineStyle: { color: 'rgba(255,77,79,0.85)', type: 'dotted', width: 1.6 },
      label: { formatter: '隐蔽囤货成立 T+' + ht.toFixed(1) + '′', color: '#ff6b6d', fontSize: 10.5, position: 'insideEndTop' } });
    var mlB = [
      { yAxis: 0.60, yAxisIndex: 1, lineStyle: { color: 'rgba(255,159,46,0.7)', type: 'dashed', width: 1.3 },
        label: { formatter: '滞留报警阈值 0.60', color: '#ffc078', fontSize: 10 } }
    ];
    if (bt !== null) mlB.push({ xAxis: Math.round(bt / 0.5), lineStyle: { color: 'rgba(255,77,79,0.85)', type: 'dotted', width: 1.4 },
      label: { formatter: '账面造假成立 T+' + bt.toFixed(1) + '′', color: '#ff9d9f', fontSize: 10.5, position: 'insideEndBottom' } });
    if (at !== null) mlB.push({ xAxis: Math.round(at / 0.5), lineStyle: { color: 'rgba(34,197,94,0.85)', type: 'dotted', width: 1.4 },
      label: { formatter: '预警下发 T+' + at.toFixed(1) + '′', color: '#8ff0b0', fontSize: 10.5, position: 'insideStartBottom' } });

    s4Chart.setOption({
      grid: { left: 50, right: 56, top: 30, bottom: 26 },
      tooltip: Object.assign({ trigger: 'axis' }, M.tipBase),
      legend: { data: ['库存饱和度 S(t)', '异常滞留指数 I(t)'], right: 8, top: 0, textStyle: { color: '#8aa4bf', fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
      xAxis: { type: 'category', data: xs, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        axisLabel: { color: '#7f9ab3', fontSize: 10, interval: 19 }, axisTick: { show: false } },
      yAxis: [
        { type: 'value', min: 50, max: 95, name: '饱和度%', nameTextStyle: { color: '#7f9ab3', fontSize: 10 },
          axisLabel: { color: '#7f9ab3', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.07)' } } },
        { type: 'value', min: 0, max: 1, name: '滞留指数', nameTextStyle: { color: '#7f9ab3', fontSize: 10 },
          axisLabel: { color: '#7f9ab3', fontSize: 10 }, splitLine: { show: false } }
      ],
      series: [
        { name: '库存饱和度 S(t)', type: 'line', data: sats, smooth: true, symbol: 'none', yAxisIndex: 0,
          lineStyle: { width: 2.4, color: '#00d4ff' },
          areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0,212,255,0.35)' }, { offset: 1, color: 'rgba(0,212,255,0.02)' }]) },
          markLine: { silent: true, symbol: 'none', data: mlA } },
        { name: '异常滞留指数 I(t)', type: 'line', data: idxs, smooth: true, symbol: 'none', yAxisIndex: 1,
          lineStyle: { width: 2.2, color: '#ff9f2e' },
          markLine: { silent: true, symbol: 'none', data: mlB } }
      ]
    }, true);

    document.getElementById('tHide').textContent = ht ? 'T+' + ht.toFixed(1) + '′ 判定成立（饱和度与滞留指数双超阈）' : '尚未触发';
    document.getElementById('tBook').textContent = bt ? 'T+' + bt.toFixed(1) + '′ 判定成立（降幅超 15% 且无驶离轨迹）' : '尚未触发';
    document.getElementById('tAlert').textContent = at ? 'T+' + at.toFixed(1) + '′ 置信度校验通过，预警下发' : '尚未触发';
  }
  global.FWXPage = {
    no: 4,
    initPage: initPage,
    relayout: relayout,
    renderPage: renderPage
  };
})(window);
