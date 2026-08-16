(function () {
  var STORY_W = 1080;
  var STORY_H = 1920;

  var currentPage = document.body.getAttribute('data-current-page');
  if (currentPage) {
    document.querySelectorAll('.sidebar-link').forEach(function (link) {
      if (link.getAttribute('data-page') === currentPage) {
        link.classList.add('sidebar-link-active');
      } else {
        link.classList.remove('sidebar-link-active');
      }
    });
  }

  var displayNameEl = document.getElementById('tracking-stats-display-name');
  if (displayNameEl && typeof window.getCurrentUser === 'function') {
    var u = window.getCurrentUser();
    var heroName = u && (u.firstName || u.username);
    if (heroName) {
      displayNameEl.textContent = String(heroName).trim() || 'You';
    }
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function formatDurationParts(min, sec) {
    var m = Math.max(0, parseInt(min, 10) || 0);
    var s = Math.max(0, parseFloat(sec) || 0);
    if (s >= 60) {
      m += Math.floor(s / 60);
      s = s % 60;
    }
    var secStr = s % 1 === 0 ? pad(Math.round(s)) : String(Math.round(s * 100) / 100);
    if (m === 0) return secStr + 's';
    return m + ':' + (parseFloat(secStr) < 10 && parseFloat(secStr) % 1 === 0 ? '0' + secStr : secStr);
  }

  var expandBtn = document.getElementById('expand-btn');
  var moreRecords = document.getElementById('more-records');

  if (expandBtn && moreRecords) {
    expandBtn.addEventListener('click', function () {
      var isOpen = moreRecords.classList.contains('show');
      if (isOpen) {
        moreRecords.classList.remove('show');
        expandBtn.textContent = '...';
        expandBtn.setAttribute('aria-expanded', 'false');
      } else {
        moreRecords.classList.add('show');
        expandBtn.textContent = 'show less';
        expandBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  var tabLayout = document.getElementById('tracking-tab-layout');
  var trackingTabs = document.querySelectorAll('.tracking-mode-tab');

  function setActivePanel(panelKey) {
    if (!tabLayout) return;
    if (panelKey === 'prs' || panelKey === 'pr') panelKey = 'archive';
    tabLayout.setAttribute('data-active-panel', panelKey);
    var panelMap = {
      stats: document.getElementById('tracking-panel-stats'),
      archive: document.getElementById('tracking-panel-archive')
    };
    trackingTabs.forEach(function (btn) {
      var k = btn.getAttribute('data-tracking-panel');
      var on = k === panelKey;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Object.keys(panelMap).forEach(function (k) {
      var p = panelMap[k];
      if (!p) return;
      var active = k === panelKey;
      p.hidden = !active;
    });
    if (panelKey !== 'stats') {
      setGridEditMode(false);
    }
    if (panelKey === 'archive') {
      renderArchiveInline();
    }
    if (panelKey === 'stats' && typeof Chart !== 'undefined') {
      var cv = document.getElementById('statsChart');
      try {
        var ch = Chart.getChart && Chart.getChart(cv);
        if (ch) ch.resize();
      } catch (e) {}
      var ic = document.getElementById('trackingIntensityChart');
      try {
        var ich = Chart.getChart && Chart.getChart(ic);
        if (ich) ich.resize();
      } catch (e2) {}
    }
  }

  window.TrackingUI = { setActivePanel: setActivePanel };

  trackingTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.getAttribute('data-tracking-panel');
      if (!key) return;
      if (window.CreateUI && typeof window.CreateUI.setMode === 'function') {
        window.CreateUI.setMode('tracking', { trackingPanel: key });
      } else {
        setActivePanel(key);
      }
      var hashMap = { stats: '#stats', archive: '#archive' };
      if (hashMap[key] && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search + hashMap[key]);
      }
    });
  });

  var WL = window.WorkoutLog;
  var PR = window.PRLog;
  var statsChartInstance = null;
  var intensityChartInstance = null;
  var volumeChartInstance = null;
  var peakChartInstance = null;
  var e1rmChartInstance = null;
  var compareChartInstance = null;
  var selectedPeakExerciseKey = '';

  function getStatsRange() {
    var el = document.getElementById('tracking-tab-layout');
    var r = el && el.getAttribute('data-stats-range');
    return r === 'year' || r === 'all' ? r : 'month';
  }

  function parseYmd(ymd) {
    if (!ymd) return null;
    var head = String(ymd).split('T')[0];
    var p = head.split('-');
    if (p.length !== 3) return null;
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return new Date(y, m, d);
  }

  function rangeStartDate(range) {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    if (range === 'all') return null;
    var start = new Date(now);
    if (range === 'year') {
      start.setDate(start.getDate() - 364);
      return start;
    }
    start.setDate(start.getDate() - 29);
    return start;
  }

  function dateMatchesRange(ymd, range) {
    if (range === 'all') return true;
    var dt = parseYmd(ymd);
    if (!dt) return false;
    dt.setHours(0, 0, 0, 0);
    var start = rangeStartDate(range);
    var end = new Date();
    end.setHours(0, 0, 0, 0);
    return dt >= start && dt <= end;
  }

  function filterSessionsByRange(sessions, range) {
    if (range === 'all') return (sessions || []).slice();
    return (sessions || []).filter(function (s) {
      return s && dateMatchesRange(s.date, range);
    });
  }

  function countSetsInSessions(sessions) {
    var n = 0;
    (sessions || []).forEach(function (s) {
      (s.exercises || []).forEach(function (ex) {
        var sets = parseInt(ex.sets, 10);
        if (!isNaN(sets) && sets > 0) n += sets;
        else n += 1;
      });
    });
    return n;
  }

  function sumCardioMinutesInSessions(sessions) {
    var t = 0;
    (sessions || []).forEach(function (s) {
      if (s.cardio && s.cardio.minutes) {
        var cm = parseFloat(s.cardio.minutes);
        if (!isNaN(cm) && cm > 0) t += cm;
      }
    });
    return Math.round(t);
  }

  function avgIntensityForSessions(sessions) {
    var sum = 0;
    var c = 0;
    (sessions || []).forEach(function (s) {
      if (s.totalIntensity != null && !isNaN(s.totalIntensity)) {
        sum += s.totalIntensity;
        c += 1;
      }
    });
    if (!c) return null;
    return Math.round(sum / c);
  }

  function countPrsInRange(records, range) {
    if (!records || !records.length) return 0;
    if (range === 'all') return records.length;
    var n = 0;
    records.forEach(function (r) {
      if (r && dateMatchesRange(r.date, range)) n += 1;
    });
    return n;
  }

  function periodLabelForRange(range) {
    if (range === 'month') return '(Past 30 days)';
    if (range === 'year') return '(Past year)';
    return '(All time)';
  }

  function shortPeriodLabel(range) {
    if (range === 'year') return 'Past year';
    if (range === 'all') return 'All time';
    return 'Past month';
  }

  function syncStatsWhenLabels(range) {
    var label = shortPeriodLabel(range || getStatsRange());
    document.querySelectorAll('[data-stats-when]').forEach(function (el) {
      el.textContent = label;
    });
  }

  function formatCompactLoad(n) {
    if (n == null || isNaN(n)) return '—';
    var v = Number(n);
    if (v >= 10000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    if (v >= 1000) return Math.round(v).toLocaleString();
    return String(Math.round(v));
  }

  function lastSeriesValue(arr, allowZero) {
    if (!arr || !arr.length) return null;
    var i;
    for (i = arr.length - 1; i >= 0; i--) {
      var v = arr[i];
      if (v == null || isNaN(v)) continue;
      if (!allowZero && v === 0) continue;
      return v;
    }
    return null;
  }

  function sumSeries(arr) {
    var t = 0;
    var any = false;
    (arr || []).forEach(function (v) {
      if (v == null || isNaN(v)) return;
      any = true;
      t += Number(v);
    });
    return any ? t : null;
  }

  function maxSeries(arr) {
    var best = null;
    (arr || []).forEach(function (v) {
      if (v == null || isNaN(v)) return;
      if (best == null || v > best) best = v;
    });
    return best;
  }

  function setHealthValue(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function isDesktopStatsHub() {
    try {
      return window.matchMedia('(min-width: 901px)').matches;
    } catch (e) {
      return false;
    }
  }

  function setCardFacts(id, facts) {
    var el = document.getElementById(id);
    if (!el) return;
    var rows = (facts || []).filter(function (f) {
      return f && f.label && f.value != null && f.value !== '';
    });
    if (!rows.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = rows
      .map(function (f) {
        return (
          '<li class="tracking-health-card-fact"><span class="tracking-health-card-fact-label">' +
          String(f.label)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;') +
          '</span><strong>' +
          String(f.value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;') +
          '</strong></li>'
        );
      })
      .join('');
  }

  function seriesFirstLast(arr) {
    var first = null;
    var last = null;
    (arr || []).forEach(function (v) {
      if (v == null || isNaN(v) || v === 0) return;
      if (first == null) first = Number(v);
      last = Number(v);
    });
    return { first: first, last: last };
  }

  function formatDeltaLb(from, to) {
    if (from == null || to == null) return '—';
    var d = Math.round(to - from);
    if (d === 0) return '0 lb';
    return (d > 0 ? '+' : '') + d + ' lb';
  }

  function resizeStatsCharts() {
    [
      statsChartInstance,
      intensityChartInstance,
      volumeChartInstance,
      peakChartInstance,
      e1rmChartInstance,
      compareChartInstance,
    ].forEach(function (chart) {
      if (!chart) return;
      try {
        chart.resize();
      } catch (e) {}
    });
  }

  function updateRangeHint(range) {
    var el = document.getElementById('tracking-stats-range-hint');
    if (!el) return;
    var label = range === 'year' ? 'the past year' : range === 'all' ? 'all time' : 'the past 30 days';
    el.innerHTML = 'Showing <strong>' + label + '</strong> — tap a tile for details.';
    syncStatsWhenLabels(range);
  }

  function updateSummaryStrip() {
    /* legacy summary strip removed — strength overview handles this */
  }

  function chartTheme() {
    return window.StrengthStats && window.StrengthStats.themeAccent
      ? window.StrengthStats.themeAccent()
      : {
          accent: '#ff8c00',
          bright: '#ffa033',
          muted: '#aaa',
          page: '#141414',
          grid: 'rgba(255,255,255,0.08)',
          fade: 'rgba(255, 140, 0, 0.22)',
        };
  }

  function chartFillGradient(ctx, theme) {
    var grad = ctx.createLinearGradient(0, 0, 0, 220);
    grad.addColorStop(0, (theme && theme.fade) || 'rgba(127, 127, 127, 0.18)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    return grad;
  }

  function makeLineChart(canvas, datasetLabel) {
    if (!canvas || typeof Chart === 'undefined') return null;
    var theme = chartTheme();
    var ctx = canvas.getContext('2d');
    var grad = chartFillGradient(ctx, theme);
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: datasetLabel || '',
            data: [],
            borderColor: theme.accent,
            borderWidth: 2,
            pointBackgroundColor: theme.accent,
            pointBorderColor: theme.page || '#141414',
            pointBorderWidth: 0,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.35,
            spanGaps: true,
            fill: true,
            backgroundColor: grad,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true },
        },
      },
    });
  }

  function applySeriesToChart(chart, labels, data, range) {
    if (!chart) return;
    var theme = chartTheme();
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].borderColor = theme.accent;
    chart.data.datasets[0].pointBackgroundColor = theme.accent;
    chart.data.datasets[0].pointBorderColor = theme.page || '#141414';
    try {
      var ctx = chart.ctx || (chart.canvas && chart.canvas.getContext('2d'));
      if (ctx) chart.data.datasets[0].backgroundColor = chartFillGradient(ctx, theme);
    } catch (eGrad) {}
    var maxY = 0;
    (data || []).forEach(function (v) {
      if (v != null && v > maxY) maxY = v;
    });
    var suggested = Math.max(5, Math.ceil(maxY * 1.15));
    if (chart.options.scales && chart.options.scales.y) {
      chart.options.scales.y.max = suggested;
    }
    if (chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
      chart.options.scales.x.ticks.maxTicksLimit = range === 'month' ? 12 : range === 'year' ? 12 : 16;
      chart.options.scales.x.ticks.color = theme.muted;
    }
    if (chart.options.scales && chart.options.scales.y && chart.options.scales.y.ticks) {
      chart.options.scales.y.ticks.color = theme.muted;
    }
    chart.update();
  }

  function syncPeakExerciseSelect(sessions) {
    var sel = document.getElementById('tracking-peak-exercise');
    if (!sel || !window.StrengthStats) return null;
    var opts = window.StrengthStats.listExerciseOptions(sessions);
    var prev = selectedPeakExerciseKey || sel.value;
    sel.innerHTML = '';
    if (!opts.length) {
      var empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No lifts logged';
      sel.appendChild(empty);
      selectedPeakExerciseKey = '';
      return null;
    }
    opts.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.key;
      o.textContent = opt.name + ' (' + opt.count + ')';
      sel.appendChild(o);
    });
    var found = opts.some(function (o) {
      return o.key === prev;
    });
    selectedPeakExerciseKey = found ? prev : opts[0].key;
    sel.value = selectedPeakExerciseKey;
    return opts.find(function (o) {
      return o.key === selectedPeakExerciseKey;
    });
  }

  function updateStrengthOverview(sessions, labels, range) {
    if (!window.StrengthStats) return;
    var SS = window.StrengthStats;
    var vols = SS.buildVolumeSeries(sessions, labels, range);
    var peakOpt = syncPeakExerciseSelect(sessions);
    var peakKey = peakOpt ? peakOpt.key : '';
    var peaks = peakKey ? SS.buildPeakSeries(sessions, labels, range, peakKey) : [];
    var insight = SS.buildInsight(sessions, vols, peaks, peakOpt ? peakOpt.name : '');
    var verdictEl = document.getElementById('tracking-strength-verdict');
    if (verdictEl) verdictEl.textContent = insight.verdict;
    var metrics = (insight.metrics || []).slice();
    metrics.push({ label: 'Sets', value: String(countSetsInSessions(sessions)) });
    var avgI = avgIntensityForSessions(sessions);
    if (avgI != null) metrics.push({ label: 'Avg intensity', value: String(avgI) });
    var cardio = sumCardioMinutesInSessions(sessions);
    if (cardio > 0) metrics.push({ label: 'Cardio', value: cardio + ' min' });
    var prCount = countPrsInRange(PR && typeof PR.getRecords === 'function' ? PR.getRecords() : [], range);
    metrics.push({ label: 'PRs logged', value: String(prCount) });
    if (peaks.length && typeof SS.slope === 'function') {
      var ps = SS.slope(peaks);
      metrics.push({
        label: 'Peak trend',
        value: ps > 0.5 ? 'rising' : ps < -0.5 ? 'falling' : 'steady',
      });
    }
    if (vols.length && typeof SS.slope === 'function') {
      var vs = SS.slope(vols);
      var hasVolTrend = metrics.some(function (m) {
        return m.label === 'Volume trend';
      });
      if (!hasVolTrend) {
        metrics.push({
          label: 'Volume trend',
          value: vs > 5 ? 'rising' : vs < -5 ? 'falling' : 'steady',
        });
      }
    }
    var metricsEl = document.getElementById('tracking-strength-metrics');
    if (metricsEl) {
      metricsEl.innerHTML = metrics
        .map(function (m) {
          return (
            '<li class="tracking-strength-metric"><span class="tracking-strength-metric-label">' +
            String(m.label)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;') +
            '</span><strong>' +
            String(m.value)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;') +
            '</strong></li>'
          );
        })
        .join('');
    }
    var summary = document.getElementById('tracking-strength-summary');
    if (summary) {
      summary.setAttribute('data-tone', insight.tone || 'neutral');
    }
  }

  function updateVolumeChartFromSessions(sessions, range) {
    if (!window.StrengthStats) return;
    var r = range || getStatsRange();
    var total = 0;
    (sessions || []).forEach(function (s) {
      total += window.StrengthStats.sessionVolume(s) || 0;
    });
    var hist = buildChartData(sessions, r);
    var vols = window.StrengthStats.buildVolumeSeries(sessions, hist.labels, r);
    if (volumeChartInstance) {
      applySeriesToChart(volumeChartInstance, hist.labels, vols, r);
    }
    setHealthValue(
      'tracking-volume-chart-value',
      total > 0 ? formatCompactLoad(total) + ' lb' : '—'
    );
    var sub = document.getElementById('tracking-volume-chart-sub');
    if (sub) {
      sub.textContent = total > 0 ? 'Total weight × reps · ' + shortPeriodLabel(r) : 'Log weighted sets to track volume';
    }
    var n = (sessions || []).length;
    var avg = n && total > 0 ? total / n : null;
    var ends = seriesFirstLast(vols);
    setCardFacts('tracking-volume-chart-facts', [
      { label: 'Sessions', value: String(n) },
      { label: 'Sets', value: String(countSetsInSessions(sessions)) },
      { label: 'Avg / session', value: avg != null ? formatCompactLoad(avg) + ' lb' : '—' },
      { label: 'Trend Δ', value: formatDeltaLb(ends.first, ends.last) },
    ]);
  }

  function updatePeakChartFromSessions(sessions, range) {
    if (!window.StrengthStats) return;
    var r = range || getStatsRange();
    var opt = syncPeakExerciseSelect(sessions);
    var best = null;
    var peaks = [];
    var withLift = 0;
    if (opt) {
      (sessions || []).forEach(function (s) {
        var p = window.StrengthStats.sessionPeakForName
          ? window.StrengthStats.sessionPeakForName(s, opt.key)
          : null;
        if (p != null && p > 0) {
          withLift += 1;
          if (best == null || p > best) best = p;
        }
      });
      if (peakChartInstance) {
        var hist = buildChartData(sessions, r);
        peaks = window.StrengthStats.buildPeakSeries(sessions, hist.labels, r, opt.key);
        applySeriesToChart(peakChartInstance, hist.labels, peaks, r);
        if (best == null) best = maxSeries(peaks);
      }
    }
    setHealthValue(
      'tracking-peak-chart-value',
      best != null && best > 0 ? formatCompactLoad(best) + ' lb' : '—'
    );
    var sub = document.getElementById('tracking-peak-chart-sub');
    if (sub) sub.textContent = opt ? 'Best ' + opt.name + ' in view' : 'Pick a lift';
    var ends = seriesFirstLast(peaks);
    setCardFacts('tracking-peak-chart-facts', [
      { label: 'Lift', value: opt ? opt.name : '—' },
      { label: 'Sessions logged', value: String(withLift) },
      { label: 'Best set', value: best != null && best > 0 ? formatCompactLoad(best) + ' lb' : '—' },
      { label: 'Change in view', value: formatDeltaLb(ends.first, ends.last) },
    ]);
  }

  function updateE1rmChartFromSessions(sessions, range) {
    if (!window.StrengthStats) return;
    var r = range || getStatsRange();
    var opt = syncPeakExerciseSelect(sessions);
    var best = null;
    var series = [];
    if (opt && window.StrengthStats.sessionBestE1rmForName) {
      (sessions || []).forEach(function (s) {
        var e = window.StrengthStats.sessionBestE1rmForName(s, opt.key);
        if (e != null && e > 0 && (best == null || e > best)) best = Math.round(e);
      });
    }
    if (e1rmChartInstance && opt) {
      var hist = buildChartData(sessions, r);
      series = window.StrengthStats.buildE1rmSeries(sessions, hist.labels, r, opt.key);
      applySeriesToChart(e1rmChartInstance, hist.labels, series, r);
      if (best == null) best = maxSeries(series);
    }
    setHealthValue(
      'tracking-e1rm-chart-value',
      best != null ? formatCompactLoad(best) + ' lb' : '—'
    );
    var sub = document.getElementById('tracking-e1rm-chart-sub');
    if (sub) sub.textContent = opt ? opt.name + ' · Epley estimate' : 'Est. 1RM';
    var ends = seriesFirstLast(series);
    setCardFacts('tracking-e1rm-chart-facts', [
      { label: 'Lift', value: opt ? opt.name : '—' },
      { label: 'Best est.', value: best != null ? formatCompactLoad(best) + ' lb' : '—' },
      { label: 'Change in view', value: formatDeltaLb(ends.first, ends.last) },
      { label: 'Formula', value: 'w × (1 + r/30)' },
    ]);
  }

  function updateCompareChartFromSessions(sessions, range) {
    if (!window.StrengthStats) return;
    var pack = window.StrengthStats.compareLiftPeaks(sessions);
    if (compareChartInstance) {
      var theme = chartTheme();
      compareChartInstance.data.labels = pack.labels;
      compareChartInstance.data.datasets[0].data = pack.early;
      compareChartInstance.data.datasets[1].data = pack.late;
      compareChartInstance.data.datasets[0].backgroundColor = 'rgba(160,160,160,0.45)';
      compareChartInstance.data.datasets[1].backgroundColor = theme.accent;
      compareChartInstance.update();
    }
    var improved = 0;
    var compared = 0;
    var flat = 0;
    var regressed = 0;
    var factRows = [];
    (pack.labels || []).forEach(function (name, i) {
      var early = pack.early[i];
      var late = pack.late[i];
      if (early == null || late == null) return;
      compared += 1;
      if (late > early) improved += 1;
      else if (late < early) regressed += 1;
      else flat += 1;
      if (factRows.length < 4) {
        factRows.push({
          label: name,
          value: formatCompactLoad(early) + ' → ' + formatCompactLoad(late) + ' lb',
        });
      }
    });
    if (!compared) {
      setHealthValue('tracking-compare-chart-value', '—');
    } else if (improved === compared) {
      setHealthValue('tracking-compare-chart-value', 'All up');
    } else if (improved === 0) {
      setHealthValue('tracking-compare-chart-value', 'Holding');
    } else {
      setHealthValue('tracking-compare-chart-value', improved + ' of ' + compared + ' up');
    }
    var sub = document.getElementById('tracking-compare-chart-sub');
    if (sub) {
      sub.textContent = compared
        ? 'Early vs late peaks · ' + shortPeriodLabel(range || getStatsRange())
        : 'Need repeat lifts to compare';
    }
    if (!factRows.length) {
      factRows = [
        { label: 'Compared', value: '0 lifts' },
        { label: 'Tip', value: 'Log the same lifts twice' },
      ];
    } else {
      factRows.push({ label: 'Up / flat / down', value: improved + ' / ' + flat + ' / ' + regressed });
    }
    setCardFacts('tracking-compare-chart-facts', factRows);
  }

  function buildChartData(sessions, range) {
    if (range === 'all') {
      return buildYearHistogram(sessions);
    }
    if (range === 'year') {
      var y = new Date().getFullYear();
      var labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var counts = new Array(12).fill(0);
      (sessions || []).forEach(function (s) {
        if (!s || !s.date) return;
        var p = String(s.date).split('T')[0].split('-');
        if (p.length !== 3) return;
        var yi = parseInt(p[0], 10);
        var mi = parseInt(p[1], 10) - 1;
        if (yi === y && mi >= 0 && mi < 12) counts[mi] += 1;
      });
      return { labels: labels, counts: counts };
    }
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var lastDay = new Date(y, m + 1, 0).getDate();
    var labels = [];
    var counts = [];
    var day;
    for (day = 1; day <= lastDay; day++) {
      labels.push(String(day));
      counts.push(0);
    }
    (sessions || []).forEach(function (s) {
      if (!s || !s.date) return;
      var p = String(s.date).split('T')[0].split('-');
      if (p.length !== 3) return;
      var yi = parseInt(p[0], 10);
      var mi = parseInt(p[1], 10) - 1;
      var di = parseInt(p[2], 10);
      if (yi === y && mi === m && di >= 1 && di <= lastDay) counts[di - 1] += 1;
    });
    return { labels: labels, counts: counts };
  }

  function buildIntensityChartData(sessions, range) {
    var sessionHist = buildChartData(sessions, range);
    var labels = sessionHist.labels;
    var sums = new Array(labels.length).fill(0);
    var counts = new Array(labels.length).fill(0);
    (sessions || []).forEach(function (s) {
      if (!s || !s.date || s.totalIntensity == null) return;
      var ti = parseFloat(s.totalIntensity);
      if (isNaN(ti)) return;
      var p = String(s.date).split('T')[0].split('-');
      if (p.length !== 3) return;
      var yi = parseInt(p[0], 10);
      var mi = parseInt(p[1], 10) - 1;
      var di = parseInt(p[2], 10);
      var idx = -1;
      if (range === 'all') {
        idx = labels.indexOf(String(yi));
      } else if (range === 'year') {
        var now = new Date();
        if (yi === now.getFullYear() && mi >= 0 && mi < 12) idx = mi;
      } else {
        var now2 = new Date();
        if (yi === now2.getFullYear() && mi === now2.getMonth() && di >= 1 && di <= labels.length) {
          idx = di - 1;
        }
      }
      if (idx < 0 || idx >= labels.length) return;
      sums[idx] += ti;
      counts[idx] += 1;
    });
    var data = labels.map(function (_, i) {
      return counts[i] ? Math.round(sums[i] / counts[i]) : null;
    });
    return { labels: labels, data: data };
  }

  function getChartSubline(range) {
    if (range === 'month') return 'Past 30 days';
    if (range === 'year') return 'Past 365 days';
    return 'All time';
  }

  function updateChartMeta(hist, range) {
    var total = 0;
    if (hist && hist.counts) {
      hist.counts.forEach(function (n) {
        total += n;
      });
    }
    setHealthValue(
      'tracking-chart-card-value',
      total > 0 ? String(total) + (total === 1 ? ' workout' : ' workouts') : '—'
    );
    var subEl = document.getElementById('tracking-chart-card-sub');
    if (subEl) {
      subEl.textContent =
        total > 0 ? shortPeriodLabel(range) : 'No sessions in this view yet';
    }
  }

  function updateSessionCardFromSessions(sessions, range) {
    var r = range || getStatsRange();
    var total = (sessions || []).length;
    setHealthValue(
      'tracking-chart-card-value',
      total > 0 ? String(total) + (total === 1 ? ' workout' : ' workouts') : '—'
    );
    var subEl = document.getElementById('tracking-chart-card-sub');
    if (subEl) {
      subEl.textContent = total > 0 ? shortPeriodLabel(r) : 'No sessions in this view yet';
    }
    var hist = buildChartData(sessions, r);
    if (statsChartInstance) {
      statsChartInstance.data.labels = hist.labels;
      statsChartInstance.data.datasets[0].data = hist.counts;
      statsChartInstance.update();
      updateChartMeta(hist, r);
    }
    var daySet = {};
    (sessions || []).forEach(function (s) {
      if (s && s.date) daySet[String(s.date).slice(0, 10)] = true;
    });
    var days = Object.keys(daySet).length;
    var weeks = r === 'month' ? 4.3 : r === 'year' ? 52 : Math.max(1, days / 7);
    var perWeek = total > 0 ? (total / weeks).toFixed(1) : '—';
    var peakBucket = 0;
    (hist.counts || []).forEach(function (n) {
      if (n > peakBucket) peakBucket = n;
    });
    setCardFacts('tracking-chart-card-facts', [
      { label: 'Training days', value: String(days) },
      { label: 'Per week', value: perWeek === '—' ? '—' : perWeek + '×' },
      { label: 'Busiest bucket', value: peakBucket ? String(peakBucket) : '—' },
      { label: 'Sets logged', value: String(countSetsInSessions(sessions)) },
    ]);
  }

  function buildYearHistogram(sessions) {
    var byYear = {};
    (sessions || []).forEach(function (s) {
      if (!s || !s.date) return;
      var y = parseInt(String(s.date).slice(0, 4), 10);
      if (isNaN(y)) return;
      byYear[y] = (byYear[y] || 0) + 1;
    });
    var years = Object.keys(byYear)
      .map(function (x) {
        return parseInt(x, 10);
      })
      .sort(function (a, b) {
        return a - b;
      });
    if (years.length === 0) {
      var cy = new Date().getFullYear();
      return { labels: [String(cy)], counts: [0] };
    }
    return {
      labels: years.map(String),
      counts: years.map(function (y) {
        return byYear[y];
      })
    };
  }

  function updateTrainingChartFromSessions(sessions, range) {
    updateSessionCardFromSessions(sessions, range);
  }

  function updateIntensityChartFromSessions(sessions, range) {
    var r = range || getStatsRange();
    var avg = avgIntensityForSessions(sessions);
    setHealthValue(
      'tracking-intensity-chart-value',
      avg != null ? String(avg) : '—'
    );
    var sub = document.getElementById('tracking-intensity-chart-sub');
    if (sub) {
      sub.textContent =
        avg != null ? 'Avg felt effort · ' + shortPeriodLabel(r) : 'Rate sessions 0–100 when you log';
    }
    if (intensityChartInstance) {
      var pack = buildIntensityChartData(sessions, r);
      intensityChartInstance.data.labels = pack.labels;
      intensityChartInstance.data.datasets[0].data = pack.data;
      intensityChartInstance.update();
    }
    var rated = 0;
    var minI = null;
    var maxI = null;
    (sessions || []).forEach(function (s) {
      if (s.totalIntensity == null || isNaN(s.totalIntensity)) return;
      rated += 1;
      var v = Number(s.totalIntensity);
      if (minI == null || v < minI) minI = v;
      if (maxI == null || v > maxI) maxI = v;
    });
    setCardFacts('tracking-intensity-chart-facts', [
      { label: 'Rated sessions', value: String(rated) },
      { label: 'Low', value: minI != null ? String(Math.round(minI)) : '—' },
      { label: 'High', value: maxI != null ? String(Math.round(maxI)) : '—' },
      { label: 'Cardio minutes', value: String(sumCardioMinutesInSessions(sessions)) },
    ]);
  }

  function updateStatTilesFromSessions(sessions, records, range) {
    var r = range || getStatsRange();
    var setsEl = document.getElementById('tracking-stat-sets');
    if (setsEl) setsEl.textContent = String(countSetsInSessions(sessions));

    var monthNote = document.querySelector('.tracking-stats-month-note');
    if (monthNote) {
      monthNote.textContent = periodLabelForRange(r);
    }
  }

  var canvas = document.getElementById('statsChart');
  if (canvas && typeof Chart !== 'undefined') {
    try {
    var ctx = canvas.getContext('2d');
    var freqTheme = chartTheme();
    var fillGradient = chartFillGradient(ctx, freqTheme);

    var hist0 = buildChartData(filterSessionsByRange(WL ? WL.getSessions() : [], 'month'), 'month');
    var max0 = 0;
    hist0.counts.forEach(function (n) {
      if (n > max0) max0 = n;
    });
    var yMax = Math.max(5, Math.ceil(max0 * 1.15));

    statsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hist0.labels,
        datasets: [
          {
            data: hist0.counts,
            borderColor: freqTheme.accent,
            borderWidth: 2,
            pointBackgroundColor: freqTheme.accent,
            pointBorderColor: freqTheme.page || '#141414',
            pointBorderWidth: 0,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.35,
            fill: true,
            backgroundColor: fillGradient
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: yMax }
        }
      }
    });
    updateChartMeta(hist0, 'month');
    } catch (eFreq) {
      statsChartInstance = null;
    }
  }

  var intensityCanvas = document.getElementById('trackingIntensityChart');
  if (intensityCanvas && typeof Chart !== 'undefined') {
    try {
    var iPack = buildIntensityChartData(filterSessionsByRange(WL ? WL.getSessions() : [], 'month'), 'month');
    var iCtx = intensityCanvas.getContext('2d');
    var iTheme = chartTheme();
    var iGrad = chartFillGradient(iCtx, iTheme);
    var iMax = 5;
    iPack.data.forEach(function (v) {
      if (v != null && v > iMax) iMax = v;
    });
    if (iPack.data.some(function (x) {
      return x != null;
    })) {
      iMax = Math.min(100, Math.max(5, Math.ceil(iMax * 1.1)));
    }
    intensityChartInstance = new Chart(iCtx, {
      type: 'line',
      data: {
        labels: iPack.labels,
        datasets: [
          {
            data: iPack.data,
            borderColor: iTheme.bright || iTheme.accent,
            borderWidth: 2,
            pointBackgroundColor: iTheme.accent,
            pointBorderColor: iTheme.page || '#141414',
            pointBorderWidth: 0,
            pointRadius: 0,
            pointHoverRadius: 3,
            tension: 0.35,
            spanGaps: true,
            fill: true,
            backgroundColor: iGrad
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: iMax }
        }
      }
    });
    } catch (eIntensity) {
      intensityChartInstance = null;
    }
  }
  var GRID_ORDER_KEY = 'tracking_grid_card_order_v1';
  var DEFAULT_CARD_ORDER = [
    'volume-chart',
    'peak-chart',
    'e1rm-chart',
    'compare-chart',
    'chart',
    'intensity-chart',
  ];
  var DEPRECATED_GRID_CARD_IDS = ['calories', 'hours', 'wins', 'calendar', 'sets', 'pr'];

  try {
    volumeChartInstance = makeLineChart(document.getElementById('trackingVolumeChart'), 'Volume');
    peakChartInstance = makeLineChart(document.getElementById('trackingPeakChart'), 'Peak');
    e1rmChartInstance = makeLineChart(document.getElementById('trackingE1rmChart'), 'Est 1RM');
  } catch (eChartInit) {
    volumeChartInstance = volumeChartInstance || null;
    peakChartInstance = peakChartInstance || null;
    e1rmChartInstance = e1rmChartInstance || null;
  }

  var compareCanvas = document.getElementById('trackingCompareChart');
  if (compareCanvas && typeof Chart !== 'undefined') {
    try {
      var cTheme = chartTheme();
      compareChartInstance = new Chart(compareCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            { label: 'Earlier', data: [], backgroundColor: 'rgba(160,160,160,0.45)' },
            { label: 'Later', data: [], backgroundColor: cTheme.accent },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true },
          },
        },
      });
    } catch (eCompare) {
      compareChartInstance = null;
    }
  }

  var peakSelect = document.getElementById('tracking-peak-exercise');
  if (peakSelect) {
    peakSelect.addEventListener('change', function () {
      selectedPeakExerciseKey = peakSelect.value || '';
      refreshTrackingUi();
    });
  }

  var strengthSummary = document.getElementById('tracking-strength-summary');
  if (strengthSummary) {
    try {
      var pref = localStorage.getItem('tracking-strength-summary-open');
      if (pref === '0') strengthSummary.open = false;
      else if (pref === '1') strengthSummary.open = true;
    } catch (eSum) {}
    strengthSummary.addEventListener('toggle', function () {
      try {
        localStorage.setItem('tracking-strength-summary-open', strengthSummary.open ? '1' : '0');
      } catch (eT) {}
    });
  }

  var archiveViewRoot = document.getElementById('tracking-archive-view-root');
  var archiveScroll = document.getElementById('tracking-archive-scroll');
  var archiveInlineEmpty = document.getElementById('tracking-archive-inline-empty');
  var archiveSearchEmpty = document.getElementById('tracking-archive-search-empty');
  var archiveSearchInput = document.getElementById('tracking-archive-search');
  var archiveCountEl = document.getElementById('tracking-archive-count');
  var archiveStatShown = document.getElementById('tracking-archive-stat-shown');
  var archiveStatLifts = document.getElementById('tracking-archive-stat-lifts');
  var archiveStatIntensity = document.getElementById('tracking-archive-stat-intensity');
  var archiveStatTotal = document.getElementById('tracking-archive-stat-total');
  var archiveViewBtns = document.querySelectorAll('[data-archive-view]');
  var ARCHIVE_VIEW_KEY = 'strongman-archive-view-v1';
  var archiveSearchQuery = '';
  var archiveTypeFilter = 'all';
  var prArchiveList = document.getElementById('tracking-pr-archive-list');
  var archiveFilterRoot = document.getElementById('log-timeline-filters');
  var prArchiveEmpty = document.getElementById('tracking-pr-archive-empty');

  var detailBackdrop = document.getElementById('tracking-detail-backdrop');
  var detailDialog = document.getElementById('tracking-detail-dialog');
  var detailTitleEl = document.getElementById('tracking-detail-title');
  var detailBodyEl = document.getElementById('tracking-detail-body');
  var detailCloseBtn = document.getElementById('tracking-detail-close');

  var prListMain = document.getElementById('tracking-pr-list-main');
  var prListMore = document.getElementById('tracking-pr-list-more');
  var prCardEmpty = document.getElementById('tracking-pr-card-empty');
  var prCardEl = document.querySelector('.card[data-grid-card-id="pr"]');

  function defaultDatetimeLocal() {
    var d = new Date();
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      'T' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  function renderPrCard() {
    if (!PR || !prListMain || !prListMore) return;
    var range = getStatsRange();
    var all = PR.getRecords();
    var records =
      range === 'all'
        ? all
        : all.filter(function (r) {
            return r && dateMatchesRange(r.date, range);
          });
    prListMain.innerHTML = '';
    prListMore.innerHTML = '';
    if (prCardEmpty) prCardEmpty.hidden = records.length > 0;
    if (prCardEl) prCardEl.classList.toggle('tracking-pr-card--has', records.length > 0);

    function rowLi(rec) {
      var li = document.createElement('li');
      var lab = document.createElement('span');
      lab.className = 'pr-line-label';
      lab.textContent = PR.disciplineLabel(rec.discipline) + ' · ' + (rec.eventLabel || 'PR') + ':';
      var br = document.createElement('span');
      br.className = 'pr-brackets';
      br.textContent = '[';
      var val = document.createElement('span');
      val.className = 'pr-line-val';
      val.textContent = rec.valueDisplay || '—';
      br.appendChild(val);
      br.appendChild(document.createTextNode(']'));
      li.appendChild(lab);
      li.appendChild(document.createTextNode(' '));
      li.appendChild(br);
      return li;
    }

    records.slice(0, 4).forEach(function (rec) {
      prListMain.appendChild(rowLi(rec));
    });
    records.slice(4).forEach(function (rec) {
      prListMore.appendChild(rowLi(rec));
    });

    var hasMore = records.length > 4;
    if (expandBtn) expandBtn.hidden = !hasMore;
    if (moreRecords && !hasMore) {
      moreRecords.classList.remove('show');
      expandBtn.textContent = '...';
      expandBtn.setAttribute('aria-expanded', 'false');
    }
  }

  var TL_PR_IDS = {
    datetime: 'tl-pr-datetime',
    disciplineName: 'tl-pr-discipline',
    notes: 'tl-pr-notes',
    runEvent: 'tl-pr-run-event',
    runMin: 'tl-pr-run-min',
    runSec: 'tl-pr-run-sec',
    swimEvent: 'tl-pr-swim-event',
    swimCourse: 'tl-pr-swim-course',
    swimMin: 'tl-pr-swim-min',
    swimSec: 'tl-pr-swim-sec',
    wlLift: 'tl-pr-wl-lift',
    wlWeight: 'tl-pr-wl-weight',
    wlUnit: 'tl-pr-wl-unit',
    wlReps: 'tl-pr-wl-reps',
  };

  function buildPrRecordFrom(ids) {
    function val(id) {
      var el = document.getElementById(id);
      return el ? el.value : '';
    }
    var dt = val(ids.datetime);
    if (!dt) return { error: 'Pick a date and time.' };
    var parts = dt.split('T');
    var checked = document.querySelector('input[name="' + ids.disciplineName + '"]:checked');
    var discipline = checked ? checked.value : 'running';

    var eventLabel = '';
    var valueDisplay = '';
    var weight;
    var unit;
    var reps;

    if (discipline === 'running') {
      eventLabel = (val(ids.runEvent) || '').trim();
      if (!eventLabel) return { error: 'Enter an event or distance for running.' };
      valueDisplay = formatDurationParts(val(ids.runMin), val(ids.runSec));
      if (!valueDisplay || valueDisplay === '0s') return { error: 'Enter a time greater than zero.' };
    } else if (discipline === 'swimming') {
      var swimEv = (val(ids.swimEvent) || '').trim();
      if (!swimEv) return { error: 'Enter a swimming event.' };
      valueDisplay = formatDurationParts(val(ids.swimMin), val(ids.swimSec));
      if (!valueDisplay || valueDisplay === '0s') return { error: 'Enter a time greater than zero.' };
      var course = val(ids.swimCourse);
      eventLabel = swimEv + (course ? ' (' + course + ')' : '');
    } else {
      var lift = (val(ids.wlLift) || '').trim();
      weight = parseFloat(val(ids.wlWeight));
      unit = val(ids.wlUnit) || 'lb';
      reps = parseInt(val(ids.wlReps), 10);
      if (!lift) return { error: 'Enter the lift name.' };
      if (isNaN(weight) || weight <= 0) return { error: 'Enter a valid weight.' };
      eventLabel = lift;
      valueDisplay = weight + ' ' + unit;
      if (!isNaN(reps) && reps > 1) valueDisplay += ' × ' + reps;
    }

    var record = {
      discipline: discipline,
      sport: discipline,
      eventLabel: eventLabel,
      valueDisplay: valueDisplay,
      notes: (val(ids.notes) || '').trim(),
      date: parts[0] || '',
      time: parts[1] || '',
      history: []
    };

    if (discipline === 'weightlifting') {
      record.weight = weight;
      record.unit = unit;
      record.reps = !isNaN(reps) && reps > 0 ? reps : 1;
    } else if (discipline === 'running') {
      var runParts =
        window.TimedEventFields && window.TimedEventFields.parseRunningEvent
          ? window.TimedEventFields.parseRunningEvent(eventLabel)
          : { distance: eventLabel, event: eventLabel };
      record.distance = runParts.distance;
      record.event = runParts.event;
    } else {
      var swimParts =
        window.TimedEventFields && window.TimedEventFields.parseSwimmingEvent
          ? window.TimedEventFields.parseSwimmingEvent((val(ids.swimEvent) || '').trim())
          : { distance: '', event: '' };
      record.distance = swimParts.distance;
      record.event = swimParts.event;
      var courseVal = val(ids.swimCourse);
      if (courseVal) record.course = courseVal;
    }

    if (
      window.TimedEventFields &&
      typeof window.TimedEventFields.parseTimeDisplaySeconds === 'function'
    ) {
      var valueSeconds = window.TimedEventFields.parseTimeDisplaySeconds(valueDisplay);
      if (valueSeconds != null) record.valueSeconds = valueSeconds;
    }

    return { record: record };
  }

  var lastSharePr = null;

  function afterPrSaved(record) {
    renderPrCard();
    renderPrArchiveList();
    refreshTrackingUi();
    lastSharePr = JSON.parse(JSON.stringify(record));
    openPrShareModal();
  }

  /* —— Timeline "New entry" chooser + PR / life-event dialogs —— */
  var tlPrDialog = document.getElementById('tl-pr-dialog');
  var tlPrBackdrop = document.getElementById('tl-pr-backdrop');
  var tlPrForm = document.getElementById('tl-pr-form');
  var tlPrError = document.getElementById('tl-pr-error');
  var tlNewOpenBtn = document.getElementById('log-timeline-new-entry');
  var tlNewDialog = document.getElementById('tl-new-dialog');
  var tlNewBackdrop = document.getElementById('tl-new-backdrop');
  var tlEventDialog = document.getElementById('tl-event-dialog');
  var tlEventBackdrop = document.getElementById('tl-event-backdrop');
  var tlEventEditorRoot = document.getElementById('log-timeline-editor-root');
  var tlEventEditorApi = null;

  function closeTlNewDialog() {
    if (tlNewBackdrop) {
      tlNewBackdrop.classList.remove('is-open');
      tlNewBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (tlNewDialog) {
      tlNewDialog.hidden = true;
      tlNewDialog.classList.remove('is-open');
      tlNewDialog.setAttribute('aria-hidden', 'true');
    }
    if (!isAnyTimelineDialogOpen()) document.body.style.overflow = '';
  }

  function openTlNewDialog() {
    if (!tlNewDialog) return;
    if (tlNewBackdrop) {
      tlNewBackdrop.classList.add('is-open');
      tlNewBackdrop.setAttribute('aria-hidden', 'false');
    }
    tlNewDialog.hidden = false;
    tlNewDialog.classList.add('is-open');
    tlNewDialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var firstChoice = tlNewDialog.querySelector('.log-tl-new-choice');
    if (firstChoice) firstChoice.focus();
  }

  function closeTlEventDialog() {
    if (tlEventBackdrop) {
      tlEventBackdrop.classList.remove('is-open');
      tlEventBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (tlEventDialog) {
      tlEventDialog.hidden = true;
      tlEventDialog.classList.remove('is-open');
      tlEventDialog.setAttribute('aria-hidden', 'true');
    }
    if (tlEventEditorApi) tlEventEditorApi.close();
    if (!isAnyTimelineDialogOpen()) document.body.style.overflow = '';
  }

  function openTlEventDialog(existing) {
    if (!tlEventDialog || !window.TrainingTimeline) return;
    if (!tlEventEditorApi && tlEventEditorRoot) {
      tlEventEditorApi = window.TrainingTimeline.mountStandaloneEditor(tlEventEditorRoot, {
        onSaved: function () {
          closeTlEventDialog();
          renderArchiveInline();
        },
        onCancel: closeTlEventDialog,
      });
    }
    var heading = document.getElementById('tl-event-heading');
    if (heading) heading.textContent = existing ? 'Edit timeline entry' : 'Add to timeline';
    if (tlEventBackdrop) {
      tlEventBackdrop.classList.add('is-open');
      tlEventBackdrop.setAttribute('aria-hidden', 'false');
    }
    tlEventDialog.hidden = false;
    tlEventDialog.classList.add('is-open');
    tlEventDialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (tlEventEditorApi) tlEventEditorApi.open(existing || null);
    var titleField = tlEventEditorRoot && tlEventEditorRoot.querySelector('[name="tl-title"]');
    if (titleField) titleField.focus();
  }

  function isAnyTimelineDialogOpen() {
    return (
      (tlPrDialog && !tlPrDialog.hidden) ||
      (tlNewDialog && !tlNewDialog.hidden) ||
      (tlEventDialog && !tlEventDialog.hidden)
    );
  }

  function setTlPrError(msg) {
    if (!tlPrError) return;
    tlPrError.textContent = msg || '';
    tlPrError.hidden = !msg;
  }

  function syncTlPrPanels() {
    var checked = document.querySelector('input[name="tl-pr-discipline"]:checked');
    var v = checked ? checked.value : 'running';
    ['running', 'swimming', 'weightlifting'].forEach(function (key) {
      var panel = document.getElementById('tl-pr-panel-' + key);
      if (panel) panel.hidden = key !== v;
    });
  }

  function closeTlPrDialog() {
    if (tlPrBackdrop) {
      tlPrBackdrop.classList.remove('is-open');
      tlPrBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (tlPrDialog) {
      tlPrDialog.hidden = true;
      tlPrDialog.classList.remove('is-open');
      tlPrDialog.setAttribute('aria-hidden', 'true');
    }
    if (!isAnyTimelineDialogOpen()) document.body.style.overflow = '';
  }

  function openTlPrDialog() {
    if (!tlPrDialog) return;
    setTlPrError('');
    if (tlPrForm) tlPrForm.reset();
    var runningRadio = document.getElementById('tl-pr-disc-running');
    if (runningRadio) runningRadio.checked = true;
    syncTlPrPanels();
    var dt = document.getElementById('tl-pr-datetime');
    if (dt) dt.value = defaultDatetimeLocal();
    if (tlPrBackdrop) {
      tlPrBackdrop.classList.add('is-open');
      tlPrBackdrop.setAttribute('aria-hidden', 'false');
    }
    tlPrDialog.hidden = false;
    tlPrDialog.classList.add('is-open');
    tlPrDialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var firstField = document.getElementById('tl-pr-run-event');
    if (firstField) firstField.focus();
  }

  document.querySelectorAll('input[name="tl-pr-discipline"]').forEach(function (r) {
    r.addEventListener('change', syncTlPrPanels);
  });

  if (tlNewOpenBtn) tlNewOpenBtn.addEventListener('click', openTlNewDialog);
  var tlNewCloseBtn = document.getElementById('tl-new-close');
  if (tlNewCloseBtn) tlNewCloseBtn.addEventListener('click', closeTlNewDialog);
  if (tlNewBackdrop) tlNewBackdrop.addEventListener('click', closeTlNewDialog);
  if (tlNewDialog) {
    tlNewDialog.querySelectorAll('[data-new-entry]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.getAttribute('data-new-entry');
        closeTlNewDialog();
        if (kind === 'pr') openTlPrDialog();
        else if (kind === 'event') openTlEventDialog(null);
      });
    });
  }
  var tlEventCloseBtn = document.getElementById('tl-event-close');
  if (tlEventCloseBtn) tlEventCloseBtn.addEventListener('click', closeTlEventDialog);
  if (tlEventBackdrop) tlEventBackdrop.addEventListener('click', closeTlEventDialog);
  var tlPrCloseBtn = document.getElementById('tl-pr-close');
  if (tlPrCloseBtn) tlPrCloseBtn.addEventListener('click', closeTlPrDialog);
  if (tlPrBackdrop) tlPrBackdrop.addEventListener('click', closeTlPrDialog);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (tlEventDialog && !tlEventDialog.hidden) closeTlEventDialog();
    else if (tlNewDialog && !tlNewDialog.hidden) closeTlNewDialog();
    else if (tlPrDialog && !tlPrDialog.hidden) closeTlPrDialog();
  });

  if (tlPrForm && PR) {
    tlPrForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setTlPrError('');
      var out = buildPrRecordFrom(TL_PR_IDS);
      if (out.error) {
        setTlPrError(out.error);
        return;
      }
      PR.addRecord(out.record);
      closeTlPrDialog();
      afterPrSaved(out.record);
    });
  }

  var prShareBackdrop = document.getElementById('tracking-pr-share-backdrop');
  var prShareModal = document.getElementById('tracking-pr-share-modal');
  var prShareClose = document.getElementById('tracking-pr-share-modal-close');
  var prShareSkip = document.getElementById('tracking-pr-share-skip');
  var prShareImage = document.getElementById('tracking-pr-share-image');
  var prShareDownload = document.getElementById('tracking-pr-share-download');
  var prSharePreview = document.getElementById('tracking-pr-share-preview');
  var prShareStatus = document.getElementById('tracking-pr-share-status');
  var prIncEvent = document.getElementById('tracking-pr-share-inc-event');
  var prIncValue = document.getElementById('tracking-pr-share-inc-value');
  var prIncDisc = document.getElementById('tracking-pr-share-inc-discipline');
  var prIncNotes = document.getElementById('tracking-pr-share-inc-notes');

  var shareObjectUrl = null;
  var shareLoadedImg = null;
  var sharePreviewTimer = null;

  function setPrShareStatus(t) {
    if (prShareStatus) prShareStatus.textContent = t || '';
  }

  function clearPrShareGraphicState() {
    if (shareObjectUrl) {
      try {
        URL.revokeObjectURL(shareObjectUrl);
      } catch (e) {}
      shareObjectUrl = null;
    }
    shareLoadedImg = null;
    if (prSharePreview) {
      prSharePreview.innerHTML =
        '<span class="create-share-preview-placeholder">Choose a photo</span>';
    }
    if (prShareDownload) prShareDownload.disabled = true;
    if (prShareImage) prShareImage.value = '';
    setPrShareStatus('');
  }

  function closePrShareModal() {
    if (prShareBackdrop) {
      prShareBackdrop.classList.remove('is-open');
      prShareBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (prShareModal) {
      prShareModal.classList.remove('is-open');
      prShareModal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    clearPrShareGraphicState();
    lastSharePr = null;
  }

  function openPrShareModal() {
    if (!lastSharePr || !prShareModal) return;
    clearPrShareGraphicState();
    if (prShareBackdrop) {
      prShareBackdrop.classList.add('is-open');
      prShareBackdrop.setAttribute('aria-hidden', 'false');
    }
    prShareModal.classList.add('is-open');
    prShareModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (prIncEvent) prIncEvent.checked = true;
    if (prIncValue) prIncValue.checked = true;
    if (prIncDisc) prIncDisc.checked = true;
    if (prIncNotes) prIncNotes.checked = false;
    schedulePrStoryPreview();
    if (prShareClose) prShareClose.focus();
  }

  function formatDisplayDate(ymd) {
    if (!ymd) return '';
    var p = ymd.split('-');
    if (p.length !== 3) return ymd;
    var y = parseInt(p[0], 10);
    var mo = parseInt(p[1], 10);
    var d = parseInt(p[2], 10);
    return mo + '/' + d + '/' + String(y).slice(-2);
  }

  function formatDisplayTime(hm) {
    if (!hm) return '';
    var p = hm.split(':');
    var h = parseInt(p[0], 10);
    var mi = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(mi)) return hm;
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + pad(mi) + ' ' + ampm;
  }

  function drawImageCover(ctx, img, cw, ch) {
    var ir = img.width / img.height;
    var cr = cw / ch;
    var dw;
    var dh;
    var ox;
    var oy;
    if (ir > cr) {
      dh = ch;
      dw = img.width * (ch / img.height);
      ox = (cw - dw) / 2;
      oy = 0;
    } else {
      dw = cw;
      dh = img.height * (cw / img.width);
      ox = 0;
      oy = (ch - dh) / 2;
    }
    ctx.drawImage(img, ox, oy, dw, dh);
  }

  function wrapLines(ctx, text, maxWidth) {
    if (!text) return [];
    var words = text.split(/\s+/);
    var lines = [];
    var line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function getPrShareOpts() {
    return {
      incEvent: prIncEvent && prIncEvent.checked,
      incValue: prIncValue && prIncValue.checked,
      incDiscipline: prIncDisc && prIncDisc.checked,
      incNotes: prIncNotes && prIncNotes.checked
    };
  }

  function drawPrStoryGraphic(ctx, cw, ch, pr, opts) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, cw, ch);
    if (shareLoadedImg) {
      drawImageCover(ctx, shareLoadedImg, cw, ch);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, cw, ch);

    var margin = 52;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '500 34px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(formatDisplayDate(pr.date), margin, 56);
    ctx.font = '500 30px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(formatDisplayTime(pr.time), margin, 96);

    var maxW = cw - 2 * margin;
    var gap = 12;
    var items = [];
    items.push({ kind: 'brand', text: 'STRONGMAN AI' });
    if (opts.incDiscipline && PR) {
      items.push({ kind: 'meta', text: PR.disciplineLabel(pr.discipline) });
    }
    if (opts.incEvent && pr.eventLabel) {
      items.push({ kind: 'title', text: pr.eventLabel });
    }
    if (opts.incValue && pr.valueDisplay) {
      items.push({ kind: 'bigval', text: pr.valueDisplay });
    }
    if (opts.incNotes && pr.notes && pr.notes.trim()) {
      items.push({ kind: 'notes', text: pr.notes.trim() });
    }

    function estimateH(list) {
      var h = 0;
      var g = 12;
      list.forEach(function (it) {
        if (it.kind === 'brand') h += 40 + g;
        else if (it.kind === 'title') {
          ctx.font = 'bold 44px "DM Sans", system-ui, sans-serif';
          h += wrapLines(ctx, it.text, maxW).length * 48 + g;
        } else if (it.kind === 'bigval') {
          ctx.font = 'bold 56px "DM Sans", system-ui, sans-serif';
          h += wrapLines(ctx, it.text, maxW).length * 62 + g;
        } else if (it.kind === 'notes') {
          ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
          h += wrapLines(ctx, it.text, maxW).length * 26 + g;
        } else if (it.kind === 'meta') h += 30 + g;
      });
      return h;
    }

    var blockH = estimateH(items);
    var blockTop = Math.max(130, ch - margin - blockH);
    var y = blockTop;
    ctx.textBaseline = 'top';
    items.forEach(function (item) {
      if (item.kind === 'brand') {
        ctx.font = 'bold 32px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = chartTheme().accent;
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 10;
        ctx.fillText(item.text, margin, y);
        ctx.shadowBlur = 0;
        y += 40 + gap;
      } else if (item.kind === 'meta') {
        ctx.font = '500 24px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillText(item.text, margin, y);
        y += 30 + gap;
      } else if (item.kind === 'title') {
        ctx.font = 'bold 44px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 8;
        wrapLines(ctx, item.text, maxW).forEach(function (ln, idx) {
          ctx.fillText(ln, margin, y);
          y += idx === 0 ? 52 : 48;
        });
        ctx.shadowBlur = 0;
        y += gap;
      } else if (item.kind === 'bigval') {
        ctx.font = 'bold 56px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = chartTheme().accent;
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 8;
        wrapLines(ctx, item.text, maxW).forEach(function (ln) {
          ctx.fillText(ln, margin, y);
          y += 62;
        });
        ctx.shadowBlur = 0;
        y += gap;
      } else if (item.kind === 'notes') {
        ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        wrapLines(ctx, item.text, maxW).forEach(function (ln) {
          ctx.fillText(ln, margin, y);
          y += 26;
        });
        y += gap;
      }
    });
  }

  function renderPrStoryToCanvas(cb) {
    if (!lastSharePr) {
      cb(new Error('No PR'));
      return;
    }
    var canvas = document.createElement('canvas');
    canvas.width = STORY_W;
    canvas.height = STORY_H;
    var ctx = canvas.getContext('2d');
    try {
      drawPrStoryGraphic(ctx, STORY_W, STORY_H, lastSharePr, getPrShareOpts());
      canvas.toBlob(
        function (blob) {
          if (blob) cb(null, blob, canvas);
          else cb(new Error('Blob failed'));
        },
        'image/png',
        0.95
      );
    } catch (err) {
      cb(err);
    }
  }

  function schedulePrStoryPreview() {
    if (sharePreviewTimer) clearTimeout(sharePreviewTimer);
    sharePreviewTimer = setTimeout(function () {
      sharePreviewTimer = null;
      if (!shareLoadedImg || !lastSharePr || !prSharePreview) return;
      renderPrStoryToCanvas(function (err, blob, cvs) {
        if (err || !cvs) return;
        prSharePreview.innerHTML = '';
        var cssW = prSharePreview.clientWidth || 320;
        cvs.style.width = cssW + 'px';
        cvs.style.height = Math.round((cssW * STORY_H) / STORY_W) + 'px';
        prSharePreview.appendChild(cvs);
      });
    }, 120);
  }

  function refreshPrShareDownload() {
    if (prShareDownload) prShareDownload.disabled = !shareLoadedImg || !lastSharePr;
  }

  if (prIncNotes)
    prIncNotes.addEventListener('change', schedulePrStoryPreview);
  ;[prIncEvent, prIncValue, prIncDisc].forEach(function (el) {
    if (el) el.addEventListener('change', schedulePrStoryPreview);
  });

  if (prShareImage && prSharePreview) {
    prShareImage.addEventListener('change', function () {
      if (shareObjectUrl) {
        try {
          URL.revokeObjectURL(shareObjectUrl);
        } catch (e) {}
        shareObjectUrl = null;
      }
      shareLoadedImg = null;
      var f = prShareImage.files && prShareImage.files[0];
      if (!f) {
        prSharePreview.innerHTML =
          '<span class="create-share-preview-placeholder">Choose a photo</span>';
        refreshPrShareDownload();
        setPrShareStatus('');
        return;
      }
      shareObjectUrl = URL.createObjectURL(f);
      var img = new Image();
      img.onload = function () {
        shareLoadedImg = img;
        refreshPrShareDownload();
        setPrShareStatus('Adjust options, then download.');
        schedulePrStoryPreview();
      };
      img.onerror = function () {
        shareLoadedImg = null;
        prSharePreview.innerHTML =
          '<span class="create-share-preview-placeholder">Could not load image</span>';
        refreshPrShareDownload();
        setPrShareStatus('Could not read that file.');
      };
      img.src = shareObjectUrl;
      img.alt = 'Share preview';
    });
  }

  if (prShareDownload) {
    prShareDownload.addEventListener('click', function () {
      if (!shareLoadedImg || !lastSharePr) return;
      setPrShareStatus('Generating PNG…');
      renderPrStoryToCanvas(function (err, blob) {
        if (err || !blob) {
          setPrShareStatus('Could not create PNG.');
          return;
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'strongman-pr-' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 2500);
        setPrShareStatus('Download started (1080×1920).');
      });
    });
  }

  function bindPrShareClose(el) {
    if (!el) return;
    el.addEventListener('click', closePrShareModal);
  }
  bindPrShareClose(prShareClose);
  bindPrShareClose(prShareSkip);
  if (prShareBackdrop) {
    prShareBackdrop.addEventListener('click', closePrShareModal);
  }

  var lastShareWorkout = null;
  var woShareBackdrop = document.getElementById('tracking-workout-share-backdrop');
  var woShareModal = document.getElementById('tracking-workout-share-modal');
  var woShareClose = document.getElementById('tracking-workout-share-modal-close');
  var woShareSkip = document.getElementById('tracking-workout-share-skip');
  var woShareInstagram = document.getElementById('tracking-workout-share-instagram');
  var woShareIgConnect = document.getElementById('tracking-workout-share-ig-connect');
  var woSharePreview = document.getElementById('tracking-workout-share-preview');
  var woShareStatus = document.getElementById('tracking-workout-share-status');
  var woIncTitle = document.getElementById('tracking-workout-share-inc-title');
  var woIncDatetime = document.getElementById('tracking-workout-share-inc-datetime');
  var woIncExercises = document.getElementById('tracking-workout-share-inc-exercises');
  var woIncCardio = document.getElementById('tracking-workout-share-inc-cardio');
  var woIncIntensity = document.getElementById('tracking-workout-share-inc-intensity');
  var woIncNotes = document.getElementById('tracking-workout-share-inc-notes');
  var woSharePreviewTimer = null;
  var detailSessionRef = null;

  function trackingCardioTypeLabel(type) {
    var cardioTypeLabels = {
      running: 'Running',
      walking: 'Walking',
      cycling: 'Cycling',
      swimming: 'Swimming',
      rowing: 'Rowing',
      elliptical: 'Elliptical',
      'stair-climber': 'Stair climber',
      hiking: 'Hiking',
      rucking: 'Rucking',
      'ski-erg': 'SkiErg',
      'other-cardio': 'Other cardio',
      sports: 'Sports'
    };
    return cardioTypeLabels[type] || '';
  }

  function formatExerciseBulletWo(ex) {
    var sets = ex.sets || '0';
    var reps = ex.reps || '0';
    var name = ex.name || 'Exercise';
    var line = '- ' + sets + '×' + reps + ' ' + name;
    if (ex.superset) {
      line +=
        ' + ' +
        (ex.superset.sets || '0') +
        '×' +
        (ex.superset.reps || '0') +
        ' ' +
        (ex.superset.name || 'superset');
    }
    if (ex.dropSets && ex.dropSets.length) {
      line +=
        ' · drops ' +
        ex.dropSets
          .map(function (drop) {
            var repsText = drop.reps || '0';
            var weightText = drop.weight ? drop.weight + ' lb' : 'bodyweight';
            return repsText + ' @ ' + weightText;
          })
          .join(', ');
    }
    return line;
  }

  function formatCardioBulletWo(cardio) {
    if (!cardio) return '';
    var m = parseFloat(cardio.minutes);
    var d = parseFloat(cardio.distance);
    var cal = parseFloat(cardio.calories);
    var act = trackingCardioTypeLabel(cardio.type) || (cardio.activity || '').trim();
    var parts = [];
    if (!isNaN(m) && m > 0) parts.push(Math.round(m) + ' min');
    if (act) parts.push(act);
    if (cardio.type === 'sports') {
      if (!isNaN(cal) && cal > 0) parts.push(Math.round(cal) + ' cal');
    } else if (!isNaN(d) && d > 0) {
      parts.push((Math.round(d * 100) / 100) + ' mi');
    }
    if (parts.length) return '- Cardio · ' + parts.join(' · ');
    return '';
  }

  function cloneWorkoutSessionForShare(s) {
    try {
      return JSON.parse(JSON.stringify(s));
    } catch (e) {
      return null;
    }
  }

  function findTrackingSessionById(sessionId) {
    if (!WL || !sessionId) return null;
    var sessions = WL.getSessions();
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      if (!s) continue;
      if (s.id === sessionId) return s;
      if (s.serverId != null && String(s.serverId) === String(sessionId)) return s;
    }
    return null;
  }

  function getWoShareOpts() {
    return {
      incTitle: woIncTitle && woIncTitle.checked,
      incDateTime: woIncDatetime && woIncDatetime.checked,
      incExercises: woIncExercises && woIncExercises.checked,
      incCardio: woIncCardio && woIncCardio.checked,
      incIntensity: woIncIntensity && woIncIntensity.checked,
      incNotes: woIncNotes && woIncNotes.checked,
    };
  }

  function setWoShareStatus(t) {
    if (woShareStatus) woShareStatus.textContent = t || '';
  }

  function clearWoShareGraphicState() {
    if (woSharePreview) {
      woSharePreview.innerHTML =
        '<span class="create-share-preview-placeholder">Preview updates as you change options</span>';
    }
    setWoShareStatus('');
  }

  function closeWorkoutShareModal() {
    if (woShareBackdrop) {
      woShareBackdrop.classList.remove('is-open');
      woShareBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (woShareModal) {
      woShareModal.classList.remove('is-open');
      woShareModal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    if (woSharePreviewTimer) clearTimeout(woSharePreviewTimer);
    woSharePreviewTimer = null;
    clearWoShareGraphicState();
    lastShareWorkout = null;
  }

  function closeSessionDetail() {
    detailSessionRef = null;
    closeDetailDialog();
  }

  function openWorkoutEditor(session) {
    if (!session) return;
    closeSessionDetail();
    if (window.WorkoutEdit && typeof window.WorkoutEdit.open === 'function') {
      window.WorkoutEdit.open(session.id);
      var shell = document.getElementById('create-workout-shell');
      if (shell) shell.setAttribute('data-log-style', 'quick');
      var section = document.getElementById('logbook-quick-section');
      if (section) {
        section.hidden = false;
        section.classList.remove('logbook-quick-section--collapsed');
      }
      return;
    }
    window.alert('Could not open the workout editor.');
  }

  function deleteWorkoutSession(session) {
    if (!session || !WL || typeof WL.deleteSessionAsync !== 'function') return;
    var label = sessionDisplayTitle(session);
    if (!window.confirm('Delete "' + label + '" from your history? This cannot be undone.')) return;
    WL.deleteSessionAsync(session.id).then(function (ok) {
      if (!ok) {
        window.alert('Could not delete this workout. Try again.');
        return;
      }
      closeSessionDetail();
      refreshTrackingUi();
      if (window.TrainingSync && typeof window.TrainingSync.syncAll === 'function') {
        window.TrainingSync.syncAll();
      }
    });
  }

  function scheduleWoStickerPreview() {
    if (woSharePreviewTimer) clearTimeout(woSharePreviewTimer);
    woSharePreviewTimer = setTimeout(function () {
      woSharePreviewTimer = null;
      if (!lastShareWorkout || !woSharePreview || !window.StorySticker) return;
      window.StorySticker.renderWorkoutSticker(
        lastShareWorkout,
        getWoShareOpts(),
        WL,
        function (err, blob, canvas) {
          if (err || !canvas) return;
          woSharePreview.innerHTML = '';
          var cssW = Math.min(woSharePreview.clientWidth || 320, 360);
          var scale = cssW / canvas.width;
          canvas.style.width = cssW + 'px';
          canvas.style.height = Math.round(canvas.height * scale) + 'px';
          woSharePreview.appendChild(canvas);
        }
      );
    }, 120);
  }

  function openWorkoutShareModal(rawSession) {
    if (!woShareModal || !rawSession) return;
    var copy = cloneWorkoutSessionForShare(rawSession);
    if (!copy || !copy.id) return;
    lastShareWorkout = copy;
    clearWoShareGraphicState();
    if (woShareBackdrop) {
      woShareBackdrop.classList.add('is-open');
      woShareBackdrop.setAttribute('aria-hidden', 'false');
    }
    woShareModal.classList.add('is-open');
    woShareModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (woIncTitle) woIncTitle.checked = true;
    if (woIncDatetime) woIncDatetime.checked = true;
    if (woIncExercises) woIncExercises.checked = true;
    if (woIncCardio) woIncCardio.checked = true;
    if (woIncIntensity) woIncIntensity.checked = true;
    if (woIncNotes) woIncNotes.checked = false;
    if (!sessionHasCardioForWoShare(copy) && woIncCardio) woIncCardio.checked = false;
    if (window.InstagramConnect && woShareIgConnect) {
      window.InstagramConnect.mount(woShareIgConnect, { className: 'ig-connect ig-connect--modal' });
    }
    scheduleWoStickerPreview();
    if (woShareClose) woShareClose.focus();
  }

  function sessionHasCardioForWoShare(session) {
    return !!formatCardioBulletWo(session && session.cardio);
  }

  function bindWoShareClose(el) {
    if (!el) return;
    el.addEventListener('click', closeWorkoutShareModal);
  }
  bindWoShareClose(woShareClose);
  bindWoShareClose(woShareSkip);
  if (woShareBackdrop) {
    woShareBackdrop.addEventListener('click', closeWorkoutShareModal);
  }

  ;[woIncTitle, woIncDatetime, woIncExercises, woIncCardio, woIncIntensity, woIncNotes].forEach(function (el) {
    if (el) el.addEventListener('change', scheduleWoStickerPreview);
  });

  window.addEventListener('strongman:instagram-updated', function () {
    if (woShareModal && woShareModal.classList.contains('is-open')) {
      scheduleWoStickerPreview();
    }
  });

  if (window.StorySticker && woShareInstagram) {
    window.StorySticker.wireInstagramShareButton(
      woShareInstagram,
      function () {
        return {
          session: lastShareWorkout,
          opts: getWoShareOpts(),
          WL: WL,
        };
      },
      setWoShareStatus
    );
  }

  function formatTimeDisplay(t) {
    if (!t) return '';
    var parts = String(t).split(':');
    if (parts.length >= 2) return parts[0] + ':' + parts[1];
    return t;
  }

  function sessionExerciseNames(s) {
    var names = [];
    (s.exercises || []).forEach(function (ex) {
      if (ex && ex.name) names.push(String(ex.name));
      if (ex && ex.blockName) names.push(String(ex.blockName));
    });
    if (s.trackerData && Array.isArray(s.trackerData.exercises)) {
      s.trackerData.exercises.forEach(function (ex) {
        if (ex && ex.name) names.push(String(ex.name));
      });
    }
    return names;
  }

  function sessionMatchesSearch(s, q) {
    if (!q) return true;
    var needle = q.toLowerCase().trim();
    if (!needle) return true;
    var bits = [
      sessionDisplayTitle(s),
      sessionMetaLine(s),
      s.splitName || '',
      s.notes || '',
      s.title || '',
      s.date || '',
    ];
    if (s.date) {
      bits.push(String(s.date).replace(/-/g, '/'));
      bits.push(String(s.date).replace(/-/g, ' '));
      try {
        var p = String(s.date).split('-');
        if (p.length === 3) {
          var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
          bits.push(
            d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
          );
          bits.push(d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }));
          bits.push(d.toLocaleDateString());
        }
      } catch (e) {}
    }
    sessionExerciseNames(s).forEach(function (n) {
      bits.push(n);
    });
    var hay = bits.join(' ').toLowerCase();
    if (hay.indexOf(needle) !== -1) return true;
    /* multi-token: every word must appear somewhere */
    var tokens = needle.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      return tokens.every(function (t) {
        return hay.indexOf(t) !== -1;
      });
    }
    return false;
  }

  function getArchiveSessions() {
    if (!WL) return [];
    var all = WL.getSessions();
    if (!archiveSearchQuery) return all;
    return all.filter(function (s) {
      return sessionMatchesSearch(s, archiveSearchQuery);
    });
  }

  function getArchiveTimelineEvents() {
    var sessions = WL ? WL.getSessions() : [];
    var events =
      window.TrainingTimeline && typeof window.TrainingTimeline.collectEvents === 'function'
        ? window.TrainingTimeline.collectEvents(sessions)
        : sessions.map(function (s) {
            var day = s.date || '';
            var ts = s.createdAt ? Date.parse(s.createdAt) : Date.parse(day) || 0;
            return {
              id: 'workout_' + (s.id || day),
              source: 'workout',
              type: 'workout',
              editable: false,
              date: day,
              at: ts,
              title: sessionDisplayTitle(s),
              detail: '',
              session: s,
            };
          });
    events.forEach(function (ev) {
      if (ev.source === 'workout' && !ev.session) {
        var sid = String(ev.id || '').replace(/^workout_/, '');
        ev.session = sessions.find(function (s) {
          return String(s.id || '') === sid || String(s.clientId || '') === sid;
        }) || null;
      }
    });
    prTimelineEvents().forEach(function (ev) {
      events.push(ev);
    });
    events.sort(function (a, b) {
      return (b.at || 0) - (a.at || 0);
    });
    if (!archiveSearchQuery && archiveTypeFilter === 'all') return events;
    var q = String(archiveSearchQuery).toLowerCase().trim();
    return events.filter(function (ev) {
      if (archiveTypeFilter === 'workout' && ev.type !== 'workout') return false;
      if (archiveTypeFilter === 'pr' && ev.type !== 'pr') return false;
      if (archiveTypeFilter === 'note' && (ev.type === 'workout' || ev.type === 'pr')) return false;
      if (!q) return true;
      if (ev.session && sessionMatchesSearch(ev.session, archiveSearchQuery)) return true;
      var blob = [ev.title, ev.detail, ev.type, ev.date];
      if (ev.pr) blob.push(ev.pr.valueDisplay, ev.pr.discipline, ev.pr.notes);
      return blob.join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function prEventTimestamp(rec) {
    var day = String((rec && rec.date) || '').slice(0, 10);
    if (day) {
      var t = Date.parse(day + 'T' + String((rec.time || '12:00')).slice(0, 5));
      if (!isNaN(t)) return t;
      var dayOnly = Date.parse(day);
      if (!isNaN(dayOnly)) return dayOnly;
    }
    if (rec && rec.createdAt) {
      var c = Date.parse(rec.createdAt);
      if (!isNaN(c)) return c;
    }
    return 0;
  }

  function prTimelineEvents() {
    if (!PR || typeof PR.getRecords !== 'function') return [];
    return PR.getRecords().map(function (rec) {
      var day = String(rec.date || '').slice(0, 10);
      return {
        id: 'pr_' + (rec.id || rec.clientId || day),
        source: 'pr',
        type: 'pr',
        editable: true,
        date: day,
        at: prEventTimestamp(rec),
        title: rec.eventLabel || 'Personal record',
        detail: rec.valueDisplay || '',
        pr: rec,
      };
    });
  }

  function timelineTypeLabel(type) {
    if (type === 'workout') return 'Workout';
    if (window.TrainingTimeline && typeof window.TrainingTimeline.typeMeta === 'function') {
      var meta = window.TrainingTimeline.typeMeta(type);
      if (meta && meta.label) return meta.label;
    }
    return type ? String(type).replace(/_/g, ' ') : 'Note';
  }

  function timelineIconHtml(type) {
    if (window.TrainingTimeline && typeof window.TrainingTimeline.iconForType === 'function') {
      return window.TrainingTimeline.iconForType(type || 'note');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 9.5v5M17.5 9.5v5M4 11v2M20 11v2M8 8h8v8H8z"/></svg>';
  }

  function updateArchiveSummary(allSessions, shownSessions) {
    if (archiveCountEl) {
      archiveCountEl.textContent =
        shownSessions.length +
        ' of ' +
        allSessions.length +
        ' session' +
        (allSessions.length === 1 ? '' : 's');
    }
    if (archiveStatShown) archiveStatShown.textContent = String(shownSessions.length);
    if (archiveStatTotal) archiveStatTotal.textContent = String(allSessions.length);
    var liftCount = 0;
    var intSum = 0;
    var intCount = 0;
    shownSessions.forEach(function (s) {
      liftCount += countSessionExercises(s);
      if (s.totalIntensity != null && !isNaN(s.totalIntensity)) {
        intSum += s.totalIntensity;
        intCount += 1;
      }
    });
    if (archiveStatLifts) archiveStatLifts.textContent = String(liftCount);
    if (archiveStatIntensity) {
      archiveStatIntensity.textContent =
        intCount > 0 ? String(Math.round(intSum / intCount)) : '—';
    }
  }

  if (archiveSearchInput) {
    archiveSearchInput.addEventListener('input', function () {
      archiveSearchQuery = archiveSearchInput.value || '';
      renderArchiveInline();
    });
  }

  if (archiveFilterRoot) {
    archiveFilterRoot.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-tl-filter]');
      if (!btn) return;
      var next = btn.getAttribute('data-tl-filter') || 'all';
      archiveTypeFilter = next;
      archiveFilterRoot.querySelectorAll('[data-tl-filter]').forEach(function (el) {
        var on = el.getAttribute('data-tl-filter') === next;
        el.classList.toggle('is-active', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderArchiveInline();
    });
  }

  function getArchiveView() {
    return 'timeline';
  }

  function setArchiveView(view) {
    localStorage.setItem(ARCHIVE_VIEW_KEY, 'timeline');
    if (archiveScroll) archiveScroll.setAttribute('data-archive-view', 'timeline');
    renderArchiveInline();
  }

  archiveViewBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setArchiveView('timeline');
    });
  });

  if (archiveScroll) {
    archiveScroll.setAttribute('data-archive-view', getArchiveView());
    archiveViewBtns.forEach(function (btn) {
      var on = btn.getAttribute('data-archive-view') === getArchiveView();
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function sessionDisplayTitle(s) {
    if (s.title) return s.title;
    return (s.splitName || 'Workout') + (s.date ? ' · ' + s.date : '');
  }

  function sessionMetaLine(s) {
    var bits = [];
    if (s.date) bits.push(s.date);
    if (s.time) bits.push(formatTimeDisplay(s.time));
    if (s.splitName) bits.push(s.splitName);
    return bits.join(' · ');
  }

  function countSessionExercises(s) {
    if (s.exercises && s.exercises.length) return s.exercises.length;
    if (s.trackerData && Array.isArray(s.trackerData.exercises)) {
      return s.trackerData.exercises.filter(function (ex) {
        return ex && ex.name;
      }).length;
    }
    return 0;
  }

  function sessionExercisesForDisplay(s) {
    if (s.exercises && s.exercises.length) return s.exercises;
    if (s.trackerData && Array.isArray(s.trackerData.exercises)) {
      return s.trackerData.exercises
        .filter(function (ex) {
          return ex && ex.name;
        })
        .map(function (ex) {
          var sets = Array.isArray(ex.sets) ? ex.sets : [];
          var weights = sets
            .map(function (set) {
              return set && set.weight != null ? set.weight : null;
            })
            .filter(function (w) {
              return w != null;
            });
          var reps = sets
            .map(function (set) {
              return set && set.reps != null ? set.reps : null;
            })
            .filter(function (r) {
              return r != null;
            });
          return {
            name: ex.name,
            sets: sets.length || '',
            reps: reps.length ? reps.join('/') : '',
            setWeights: weights,
            weight: weights.length ? weights[0] : '',
          };
        });
    }
    return [];
  }

  function sessionIntensityLabel(s) {
    if (WL && s.totalIntensity != null) {
      return s.totalIntensity + ' · ' + WL.intensityLabel(s.totalIntensity);
    }
    return '—';
  }

  function monthYearLabel(y, m) {
    try {
      return new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
      return y + '-' + (m + 1);
    }
  }

  function openSessionDetail(s) {
    if (!detailBodyEl || !detailTitleEl || !s) return;
    detailSessionRef = s;
    detailBodyEl.innerHTML = '';
    detailTitleEl.textContent = sessionDisplayTitle(s);
    if (sessionMetaLine(s)) {
      var metaP = document.createElement('p');
      metaP.className = 'tracking-detail-p';
      metaP.textContent = sessionMetaLine(s);
      detailBodyEl.appendChild(metaP);
    }
    var exUl = document.createElement('ul');
    exUl.className = 'tracking-saved-exercises';
    sessionExercisesForDisplay(s).forEach(function (ex) {
      var exLi = document.createElement('li');
      var label = ex.name || 'Exercise';
      if (ex.blockName) label = ex.blockName + ' · ' + label;
      var w = '—';
      if (ex.setWeights && ex.setWeights.length) {
        w = ex.setWeights.join(' / ') + ' lb';
      } else if (ex.weight != null && ex.weight !== '') {
        w = ex.weight + ' lb';
      }
      exLi.textContent = label + ' · ' + (ex.sets || '0') + '×' + (ex.reps || '0') + ' @ ' + w;
      exUl.appendChild(exLi);
    });
    if (exUl.children.length) detailBodyEl.appendChild(exUl);
    var inten = document.createElement('p');
    inten.className = 'tracking-detail-p';
    inten.textContent = 'Session intensity: ' + sessionIntensityLabel(s);
    detailBodyEl.appendChild(inten);
    var notes = (s.notes || '').trim();
    if (notes) {
      var notesP = document.createElement('p');
      notesP.className = 'tracking-detail-p';
      notesP.textContent = notes;
      detailBodyEl.appendChild(notesP);
    }
    var actions = document.createElement('div');
    actions.className = 'tracking-session-detail-actions';
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'tracking-session-detail-btn tracking-session-edit-btn';
    editBtn.textContent = 'Edit workout';
    editBtn.setAttribute('data-session-edit-for', s.id || '');
    actions.appendChild(editBtn);
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tracking-session-detail-btn tracking-session-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-session-delete-for', s.id || '');
    actions.appendChild(deleteBtn);
    var storyBtn = document.createElement('button');
    storyBtn.type = 'button';
    storyBtn.className = 'tracking-session-detail-btn tracking-session-story-btn';
    storyBtn.textContent = 'Story sticker';
    storyBtn.setAttribute('data-workout-story-for', s.id || '');
    actions.appendChild(storyBtn);
    detailBodyEl.appendChild(actions);
    if (detailBackdrop) {
      detailBackdrop.classList.add('is-open');
      detailBackdrop.setAttribute('aria-hidden', 'false');
    }
    if (detailDialog) {
      detailDialog.classList.add('is-open');
      detailDialog.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
    if (detailCloseBtn) detailCloseBtn.focus();
  }

  function buildSessionLi(s) {
    var li = document.createElement('li');
    li.className = 'dash-archive-card';
    var title = sessionDisplayTitle(s);
    var head = document.createElement('h3');
    head.className = 'dash-archive-card-head';
    head.textContent = title;
    var meta = document.createElement('p');
    meta.className = 'dash-archive-card-meta';
    var bits = [];
    if (s.date) bits.push(s.date);
    if (s.time) bits.push(formatTimeDisplay(s.time));
    if (s.splitName) bits.push(s.splitName);
    meta.textContent = bits.join(' · ');
    var exUl = document.createElement('ul');
    exUl.className = 'tracking-saved-exercises';
    (s.exercises || []).forEach(function (ex) {
      var exLi = document.createElement('li');
      var label = ex.name || 'Exercise';
      if (ex.blockName) label = ex.blockName + ' · ' + label;
      var w = '—';
      if (ex.setWeights && ex.setWeights.length) {
        w = ex.setWeights.join(' / ') + ' lb';
      } else if (ex.weight != null && ex.weight !== '') {
        w = ex.weight + ' lb';
      }
      var exText = label + ' · ' + (ex.sets || '0') + '×' + (ex.reps || '0') + ' @ ' + w;
      if (ex.superset) {
        exText +=
          ' · superset: ' +
          (ex.superset.name || 'Exercise') +
          ' ' +
          (ex.superset.sets || '0') +
          '×' +
          (ex.superset.reps || '0') +
          ' @ ' +
          (ex.superset.weight || '0') +
          ' lb';
      }
      if (ex.dropSets && ex.dropSets.length) {
        exText +=
          ' · drops: ' +
          ex.dropSets
            .map(function (drop) {
              return (drop.reps || '0') + ' @ ' + (drop.weight || '0') + ' lb';
            })
            .join(', ');
      }
      exLi.textContent = exText;
      exUl.appendChild(exLi);
    });
    if (s.cardio && (s.cardio.minutes || s.cardio.activity || s.cardio.type || s.cardio.distance || s.cardio.calories)) {
      var cardioLi = document.createElement('li');
      var cm = parseFloat(s.cardio.minutes);
      var cd = parseFloat(s.cardio.distance);
      var cc = parseFloat(s.cardio.calories);
      var cardioTypeLabels = {
        running: 'Running',
        walking: 'Walking',
        cycling: 'Cycling',
        swimming: 'Swimming',
        rowing: 'Rowing',
        elliptical: 'Elliptical',
        'stair-climber': 'Stair climber',
        hiking: 'Hiking',
        rucking: 'Rucking',
        'ski-erg': 'SkiErg',
        'other-cardio': 'Other cardio',
        sports: 'Sports'
      };
      var ca = cardioTypeLabels[s.cardio.type] || (s.cardio.activity || '').trim();
      var cardioBits = [];
      if (!isNaN(cm) && cm > 0) cardioBits.push(Math.round(cm) + ' min');
      if (ca) cardioBits.push(ca);
      if (s.cardio.type === 'sports') {
        if (!isNaN(cc) && cc > 0) cardioBits.push(Math.round(cc) + ' cal');
      } else if (!isNaN(cd) && cd > 0) {
        cardioBits.push((Math.round(cd * 100) / 100) + ' mi');
      }
      var cardioBit = cardioBits.join(' · ');
      cardioLi.textContent = 'Cardio · ' + cardioBit;
      exUl.appendChild(cardioLi);
    }
    var foot = document.createElement('div');
    foot.className = 'tracking-saved-item-foot';
    if (WL && s.totalIntensity != null) {
      foot.textContent =
        'Session intensity: ' + s.totalIntensity + ' (' + WL.intensityLabel(s.totalIntensity) + ')';
    } else {
      foot.textContent = 'Session intensity: —';
    }
    li.appendChild(head);
    if (meta.textContent) li.appendChild(meta);
    if (exUl.children.length) li.appendChild(exUl);
    var photoRow = document.createElement('div');
    photoRow.className = 'dash-archive-card-actions tracking-session-photo-row';
    if ((s.photos || []).length) {
      var strip = document.createElement('div');
      strip.className = 'tracking-session-photo-thumbs';
      var sidForPhotos = s.id || '';
      (s.photos || []).forEach(function (p, photoIdx) {
        if (!p || !p.dataUrl || photoIdx >= 8) return;
        var wrap = document.createElement('div');
        wrap.className = 'tracking-session-photo-thumb-wrap';
        var im = document.createElement('img');
        im.className = 'tracking-session-photo-thumb';
        im.src = p.dataUrl;
        im.alt = 'Progress photo';
        im.loading = 'lazy';
        wrap.appendChild(im);
        var rmPhoto = document.createElement('button');
        rmPhoto.type = 'button';
        rmPhoto.className = 'tracking-session-photo-remove';
        rmPhoto.setAttribute('aria-label', 'Detach photo');
        rmPhoto.title = 'Detach photo';
        rmPhoto.textContent = '×';
        rmPhoto.setAttribute('data-session-photo-remove-for', sidForPhotos);
        if (p.id) rmPhoto.setAttribute('data-photo-id', p.id);
        else rmPhoto.setAttribute('data-photo-index', String(photoIdx));
        wrap.appendChild(rmPhoto);
        strip.appendChild(wrap);
      });
      photoRow.appendChild(strip);
    }
    var storyBtn = document.createElement('button');
    storyBtn.type = 'button';
    storyBtn.className = 'tracking-session-photo-btn tracking-session-story-btn';
    storyBtn.textContent = 'Story sticker';
    storyBtn.setAttribute('data-workout-story-for', s.id || '');
    photoRow.appendChild(storyBtn);
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'tracking-session-photo-btn tracking-session-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.setAttribute('data-session-edit-for', s.id || '');
    photoRow.appendChild(editBtn);
    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tracking-session-photo-btn tracking-session-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('data-session-delete-for', s.id || '');
    photoRow.appendChild(deleteBtn);
    li.appendChild(photoRow);
    li.appendChild(foot);
    return li;
  }

  function updateStatDaysFromSessions(sessions) {
    var statDays = document.getElementById('tracking-stat-days');
    if (!statDays) return;
    var daySet = {};
    sessions.forEach(function (s) {
      if (s.date) daySet[s.date] = true;
    });
    statDays.textContent = String(Object.keys(daySet).length);
  }

  function buildSessionBlockCard(s) {
    var li = document.createElement('li');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dash-archive-block-card';
    btn.setAttribute('data-session-open', s.id || '');
    var h = document.createElement('span');
    h.className = 'dash-quick-label';
    h.textContent = sessionDisplayTitle(s);
    var meta = document.createElement('span');
    meta.className = 'dash-quick-desc';
    meta.textContent = sessionMetaLine(s);
    var stats = document.createElement('div');
    stats.className = 'dash-archive-block-pills';
    var exPill = document.createElement('span');
    exPill.className = 'dash-archive-pill';
    exPill.textContent = countSessionExercises(s) + ' lift' + (countSessionExercises(s) === 1 ? '' : 's');
    stats.appendChild(exPill);
    if (s.cardio && (s.cardio.minutes || s.cardio.activity)) {
      var cPill = document.createElement('span');
      cPill.className = 'dash-archive-pill';
      cPill.textContent = 'Cardio';
      stats.appendChild(cPill);
    }
    if (WL && s.totalIntensity != null) {
      var iPill = document.createElement('span');
      iPill.className = 'dash-archive-pill dash-archive-pill--accent';
      iPill.textContent = 'RPE ' + s.totalIntensity;
      stats.appendChild(iPill);
    }
    btn.appendChild(h);
    if (meta.textContent) btn.appendChild(meta);
    btn.appendChild(stats);
    li.appendChild(btn);
    return li;
  }

  function formatArchiveDay(dateStr) {
    if (!dateStr) return '';
    try {
      var p = String(dateStr).split('-');
      if (p.length !== 3) return dateStr;
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function formatArchiveDayShort(dateStr) {
    if (!dateStr) return '';
    try {
      var p = String(dateStr).split('-');
      if (p.length !== 3) return dateStr;
      var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      var letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      return letters[d.getDay()] + ' · ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function formatClockTime(t) {
    var hm = formatTimeDisplay(t);
    var parts = hm.split(':');
    var h = parseInt(parts[0], 10);
    if (isNaN(h)) return hm;
    var suffix = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (parts[1] || '00') + ' ' + suffix;
  }

  function timelineEventKindLabel(ev) {
    if (ev.type === 'pr') {
      return PR && typeof PR.disciplineLabel === 'function'
        ? PR.disciplineLabel(ev.pr && ev.pr.discipline) + ' PR'
        : 'Personal record';
    }
    return timelineTypeLabel(ev.type);
  }

  function timelineDetailLines(ev) {
    var out = [];
    var session = ev.session;
    var nameCap = isDesktopStatsHub() ? 16 : 5;
    if (session) {
      var names = sessionExerciseNames(session);
      names.slice(0, nameCap).forEach(function (name) {
        out.push(name);
      });
      if (names.length > nameCap) out.push('+' + (names.length - nameCap) + ' more');
      if (!names.length) {
        var n = countSessionExercises(session);
        if (n) out.push(n + ' exercise' + (n === 1 ? '' : 's'));
      }
      if (session.cardio && session.cardio.minutes) {
        var cm = parseFloat(session.cardio.minutes);
        if (!isNaN(cm) && cm > 0) out.push('Cardio · ' + Math.round(cm) + ' min');
      }
      if (session.totalIntensity != null && !isNaN(session.totalIntensity)) {
        out.push('Intensity ' + session.totalIntensity);
      }
      if (session.notes && (!names.length || isDesktopStatsHub())) {
        var notes = String(session.notes).trim();
        if (notes) out.push(notes);
      }
      return out;
    }
    if (ev.pr) {
      var bits = [];
      if (ev.pr.time) bits.push(formatClockTime(ev.pr.time));
      var hist = Array.isArray(ev.pr.history) ? ev.pr.history.length : 0;
      if (hist) bits.push(hist + ' earlier attempt' + (hist === 1 ? '' : 's'));
      if (bits.length) out.push(bits.join(' · '));
      var prNotes = (ev.pr.notes || '').trim();
      if (prNotes) out.push(prNotes);
      return out;
    }
    if (ev.detail) out.push(ev.detail);
    return out;
  }

  function timelineActionBtn(label, variant) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'log-tl-action' + (variant ? ' log-tl-action--' + variant : '');
    btn.textContent = label;
    return btn;
  }

  function buildArchiveTimeline(events) {
    var wrap = document.createElement('ol');
    wrap.className = 'log-tl-list';
    wrap.setAttribute('role', 'list');

    (events || []).forEach(function (ev) {
      var type = ev.type || (ev.source === 'workout' ? 'workout' : 'note');
      var session = ev.session;
      var pr = ev.pr;

      var li = document.createElement('li');
      li.className = 'log-tl-item log-tl-item--' + type;

      var rail = document.createElement('span');
      rail.className = 'log-tl-rail';
      rail.setAttribute('aria-hidden', 'true');
      var icon = document.createElement('span');
      icon.className = 'log-tl-icon';
      icon.innerHTML = timelineIconHtml(type === 'pr' ? 'milestone' : type);
      rail.appendChild(icon);

      var card = document.createElement('div');
      card.className = 'log-tl-card';

      var head = document.createElement('div');
      head.className = 'log-tl-card-head';
      var day = document.createElement('span');
      day.className = 'log-tl-day';
      day.textContent = formatArchiveDayShort(ev.date || (session && session.date) || '');
      var kind = document.createElement('span');
      kind.className = 'log-tl-kind';
      kind.textContent = timelineEventKindLabel(ev);
      head.appendChild(day);
      head.appendChild(kind);

      var title = document.createElement('h3');
      title.className = 'log-tl-title';
      title.textContent = ev.title || (session ? sessionDisplayTitle(session) : 'Entry');

      card.appendChild(head);
      card.appendChild(title);

      if (pr) {
        var value = document.createElement('div');
        value.className = 'log-tl-value';
        value.textContent = pr.valueDisplay || '—';
        card.appendChild(value);
      }

      var lines = document.createElement('div');
      lines.className = 'log-tl-lines';
      timelineDetailLines(ev).forEach(function (text) {
        var line = document.createElement('div');
        line.className = 'log-tl-line';
        line.textContent = text;
        lines.appendChild(line);
      });
      if (lines.childNodes.length) card.appendChild(lines);

      var actions = document.createElement('div');
      actions.className = 'log-tl-actions';

      if (session) {
        li.classList.add('log-tl-item--clickable');
        li.setAttribute('data-session-open', session.id || '');
        var openBtn = timelineActionBtn('Open');
        openBtn.setAttribute('data-session-open', session.id || '');
        var editBtn = timelineActionBtn('Edit');
        editBtn.classList.add('tracking-session-edit-btn');
        editBtn.setAttribute('data-session-edit-for', session.id || '');
        var deleteBtn = timelineActionBtn('Delete', 'danger');
        deleteBtn.classList.add('tracking-session-delete-btn');
        deleteBtn.setAttribute('data-session-delete-for', session.id || '');
        actions.appendChild(openBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
      } else if (pr) {
        li.classList.add('log-tl-item--clickable');
        li.setAttribute('data-pr-open', pr.id || pr.clientId || '');
        var updateBtn = timelineActionBtn('Update');
        updateBtn.setAttribute('data-pr-open', pr.id || pr.clientId || '');
        actions.appendChild(updateBtn);
      } else if (ev.source === 'custom' && ev.editable) {
        var editEvBtn = timelineActionBtn('Edit');
        editEvBtn.setAttribute('data-tl-edit', ev.id || '');
        var deleteEvBtn = timelineActionBtn('Delete', 'danger');
        deleteEvBtn.setAttribute('data-tl-delete', ev.id || '');
        actions.appendChild(editEvBtn);
        actions.appendChild(deleteEvBtn);
      }

      if (actions.childNodes.length) card.appendChild(actions);

      li.appendChild(rail);
      li.appendChild(card);
      wrap.appendChild(li);
    });
    return wrap;
  }

  function buildArchiveTable(sessions) {
    var wrap = document.createElement('div');
    wrap.className = 'dash-archive-table-wrap';
    var table = document.createElement('table');
    table.className = 'dash-archive-table';
    var thead = document.createElement('thead');
    thead.innerHTML =
      '<tr><th>Date</th><th>Session</th><th>Split</th><th>Lifts</th><th>Intensity</th><th></th></tr>';
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    sessions.forEach(function (s) {
      var tr = document.createElement('tr');
      tr.className = 'dash-archive-table-row';
      tr.setAttribute('data-session-open', s.id || '');
      var tdDate = document.createElement('td');
      tdDate.textContent = (s.date || '—') + (s.time ? ' ' + formatTimeDisplay(s.time) : '');
      var tdTitle = document.createElement('td');
      tdTitle.textContent = sessionDisplayTitle(s);
      var tdSplit = document.createElement('td');
      tdSplit.textContent = s.splitName || '—';
      var tdLifts = document.createElement('td');
      tdLifts.textContent = String(countSessionExercises(s));
      var tdInt = document.createElement('td');
      tdInt.textContent = WL && s.totalIntensity != null ? String(s.totalIntensity) : '—';
      var tdAct = document.createElement('td');
      tdAct.className = 'dash-archive-table-actions';
      var openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'dash-archive-table-btn';
      openBtn.textContent = 'Open';
      openBtn.setAttribute('data-session-open', s.id || '');
      var storyBtn = document.createElement('button');
      storyBtn.type = 'button';
      storyBtn.className = 'dash-archive-table-btn tracking-session-story-btn';
      storyBtn.textContent = 'Story';
      storyBtn.setAttribute('data-workout-story-for', s.id || '');
      tdAct.appendChild(openBtn);
      tdAct.appendChild(storyBtn);
      tr.appendChild(tdDate);
      tr.appendChild(tdTitle);
      tr.appendChild(tdSplit);
      tr.appendChild(tdLifts);
      tr.appendChild(tdInt);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderArchiveInline() {
    if (!archiveViewRoot) return;
    var allSessions = WL ? WL.getSessions() : [];
    var events = getArchiveTimelineEvents();
    var allEvents = (
      window.TrainingTimeline && typeof window.TrainingTimeline.collectEvents === 'function'
        ? window.TrainingTimeline.collectEvents(allSessions)
        : allSessions.map(function () {
            return {};
          })
    ).concat(prTimelineEvents());
    archiveViewRoot.innerHTML = '';
    // updateArchiveSummary also writes into archiveCountEl, so the entry count
    // has to land after it.
    updateArchiveSummary(allSessions, getArchiveSessions());
    if (archiveCountEl) {
      archiveCountEl.textContent =
        events.length +
        ' of ' +
        allEvents.length +
        ' entr' +
        (allEvents.length === 1 ? 'y' : 'ies');
    }
    if (archiveScroll) archiveScroll.setAttribute('data-archive-view', 'timeline');
    var hasAny = allEvents.length > 0;
    var hasMatches = events.length > 0;
    if (archiveInlineEmpty) {
      archiveInlineEmpty.hidden = hasAny;
      archiveInlineEmpty.textContent = 'No timeline entries yet.';
    }
    if (archiveSearchEmpty) {
      var filteredOut = hasAny && !hasMatches && (!!archiveSearchQuery || archiveTypeFilter !== 'all');
      archiveSearchEmpty.hidden = !filteredOut;
      archiveSearchEmpty.textContent = archiveSearchQuery
        ? 'No entries match your search.'
        : 'No entries for this filter.';
    }
    if (!hasMatches) return;
    archiveViewRoot.appendChild(buildArchiveTimeline(events));
  }

  function parseLiftValueDisplay(display) {
    var out = { weight: null, unit: 'lb', reps: null };
    if (!display) return out;
    var m = String(display).match(/([\d.]+)\s*(lb|kg)/i);
    if (m) {
      out.weight = parseFloat(m[1]);
      out.unit = m[2].toLowerCase();
    }
    var r = String(display).match(/[×x]\s*(\d+)/i);
    if (r) out.reps = parseInt(r[1], 10);
    return out;
  }

  function parseTimePartsFromSeconds(sec) {
    var s = Math.max(0, Number(sec) || 0);
    var mins = Math.floor(s / 60);
    var rem = Math.round((s - mins * 60) * 100) / 100;
    return { min: mins, sec: rem };
  }

  function buildPrSparkline(rec) {
    var series =
      PR && typeof PR.progressSeries === 'function' ? PR.progressSeries(rec) : [];
    if (series.length < 2) return null;
    var timed = rec.discipline === 'running' || rec.discipline === 'swimming';
    var values = series
      .map(function (p) {
        if (timed) return p.valueSeconds != null ? Number(p.valueSeconds) : null;
        return p.weight != null ? Number(p.weight) : null;
      })
      .filter(function (v) {
        return v != null && !isNaN(v);
      });
    if (values.length < 2) return null;
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = max - min || 1;
    var w = 120;
    var h = 36;
    var pad = 3;
    var pts = values.map(function (v, i) {
      var x = pad + (i / (values.length - 1)) * (w - pad * 2);
      var yNorm = timed ? (v - min) / span : (v - min) / span;
      // Timed: lower is better — flip so improvement trends up
      if (timed) yNorm = 1 - yNorm;
      var y = pad + (1 - yNorm) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'pr-card-spark');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', '120');
    svg.setAttribute('height', '36');
    svg.setAttribute('aria-hidden', 'true');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', 'currentColor');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    poly.setAttribute('points', pts.join(' '));
    svg.appendChild(poly);
    return svg;
  }

  function buildPrArchiveLi(rec) {
    var li = document.createElement('li');
    li.className = 'tracking-saved-item tracking-pr-archive-item pr-card';
    li.setAttribute('data-pr-id', rec.id || rec.clientId || '');
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.setAttribute('aria-label', 'Update ' + (rec.eventLabel || 'personal record'));

    var disc = document.createElement('span');
    disc.className = 'pr-card-disc';
    disc.textContent = PR ? PR.disciplineLabel(rec.discipline) : rec.discipline || 'PR';
    var head = document.createElement('div');
    head.className = 'tracking-saved-item-head pr-card-title';
    head.textContent = rec.eventLabel || 'Personal best';
    var meta = document.createElement('div');
    meta.className = 'tracking-saved-item-meta pr-card-meta';
    var bits = [];
    if (rec.date) bits.push(rec.date);
    if (rec.time) bits.push(formatTimeDisplay(rec.time));
    var histLen = Array.isArray(rec.history) ? rec.history.length : 0;
    if (histLen) bits.push(histLen + ' past');
    meta.textContent = bits.join(' · ');
    var result = document.createElement('div');
    result.className = 'tracking-pr-archive-result pr-card-result';
    result.textContent = rec.valueDisplay || '—';
    var hint = document.createElement('span');
    hint.className = 'pr-card-edit-hint';
    hint.textContent = 'Tap to update';

    li.appendChild(disc);
    li.appendChild(head);
    if (meta.textContent) li.appendChild(meta);
    li.appendChild(result);
    var spark = buildPrSparkline(rec);
    if (spark) {
      var sparkWrap = document.createElement('div');
      sparkWrap.className = 'pr-card-spark-wrap';
      sparkWrap.appendChild(spark);
      li.appendChild(sparkWrap);
    }
    var notes = (rec.notes || '').trim();
    if (notes) {
      var foot = document.createElement('div');
      foot.className = 'tracking-saved-item-foot tracking-pr-archive-notes pr-card-notes';
      foot.textContent = notes;
      li.appendChild(foot);
    }
    li.appendChild(hint);
    li.addEventListener('click', function () {
      openPrEditDialog(rec);
    });
    li.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPrEditDialog(rec);
      }
    });
    return li;
  }

  function renderPrArchiveList() {
    /* PRs tab removed — records live on the timeline. */
  }

  var prEditBackdrop = document.getElementById('pr-edit-backdrop');
  var prEditDialog = document.getElementById('pr-edit-dialog');
  var prEditForm = document.getElementById('pr-edit-form');
  var prEditClose = document.getElementById('pr-edit-close');
  var editingPrId = null;

  function setPrEditError(msg) {
    var el = document.getElementById('pr-edit-error');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function closePrEditDialog() {
    editingPrId = null;
    if (prEditBackdrop) {
      prEditBackdrop.classList.remove('is-open');
      prEditBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (prEditDialog) {
      prEditDialog.hidden = true;
      prEditDialog.classList.remove('is-open');
      prEditDialog.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  function openPrEditDialog(rec) {
    if (!prEditDialog || !rec) return;
    editingPrId = rec.id || rec.clientId;
    setPrEditError('');
    var discEl = document.getElementById('pr-edit-disc');
    var titleEl = document.getElementById('pr-edit-title');
    var idEl = document.getElementById('pr-edit-id');
    var dtEl = document.getElementById('pr-edit-datetime');
    var notesEl = document.getElementById('pr-edit-notes');
    var liftFields = document.getElementById('pr-edit-fields-lift');
    var timeFields = document.getElementById('pr-edit-fields-time');
    if (idEl) idEl.value = editingPrId || '';
    if (discEl) discEl.textContent = PR ? PR.disciplineLabel(rec.discipline) : rec.discipline || 'PR';
    if (titleEl) titleEl.textContent = rec.eventLabel || 'Update personal record';
    if (notesEl) notesEl.value = rec.notes || '';
    if (dtEl) {
      var d = rec.date || '';
      var t = (rec.time || '12:00').slice(0, 5);
      dtEl.value = d ? d + 'T' + t : defaultDatetimeLocal();
    }
    var isLift = rec.discipline === 'weightlifting';
    if (liftFields) liftFields.hidden = !isLift;
    if (timeFields) timeFields.hidden = isLift;
    if (isLift) {
      var parsed = parseLiftValueDisplay(rec.valueDisplay);
      var wEl = document.getElementById('pr-edit-weight');
      var uEl = document.getElementById('pr-edit-unit');
      var rEl = document.getElementById('pr-edit-reps');
      if (wEl) wEl.value = rec.weight != null ? rec.weight : parsed.weight != null ? parsed.weight : '';
      if (uEl) uEl.value = rec.unit || parsed.unit || 'lb';
      if (rEl) rEl.value = rec.reps != null ? rec.reps : parsed.reps != null ? parsed.reps : '';
    } else {
      var parts =
        rec.valueSeconds != null
          ? parseTimePartsFromSeconds(rec.valueSeconds)
          : { min: 0, sec: 0 };
      if (rec.valueSeconds == null && rec.valueDisplay && window.TimedEventFields) {
        var secs = window.TimedEventFields.parseTimeDisplaySeconds(rec.valueDisplay);
        if (secs != null) parts = parseTimePartsFromSeconds(secs);
      }
      var minEl = document.getElementById('pr-edit-min');
      var secEl = document.getElementById('pr-edit-sec');
      if (minEl) minEl.value = parts.min;
      if (secEl) secEl.value = parts.sec;
    }
    if (prEditBackdrop) {
      prEditBackdrop.classList.add('is-open');
      prEditBackdrop.setAttribute('aria-hidden', 'false');
    }
    prEditDialog.hidden = false;
    prEditDialog.classList.add('is-open');
    prEditDialog.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  if (prEditClose) prEditClose.addEventListener('click', closePrEditDialog);
  if (prEditBackdrop) prEditBackdrop.addEventListener('click', closePrEditDialog);
  if (prEditForm && PR) {
    prEditForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setPrEditError('');
      var id = editingPrId || (document.getElementById('pr-edit-id') || {}).value;
      var existing = PR.getRecordById ? PR.getRecordById(id) : null;
      if (!existing) {
        setPrEditError('Could not find that PR.');
        return;
      }
      var dt = (document.getElementById('pr-edit-datetime') || {}).value;
      if (!dt) {
        setPrEditError('Pick a date and time.');
        return;
      }
      var parts = dt.split('T');
      var patch = {
        date: parts[0] || '',
        time: parts[1] || '',
        notes: ((document.getElementById('pr-edit-notes') || {}).value || '').trim(),
      };
      if (existing.discipline === 'weightlifting') {
        var w = parseFloat((document.getElementById('pr-edit-weight') || {}).value);
        var unit = (document.getElementById('pr-edit-unit') || {}).value || 'lb';
        var reps = parseInt((document.getElementById('pr-edit-reps') || {}).value, 10);
        if (isNaN(w) || w <= 0) {
          setPrEditError('Enter a valid weight.');
          return;
        }
        patch.weight = w;
        patch.unit = unit;
        patch.reps = !isNaN(reps) && reps > 0 ? reps : 1;
        patch.valueDisplay = w + ' ' + unit;
        if (patch.reps > 1) patch.valueDisplay += ' × ' + patch.reps;
        patch.valueSeconds = null;
      } else {
        var rm = (document.getElementById('pr-edit-min') || {}).value;
        var rs = (document.getElementById('pr-edit-sec') || {}).value;
        var valueDisplay = formatDurationParts(rm, rs);
        if (!valueDisplay || valueDisplay === '0s') {
          setPrEditError('Enter a time greater than zero.');
          return;
        }
        patch.valueDisplay = valueDisplay;
        if (
          window.TimedEventFields &&
          typeof window.TimedEventFields.parseTimeDisplaySeconds === 'function'
        ) {
          patch.valueSeconds = window.TimedEventFields.parseTimeDisplaySeconds(valueDisplay);
        }
      }
      PR.updateRecord(id, patch);
      closePrEditDialog();
      renderPrCard();
      renderPrArchiveList();
      refreshTrackingUi();
    });
  }

  function closeDetailDialog() {
    detailSessionRef = null;
    if (detailBackdrop) {
      detailBackdrop.classList.remove('is-open');
      detailBackdrop.setAttribute('aria-hidden', 'true');
    }
    if (detailDialog) {
      detailDialog.classList.remove('is-open');
      detailDialog.setAttribute('aria-hidden', 'true');
    }
    if (detailBodyEl) detailBodyEl.innerHTML = '';
    document.body.style.overflow = '';
  }

  function openComplicationDetail(key) {
    if (!detailBodyEl || !detailTitleEl) return;
    detailBodyEl.innerHTML = '';
    var title = 'Details';
    if (key === 'volume-chart') {
      title = 'Training volume';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Sum of <strong>weight × reps</strong> for every logged set in each time bucket. When this climbs while form stays solid, you’re building work capacity and usually strength.</p>';
    } else if (key === 'peak-chart') {
      title = 'Peak load';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">The heaviest set for the selected lift in each bucket. This is the most direct “am I getting stronger?” chart — pick different lifts in the dropdown.</p>';
    } else if (key === 'e1rm-chart') {
      title = 'Estimated 1RM';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Uses the Epley formula from your best set: weight × (1 + reps/30). It estimates what you could single if you don’t test maxes often.</p>';
    } else if (key === 'compare-chart') {
      title = 'Lift progress';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Compares peak weights from the <strong>first half</strong> of this range to the <strong>second half</strong> for your most-logged lifts. Accent bars higher than gray = that lift got stronger.</p>';
    } else if (key === 'chart') {
      title = 'Session frequency';
      var r = getStatsRange();
      var rNote =
        r === 'year'
          ? 'Sessions per month for the current calendar year.'
          : r === 'all'
            ? 'Sessions per calendar year across your full archive.'
            : 'Sessions per day for the current calendar month.';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">' +
        rNote +
        ' Frequency alone isn’t strength — pair it with rising volume/peak load above.</p>';
    } else if (key === 'intensity-chart') {
      title = 'How hard it felt';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Average of your self-reported session intensity (0–100). High effort with flat peak loads can mean overreaching — or just hard technique work.</p>';
    } else {
      detailBodyEl.innerHTML = '<p class="tracking-detail-p">No extra information for this tile.</p>';
    }
    detailTitleEl.textContent = title;
    if (detailBackdrop) {
      detailBackdrop.classList.add('is-open');
      detailBackdrop.setAttribute('aria-hidden', 'false');
    }
    if (detailDialog) {
      detailDialog.classList.add('is-open');
      detailDialog.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
    if (detailCloseBtn) detailCloseBtn.focus();
  }

  if (detailCloseBtn) detailCloseBtn.addEventListener('click', closeDetailDialog);
  if (detailBackdrop) detailBackdrop.addEventListener('click', closeDetailDialog);

  var statsGrid = document.getElementById('tracking-stats-grid');
  var editComplicationsBtn = document.getElementById('tracking-edit-complications');

  function setGridEditMode(on) {
    if (statsGrid) statsGrid.classList.toggle('tracking-grid--edit-active', on);
    if (statsGrid) {
      statsGrid.querySelectorAll('[data-grid-card-id]').forEach(function (card) {
        card.draggable = !!on;
      });
    }
    if (editComplicationsBtn) {
      editComplicationsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      editComplicationsBtn.textContent = on ? 'Done' : 'Edit complications';
    }
  }

  if (editComplicationsBtn) {
    editComplicationsBtn.addEventListener('click', function () {
      var next = !statsGrid || !statsGrid.classList.contains('tracking-grid--edit-active');
      setGridEditMode(next);
    });
  }
  setGridEditMode(false);

  function applySavedGridOrder() {
    var grid = document.getElementById('tracking-stats-grid');
    if (!grid) return;
    var raw = localStorage.getItem(GRID_ORDER_KEY);
    var order = DEFAULT_CARD_ORDER.slice();
    try {
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          var seen = {};
          order = [];
          parsed.forEach(function (id) {
            if (
              DEFAULT_CARD_ORDER.indexOf(id) !== -1 &&
              DEPRECATED_GRID_CARD_IDS.indexOf(id) === -1 &&
              !seen[id]
            ) {
              seen[id] = true;
              order.push(id);
            }
          });
          DEFAULT_CARD_ORDER.forEach(function (id) {
            if (!seen[id]) order.push(id);
          });
        }
      }
    } catch (err) {}
    order.forEach(function (id) {
      var el = grid.querySelector('[data-grid-card-id="' + id + '"]');
      if (el) grid.appendChild(el);
    });
  }

  function saveGridOrder() {
    var grid = document.getElementById('tracking-stats-grid');
    if (!grid) return;
    var ids = [];
    grid.querySelectorAll('[data-grid-card-id]').forEach(function (el) {
      ids.push(el.getAttribute('data-grid-card-id'));
    });
    try {
      localStorage.setItem(GRID_ORDER_KEY, JSON.stringify(ids));
    } catch (err) {}
  }

  function initGridDragDrop() {
    var grid = document.getElementById('tracking-stats-grid');
    if (!grid) return;
    var draggedCard = null;

    grid.querySelectorAll('[data-grid-card-id]').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        if (!grid.classList.contains('tracking-grid--edit-active')) {
          e.preventDefault();
          return;
        }
        draggedCard = card;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-grid-card-id'));
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', function () {
        draggedCard = null;
        card.classList.remove('is-dragging');
      });
    });

    grid.addEventListener('dragover', function (e) {
      if (!grid.classList.contains('tracking-grid--edit-active') || !draggedCard) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    grid.addEventListener('drop', function (e) {
      e.preventDefault();
      if (!grid.classList.contains('tracking-grid--edit-active') || !draggedCard) return;
      var target = e.target.closest('[data-grid-card-id]');
      if (!target || target === draggedCard) {
        saveGridOrder();
        return;
      }
      var rect = target.getBoundingClientRect();
      var before = e.clientY < rect.top + rect.height / 2;
      if (before) {
        grid.insertBefore(draggedCard, target);
      } else {
        grid.insertBefore(draggedCard, target.nextSibling);
      }
      saveGridOrder();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (prEditDialog && prEditDialog.classList.contains('is-open')) {
      closePrEditDialog();
      e.preventDefault();
      return;
    }
    if (woShareModal && woShareModal.classList.contains('is-open')) {
      closeWorkoutShareModal();
      e.preventDefault();
      return;
    }
    if (prShareModal && prShareModal.classList.contains('is-open')) {
      closePrShareModal();
      e.preventDefault();
      return;
    }
    if (detailDialog && detailDialog.classList.contains('is-open')) {
      closeDetailDialog();
      e.preventDefault();
    }
  });

  window.addEventListener('strongman:timeline-updated', function () {
    renderArchiveInline();
  });

  if (statsGrid) {
    statsGrid.addEventListener('click', function (e) {
      if (!tabLayout || tabLayout.getAttribute('data-active-panel') !== 'stats') return;
      if (statsGrid.classList.contains('tracking-grid--edit-active')) return;
      if (e.target.closest('.tracking-grid-drag-handle')) return;
      if (e.target.closest('.more-btn')) return;
      if (e.target.closest('select, label, .tracking-chart-select-label')) return;
      var card = e.target.closest('[data-complication-detail]');
      if (!card) return;
      e.preventDefault();
      openComplicationDetail(card.getAttribute('data-complication-detail'));
    });
  }

  document.querySelectorAll('[data-stats-range]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var r = btn.getAttribute('data-stats-range');
      document.querySelectorAll('[data-stats-range]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-stats-range') === r);
        b.classList.toggle('is-active', b.getAttribute('data-stats-range') === r);
        if (b.getAttribute('role') === 'option') {
          b.setAttribute('aria-selected', b.getAttribute('data-stats-range') === r ? 'true' : 'false');
        }
      });
      if (tabLayout) tabLayout.setAttribute('data-stats-range', r || 'month');
      var viewingValue = document.getElementById('tracking-viewing-value');
      if (viewingValue) viewingValue.textContent = shortPeriodLabel(r);
      syncStatsWhenLabels(r);
      var viewingMenu = document.getElementById('tracking-viewing-menu');
      var viewingBtn = document.getElementById('tracking-viewing-btn');
      if (viewingMenu) viewingMenu.hidden = true;
      if (viewingBtn) viewingBtn.setAttribute('aria-expanded', 'false');
      refreshTrackingUi();
    });
  });

  (function initViewingMenu() {
    var btn = document.getElementById('tracking-viewing-btn');
    var menu = document.getElementById('tracking-viewing-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    document.addEventListener('click', function () {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
  })();

  applySavedGridOrder();
  initGridDragDrop();

  function renderPhysiqueGallery() {
    var host = document.getElementById('tracking-physique-gallery');
    var empty = document.getElementById('tracking-physique-empty');
    if (!host) return;
    host.innerHTML = '';
    var sessions = WL ? WL.getSessions() : [];
    var flat = [];
    sessions.forEach(function (s) {
      (s.photos || []).forEach(function (p) {
        if (p && p.dataUrl) flat.push({ session: s, photo: p });
      });
    });
    flat.sort(function (a, b) {
      return (b.photo.createdAt || 0) - (a.photo.createdAt || 0);
    });
    if (empty) empty.hidden = flat.length > 0;
    flat.forEach(function (row) {
      var figure = document.createElement('figure');
      figure.className = 'tracking-physique-figure';
      var img = document.createElement('img');
      img.className = 'tracking-physique-img';
      img.src = row.photo.dataUrl;
      img.alt = 'Progress photo';
      img.loading = 'lazy';
      var cap = document.createElement('figcaption');
      cap.className = 'tracking-physique-caption';
      var bits = [];
      if (row.session.date) bits.push(row.session.date);
      if (row.session.title) bits.push(row.session.title);
      else if (row.session.splitName) bits.push(row.session.splitName);
      cap.textContent = bits.join(' · ') || 'Workout';
      figure.appendChild(img);
      figure.appendChild(cap);
      host.appendChild(figure);
    });
  }

  function fileToResizedDataUrl(file, maxDim, quality, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        var scale = Math.min(1, maxDim / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement('canvas');
        c.width = cw;
        c.height = ch;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          cb(null, c.toDataURL('image/jpeg', quality));
        } catch (err) {
          cb(err);
        }
      };
      img.onerror = function () {
        cb(new Error('image'));
      };
      img.src = fr.result;
    };
    fr.onerror = function () {
      cb(new Error('read'));
    };
    fr.readAsDataURL(file);
  }

  function handleWorkoutLogActionClick(e) {
    var storyBtn = e.target.closest && e.target.closest('.tracking-session-story-btn');
    if (storyBtn) {
      var sidStory = storyBtn.getAttribute('data-workout-story-for');
      if (!sidStory) return;
      e.preventDefault();
      e.stopPropagation();
      var sessStory = findTrackingSessionById(sidStory);
      if (sessStory) openWorkoutShareModal(sessStory);
      return;
    }
    var editBtn = e.target.closest && e.target.closest('.tracking-session-edit-btn');
    if (editBtn) {
      var sidEdit = editBtn.getAttribute('data-session-edit-for');
      if (!sidEdit) return;
      e.preventDefault();
      e.stopPropagation();
      var sessEdit = findTrackingSessionById(sidEdit);
      if (sessEdit) openWorkoutEditor(sessEdit);
      return;
    }
    var deleteBtn = e.target.closest && e.target.closest('.tracking-session-delete-btn');
    if (deleteBtn) {
      var sidDel = deleteBtn.getAttribute('data-session-delete-for');
      if (!sidDel) return;
      e.preventDefault();
      e.stopPropagation();
      var sessDel = findTrackingSessionById(sidDel);
      if (sessDel) deleteWorkoutSession(sessDel);
      return;
    }
    var openEl = e.target.closest && e.target.closest('[data-session-open]');
    if (openEl) {
      var sidOpen = openEl.getAttribute('data-session-open');
      if (!sidOpen) return;
      e.preventDefault();
      var sessOpen = findTrackingSessionById(sidOpen);
      if (sessOpen) openSessionDetail(sessOpen);
      return;
    }
    var prOpenEl = e.target.closest && e.target.closest('[data-pr-open]');
    if (prOpenEl && PR && typeof PR.getRecordById === 'function') {
      var pidOpen = prOpenEl.getAttribute('data-pr-open');
      if (!pidOpen) return;
      e.preventDefault();
      var recOpen = PR.getRecordById(pidOpen);
      if (recOpen) openPrEditDialog(recOpen);
      return;
    }
    var tlEditEl = e.target.closest && e.target.closest('[data-tl-edit]');
    if (tlEditEl && window.TrainingTimeline) {
      var tlEditId = tlEditEl.getAttribute('data-tl-edit');
      if (!tlEditId) return;
      e.preventDefault();
      e.stopPropagation();
      var foundEv = window.TrainingTimeline.loadCustomEvents().filter(function (item) {
        return item.id === tlEditId;
      })[0];
      if (foundEv) openTlEventDialog(foundEv);
      return;
    }
    var tlDeleteEl = e.target.closest && e.target.closest('[data-tl-delete]');
    if (tlDeleteEl && window.TrainingTimeline) {
      var tlDeleteId = tlDeleteEl.getAttribute('data-tl-delete');
      if (!tlDeleteId) return;
      e.preventDefault();
      e.stopPropagation();
      if (!window.confirm('Delete this timeline entry?')) return;
      window.TrainingTimeline.removeCustom(tlDeleteId);
      try {
        window.dispatchEvent(new CustomEvent('strongman:timeline-updated'));
      } catch (err) {}
      renderArchiveInline();
      return;
    }
    var rmPhotoBtn = e.target.closest && e.target.closest('.tracking-session-photo-remove');
    if (rmPhotoBtn && WL && typeof WL.updateSession === 'function') {
      var sidRm = rmPhotoBtn.getAttribute('data-session-photo-remove-for');
      var pid = rmPhotoBtn.getAttribute('data-photo-id');
      var pidx = rmPhotoBtn.getAttribute('data-photo-index');
      if (!sidRm) return;
      e.preventDefault();
      if (!window.confirm('Detach this photo from the workout?')) return;
      WL.updateSession(sidRm, function (sess) {
        var photos = sess.photos || [];
        if (pid) {
          sess.photos = photos.filter(function (x) {
            return x && x.id !== pid;
          });
        } else if (pidx != null && pidx !== '') {
          var ix = parseInt(pidx, 10);
          if (!isNaN(ix) && ix >= 0 && ix < photos.length) {
            photos.splice(ix, 1);
            sess.photos = photos;
          }
        }
      });
      refreshTrackingUi();
    }
  }

  if (archiveScroll) {
    archiveScroll.addEventListener('click', handleWorkoutLogActionClick);
  }
  if (detailBodyEl) {
    detailBodyEl.addEventListener('click', handleWorkoutLogActionClick);
  }


  function refreshTrackingUi() {
    var range = getStatsRange();
    var sessions = WL ? WL.getSessions() : [];
    var filtered = filterSessionsByRange(sessions, range);
    var records = PR ? PR.getRecords() : [];
    updateStatTilesFromSessions(filtered, records, range);
    var chartSessions = range === 'all' ? sessions : filtered;
    var hist = buildChartData(chartSessions, range);
    updateStrengthOverview(chartSessions, hist.labels, range);
    updateVolumeChartFromSessions(chartSessions, range);
    updatePeakChartFromSessions(chartSessions, range);
    updateE1rmChartFromSessions(chartSessions, range);
    updateCompareChartFromSessions(chartSessions, range);
    updateTrainingChartFromSessions(chartSessions, range);
    updateIntensityChartFromSessions(chartSessions, range);
    updateRangeHint(range);
    var hint = document.getElementById('tracking-stats-range-hint');
    if (hint) {
      var label = range === 'year' ? 'this calendar year' : range === 'all' ? 'all time' : 'this month';
      hint.innerHTML =
        'Showing <strong>' +
        label +
        '</strong> — charts use logged sets, reps &amp; weight.';
    }
    requestAnimationFrame(function () {
      resizeStatsCharts();
    });
    renderArchiveInline();
    renderPhysiqueGallery();
    if (typeof renderPrCard === 'function') {
      try {
        renderPrCard();
      } catch (ePr) {}
    }
    renderPrArchiveList();
  }

  refreshTrackingUi();
  window.addEventListener('resize', function () {
    resizeStatsCharts();
  });
  if (window.TrainingSync && typeof window.TrainingSync.syncAll === 'function') {
    window.TrainingSync.syncAll({ callback: function () { refreshTrackingUi(); } });
  } else {
    var WL = window.WorkoutLog;
    var PR = window.PRLog;
    if (WL && typeof WL.syncFromServer === 'function') {
      WL.syncFromServer(function () {
        if (PR && typeof PR.syncFromServer === 'function') {
          PR.syncFromServer(function () {
            refreshTrackingUi();
          });
        } else {
          refreshTrackingUi();
        }
      });
    } else if (PR && typeof PR.syncFromServer === 'function') {
      PR.syncFromServer(function () {
        refreshTrackingUi();
      });
    }
  }

  window.addEventListener('strongman:training-synced', function () {
    refreshTrackingUi();
  });
})();
