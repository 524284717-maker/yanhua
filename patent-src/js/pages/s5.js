/* ==========================================================================
 * s5.js —— 【S5】置信度校验与管控预警 · 页面渲染实现
 *
 * @层          页面层（pages）
 * @技术特征
 *   【特征 S6-4】本页面不直接计算任何指标，全部数值来自 renderPage(t, st) 传入的
 *                状态快照 st（由 page-shell 每帧调用一次 stateAt(t) 得到），
 *                因此页面之间、页面与数据模型之间不会出现数值不一致。
 * @说明
 *   由 tools/build-pages.py 从 tools/pages-src/s5.frag.js 自动包装生成，请勿直接修改本文件。
 * ========================================================================== */
(function (global) {
  'use strict';
  var M = global.PATENT;

  var mS5ov, mS5dt;
  function initPage() {
    mS5ov = echarts.init(document.getElementById('mapS5ov'));
    mS5dt = echarts.init(document.getElementById('mapS5dt'));
  }
  function relayout() { if (mS5ov) mS5ov.resize(); if (mS5dt) mS5dt.resize(); }

  function smallFence() {
    return {
      type: 'custom', coordinateSystem: 'geo', zlevel: 2, silent: true,
      renderItem: function (params, api) {
        var c0 = api.coord(M.WARE);
        var c1 = api.coord([M.WARE[0] + M.P.fenceR * 1.7, M.WARE[1]]);
        var r = Math.max(16, Math.abs(c1[0] - c0[0]));
        return { type: 'group', children: [
          { type: 'circle', shape: { cx: c0[0], cy: c0[1], r: r },
            style: { fill: 'rgba(0, 212, 255, 0.16)', stroke: 'rgba(0, 212, 255, 0.95)', lineWidth: 1.6, lineDash: [5, 4] } },
          { type: 'circle', shape: { cx: c0[0], cy: c0[1], r: 4 }, style: { fill: '#ff4d4f', stroke: '#fff', lineWidth: 1.2 } }
        ] };
      },
      data: [[0, 0]]
    };
  }
  function warePin(st) {
    return {
      type: 'effectScatter', coordinateSystem: 'geo', zlevel: 8,
      rippleEffect: { brushType: 'stroke', scale: 4, period: 2.6 }, symbolSize: st.alert ? 20 : 15,
      itemStyle: { color: st.alert ? '#ff4d4f' : '#ffd23f', shadowBlur: 18, shadowColor: 'rgba(255,77,79,0.95)' },
      label: {
        show: true, position: 'right', distance: 9,
        formatter: st.alert ? '【预警】目标仓储 A 库' : '目标仓储 A 库',
        color: st.alert ? '#ffb0b2' : '#ffe08a', fontSize: 12, fontWeight: 700,
        backgroundColor: 'rgba(6,26,55,0.88)', borderColor: st.alert ? 'rgba(255,77,79,0.75)' : 'rgba(0,180,255,0.5)',
        borderWidth: 1, borderRadius: 4, padding: [3, 6], textShadowColor: 'rgba(0,0,0,0.8)', textShadowBlur: 4
      },
      data: [{ name: '目标仓储', value: M.WARE }]
    };
  }

  function renderPage(t, st) {
    var c = st.conf;
    document.getElementById('cf1').style.width = c.a + '%'; document.getElementById('cv1').textContent = c.a + '%';
    document.getElementById('cf2').style.width = c.b + '%'; document.getElementById('cv2').textContent = c.b + '%';
    document.getElementById('cf3').style.width = c.c + '%'; document.getElementById('cv3').textContent = c.c + '%';
    document.getElementById('cf4').style.width = c.d + '%'; document.getElementById('cv4').textContent = c.d + '%';
    document.getElementById('confTotal').textContent = c.total.toFixed(1) + '%';
    var anyRisk = st.riskHide || st.riskBook;
    var state = t < M.TL.s5[0] ? '未进入校验阶段'
      : (!anyRisk ? '无风险，无需校验'
      : (c.pass ? '校验通过 · 风险确认' : '置信度不足 · 需人工复核'));
    document.getElementById('confState').textContent = state;
    document.getElementById('confTotal').style.color = (c.pass && anyRisk) ? '#7fe3a0' : '#8aa4bf';

    var box = document.getElementById('alertBox');
    var title = document.getElementById('alertTitle');
    var body = document.getElementById('alertBody');
    var push = document.getElementById('pushLine');

    if (st.alert) {
      box.className = 'alert-box';
      var kind = st.riskHide && st.riskBook ? '隐蔽囤货风险 + 账面造假风险'
        : (st.riskHide ? '隐蔽囤货风险' : '账面造假风险');
      title.textContent = kind + ' · 万载县烟花爆竹仓储中心 A 库（WZ-A-01）';
      var cars = M.VEHICLES.filter(function (v) { return v.stay; }).map(function (v) {
        return v.plate + '（' + v.goods + '，驾驶员 ' + v.driver + '）';
      }).join('；');
      body.innerHTML =
        '判定依据：库存饱和度峰值 <b>' + st.peakS4Pct.toFixed(1) + '%</b>（满载阈值 85%）· 车辆异常滞留指数 <b>' +
        st.index.toFixed(2) + '</b>（滞留报警阈值 0.60）· 预设时间段内饱和度降幅 <b>' + (st.bookDrop * 100).toFixed(1) +
        '%</b>，围栏内未监测到对应驶离轨迹。<br/>' +
        '滞留车辆：' + cars + '。<br/>' +
        '风险置信度 <b>' + c.total.toFixed(1) + '%</b>（阈值 85%）校验通过，风险成立。';
      push.innerHTML = '已推送：省应急管理厅 · 属地应急管理局 · 公安治安部门 &nbsp;|&nbsp; 预警编号 <b>YJ-20260826-A01</b> &nbsp;|&nbsp; 下发时间 T+' + t.toFixed(1) + '′';
      document.getElementById('alertTag').textContent = '已生成';
    } else {
      box.className = 'alert-box off';
      title.textContent = t < M.TL.s5[0] ? '尚未进入置信度校验阶段' : '未满足预警生成条件';
      body.innerHTML = t < M.TL.s5[0]
        ? '当前时刻 T+' + t.toFixed(1) + '′ 处于 S' + st.stage.no + ' 阶段，需在 T+' + M.TL.s5[0] + '′ 之后进入置信度校验。'
        : '隐蔽囤货风险：<b>' + (st.riskHide ? '成立' : '未成立') + '</b>；账面造假风险：<b>' + (st.riskBook ? '成立' : '未成立') +
          '</b>；综合置信度 <b>' + c.total.toFixed(1) + '%</b>。';
      push.textContent = '—';
      document.getElementById('alertTag').textContent = t < M.TL.s5[0] ? '等待中' : '未生成';
    }

    // 预警推送与处置跟踪
    var PUSH = [
      ['省应急管理厅 · 危化监管处', '政务云平台 · 站内消息', 'T+41.0′', '已签收'],
      ['宜春市应急管理局', '政务云平台 · 站内消息', 'T+41.0′', '已签收'],
      ['万载县应急管理局', '政务云平台 · 短信 + 站内', 'T+41.1′', '已签收'],
      ['万载县公安局治安大队', '公安视频专网 · 联动推送', 'T+41.2′', '处理中'],
      ['仓储企业负责人（WZ-A-01）', '监管服务 App · 推送', 'T+41.3′', '待反馈']
    ];
    document.getElementById('pushTag').textContent = st.alert ? '已推送 5 家单位' : '待推送';
    document.getElementById('pushTbody').innerHTML = PUSH.map(function (r) {
      var stChip = !st.alert ? '<span class="chip gray">待推送</span>'
        : (r[3] === '已签收' ? '<span class="chip ok">已签收</span>'
        : (r[3] === '处理中' ? '<span class="chip mid">处理中</span>' : '<span class="chip gray">待反馈</span>'));
      return '<tr class="' + (st.alert ? '' : '') + '"><td>' + r[0] + '</td><td>' + r[1] + '</td>' +
        '<td>' + (st.alert ? r[2] : '—') + '</td><td>' + stChip + '</td></tr>';
    }).join('');

    // GIS 地图
    mS5ov.setOption({
      animation: false,
      tooltip: Object.assign({ trigger: 'item', formatter: function (p) {
        if (p.data && p.data.plate) return '<b>' + p.data.plate + '</b><br/>坐标：' + p.data.value[0].toFixed(4) + ', ' + p.data.value[1].toFixed(4);
        if (p.name === '目标仓储') return '<b>目标仓储 A 库</b><br/>经纬度 ' + M.WARE[0].toFixed(4) + ', ' + M.WARE[1].toFixed(4);
        return p.name || '';
      } }, M.tipBase),
      geo: {
        map: 'patent_county', roam: false, zoom: 1.02, aspectScale: 1.0,
        center: [(M.BBOX[0] + M.BBOX[2]) / 2, (M.BBOX[1] + M.BBOX[3]) / 2],
        left: 16, right: 16, top: 12, bottom: 12,
        itemStyle: { areaColor: 'rgba(13, 84, 152, 0.78)', borderColor: 'rgba(0, 226, 255, 0.95)', borderWidth: 2,
          shadowColor: 'rgba(0, 150, 255, 0.75)', shadowBlur: 22 },
        emphasis: { disabled: true },
        label: { show: true, color: 'rgba(200, 232, 255, 0.92)', fontSize: 13, fontWeight: 600 }
      },
      series: [smallFence(), M.trackSeries(), warePin(st), M.vehSeries(t, 11), M.alertSeries(st, 13)]
    }, false);
    document.getElementById('gisInfo').textContent = st.alert ? '预警坐标已同步上图' : '万载县 · 县域视图';

    mS5dt.setOption({
      animation: false,
      tooltip: Object.assign({ trigger: 'item', formatter: function (p) {
        if (p.data && p.data.plate) return '<b>' + p.data.plate + '</b><br/>坐标：' + p.data.value[0].toFixed(4) + ', ' + p.data.value[1].toFixed(4) + '<br/>判定：' + (p.data.staying ? '<span style="color:#ff7875">滞留车辆</span>' : '正常');
        if (p.name === '目标仓储') return '<b>目标仓储 A 库</b><br/>经纬度 ' + M.WARE[0].toFixed(4) + ', ' + M.WARE[1].toFixed(4);
        return p.name || '';
      } }, M.tipBase),
      geo: {
        map: 'patent_county', roam: false, zoom: 11.0, aspectScale: 1.0,
        center: [M.WARE[0] - 0.0008, M.WARE[1] - 0.0006],
        left: 10, right: 10, top: 12, bottom: 10,
        itemStyle: { areaColor: 'rgba(13, 84, 152, 0.78)', borderColor: 'rgba(0, 226, 255, 0.85)', borderWidth: 2 },
        emphasis: { disabled: true }, label: { show: false }
      },
      series: [M.fenceSeries(), M.trackSeries(), M.wareSeries(st, 16), M.vehSeries(t, 17), M.alertSeries(st, 17)]
    }, false);
    document.getElementById('gisDetail').textContent = '围栏内车辆 ' + st.inFence.length + ' 辆';
    document.getElementById('coordTag').textContent = '仓储坐标 ' + M.WARE[0].toFixed(4) + ', ' + M.WARE[1].toFixed(4);
  }
  global.FWXPage = {
    no: 5,
    initPage: initPage,
    relayout: relayout,
    renderPage: renderPage
  };
})(window);
