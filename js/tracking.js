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
    tabLayout.setAttribute('data-active-panel', panelKey);
    var panelMap = {
      stats: document.getElementById('tracking-panel-stats'),
      archive: document.getElementById('tracking-panel-archive'),
      prs: document.getElementById('tracking-panel-pr')
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
    if (panelKey === 'prs') {
      renderPrArchiveList();
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
      setActivePanel(key);
      var hashMap = { stats: '#stats', archive: '#archive', prs: '#prs' };
      if (hashMap[key] && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search + hashMap[key]);
      }
    });
  });

  var WL = window.WorkoutLog;
  var PR = window.PRLog;
  var statsChartInstance = null;
  var intensityChartInstance = null;

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

  function dateMatchesRange(ymd, range) {
    if (range === 'all') return true;
    var dt = parseYmd(ymd);
    if (!dt) return false;
    var now = new Date();
    if (range === 'year') return dt.getFullYear() === now.getFullYear();
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
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
    var now = new Date();
    if (range === 'month') {
      return '(' + now.toLocaleString(undefined, { month: 'long', year: 'numeric' }) + ')';
    }
    if (range === 'year') {
      return '(' + now.getFullYear() + ')';
    }
    return '(All time)';
  }

  function updateRangeHint(range) {
    var el = document.getElementById('tracking-stats-range-hint');
    if (!el) return;
    var label = range === 'year' ? 'this calendar year' : range === 'all' ? 'all time' : 'this month';
    el.innerHTML = 'Showing <strong>' + label + '</strong> — tap a tile for details.';
  }

  function updateSummaryStrip(sessions, records, range) {
    var wEl = document.getElementById('tracking-summary-workouts');
    if (wEl) wEl.textContent = String((sessions || []).length);
    var setsEl = document.getElementById('tracking-summary-sets');
    if (setsEl) setsEl.textContent = String(countSetsInSessions(sessions));
    var intEl = document.getElementById('tracking-summary-intensity');
    var intLab = document.getElementById('tracking-summary-intensity-label');
    var ai = avgIntensityForSessions(sessions);
    if (intEl) {
      intEl.textContent = ai == null ? '—' : String(ai);
    }
    if (intLab) {
      intLab.textContent =
        ai != null && WL && typeof WL.intensityLabel === 'function'
          ? 'Your session scores (self-reported)'
          : 'Session average';
    }
    var prEl = document.getElementById('tracking-summary-prs');
    if (prEl) prEl.textContent = String(countPrsInRange(records || [], range));
    var cardEl = document.getElementById('tracking-summary-cardio');
    if (cardEl) {
      var cm = sumCardioMinutesInSessions(sessions);
      cardEl.textContent = cm >= 120 ? Math.round(cm / 60) + ' h' : String(cm) + ' min';
    }
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
    var now = new Date();
    if (range === 'month') {
      return 'By day · ' + now.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    }
    if (range === 'year') return 'By month · ' + now.getFullYear();
    return 'By calendar year';
  }

  function updateChartMeta(hist, range) {
    var subEl = document.getElementById('tracking-chart-card-sub');
    if (subEl) subEl.textContent = getChartSubline(range);
    var capEl = document.getElementById('tracking-chart-caption');
    if (!capEl) return;
    var total = 0;
    var peak = 0;
    var peakIdx = -1;
    hist.counts.forEach(function (n, i) {
      total += n;
      if (n > peak) {
        peak = n;
        peakIdx = i;
      }
    });
    if (total === 0) {
      capEl.textContent = 'No sessions in this view yet. Log a workout from Create.';
      return;
    }
    var peakLabel = peakIdx >= 0 ? hist.labels[peakIdx] : '';
    var peakPart = '';
    if (range === 'month') {
      peakPart = peak > 0 ? 'Busiest day: ' + peakLabel + ' (' + peak + ').' : '';
    } else if (range === 'year') {
      peakPart = peak > 0 ? 'Busiest month: ' + peakLabel + ' (' + peak + ').' : '';
    } else {
      peakPart = peak > 0 ? 'Peak year: ' + peakLabel + ' (' + peak + ' sessions).' : '';
    }
    capEl.textContent = (peakPart ? peakPart + ' ' : '') + 'Total: ' + total + ' workout' + (total === 1 ? '' : 's') + ' in view.';
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
    if (!statsChartInstance) return;
    var r = range || getStatsRange();
    var hist = buildChartData(sessions, r);
    statsChartInstance.data.labels = hist.labels;
    statsChartInstance.data.datasets[0].data = hist.counts;
    var maxC = 0;
    hist.counts.forEach(function (n) {
      if (n > maxC) maxC = n;
    });
    var suggested = Math.max(5, Math.ceil(maxC * 1.15));
    if (statsChartInstance.options.scales && statsChartInstance.options.scales.y) {
      statsChartInstance.options.scales.y.max = suggested;
      statsChartInstance.options.scales.y.ticks.stepSize = suggested <= 10 ? 1 : Math.ceil(suggested / 5);
    }
    if (statsChartInstance.options.scales && statsChartInstance.options.scales.x) {
      if (!statsChartInstance.options.scales.x.ticks) {
        statsChartInstance.options.scales.x.ticks = {};
      }
      statsChartInstance.options.scales.x.ticks.maxTicksLimit = r === 'month' ? 12 : r === 'year' ? 12 : 16;
    }
    statsChartInstance.update();
    updateChartMeta(hist, r);
  }

  function updateIntensityChartCaption(pack, range) {
    var cap = document.getElementById('tracking-intensity-chart-caption');
    if (!cap) return;
    var any = false;
    (pack.data || []).forEach(function (x) {
      if (x != null) any = true;
    });
    if (!any) {
      cap.textContent =
        'No self-reported session intensity in this view. Set 0–100 on Create when you log a workout.';
      return;
    }
    var unit = range === 'month' ? 'day' : range === 'year' ? 'month' : 'year';
    cap.textContent =
      'Average of your session intensity scores per ' + unit + ' (buckets with at least one scored workout).';
  }

  function updateIntensityChartFromSessions(sessions, range) {
    if (!intensityChartInstance) return;
    var r = range || getStatsRange();
    var pack = buildIntensityChartData(sessions, r);
    intensityChartInstance.data.labels = pack.labels;
    intensityChartInstance.data.datasets[0].data = pack.data;
    var sub = document.getElementById('tracking-intensity-chart-sub');
    if (sub) sub.textContent = getChartSubline(r);
    var maxY = 5;
    var has = false;
    (pack.data || []).forEach(function (v) {
      if (v != null) {
        has = true;
        if (v > maxY) maxY = v;
      }
    });
    if (has) maxY = Math.min(100, Math.max(5, Math.ceil(maxY * 1.1)));
    if (intensityChartInstance.options.scales && intensityChartInstance.options.scales.y) {
      intensityChartInstance.options.scales.y.max = maxY;
    }
    if (intensityChartInstance.options.scales && intensityChartInstance.options.scales.x) {
      if (!intensityChartInstance.options.scales.x.ticks) {
        intensityChartInstance.options.scales.x.ticks = {};
      }
      intensityChartInstance.options.scales.x.ticks.maxTicksLimit = r === 'month' ? 12 : r === 'year' ? 12 : 16;
    }
    intensityChartInstance.update();
    updateIntensityChartCaption(pack, r);
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
    var ctx = canvas.getContext('2d');
    var fillGradient = ctx.createLinearGradient(0, 0, 0, 220);
    fillGradient.addColorStop(0, 'rgba(255, 140, 0, 0.22)');
    fillGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

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
            borderColor: '#ff8c00',
            borderWidth: 2,
            pointBackgroundColor: '#ff8c00',
            pointBorderColor: '#141414',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.35,
            fill: true,
            backgroundColor: fillGradient
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: {
              color: '#aaa',
              maxTicksLimit: 12,
              font: { family: '"DM Sans", system-ui, sans-serif', size: 10 }
            }
          },
          y: {
            min: 0,
            max: yMax,
            grid: { color: 'rgba(255,255,255,0.08)', drawBorder: false },
            ticks: {
              stepSize: yMax <= 10 ? 1 : Math.ceil(yMax / 5),
              color: '#aaa',
              font: { family: '"DM Sans", system-ui, sans-serif', size: 10 }
            }
          }
        }
      }
    });
    updateChartMeta(hist0, 'month');
  }

  var intensityCanvas = document.getElementById('trackingIntensityChart');
  if (intensityCanvas && typeof Chart !== 'undefined') {
    var iPack = buildIntensityChartData(filterSessionsByRange(WL ? WL.getSessions() : [], 'month'), 'month');
    var iCtx = intensityCanvas.getContext('2d');
    var iGrad = iCtx.createLinearGradient(0, 0, 0, 220);
    iGrad.addColorStop(0, 'rgba(200, 200, 200, 0.15)');
    iGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
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
            borderColor: 'rgba(255, 255, 255, 0.85)',
            borderWidth: 2,
            pointBackgroundColor: '#ff8c00',
            pointBorderColor: '#141414',
            pointBorderWidth: 2,
            pointRadius: 3,
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
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: {
              color: '#aaa',
              maxTicksLimit: 12,
              font: { family: '"DM Sans", system-ui, sans-serif', size: 10 }
            }
          },
          y: {
            min: 0,
            max: iMax,
            grid: { color: 'rgba(255,255,255,0.08)', drawBorder: false },
            ticks: {
              stepSize: iMax <= 10 ? 1 : Math.ceil(iMax / 5),
              color: '#aaa',
              font: { family: '"DM Sans", system-ui, sans-serif', size: 10 }
            }
          }
        }
      }
    });
    var iSub = document.getElementById('tracking-intensity-chart-sub');
    if (iSub) iSub.textContent = getChartSubline('month');
    updateIntensityChartCaption(iPack, 'month');
  }
  var GRID_ORDER_KEY = 'tracking_grid_card_order_v1';
  var DEFAULT_CARD_ORDER = ['chart', 'intensity-chart', 'calendar', 'sets', 'pr'];
  var DEPRECATED_GRID_CARD_IDS = ['calories', 'hours', 'wins'];

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
  var prArchiveList = document.getElementById('tracking-pr-archive-list');
  var prArchiveEmpty = document.getElementById('tracking-pr-archive-empty');

  var detailBackdrop = document.getElementById('tracking-detail-backdrop');
  var detailDialog = document.getElementById('tracking-detail-dialog');
  var detailTitleEl = document.getElementById('tracking-detail-title');
  var detailBodyEl = document.getElementById('tracking-detail-body');
  var detailCloseBtn = document.getElementById('tracking-detail-close');

  var prForm = document.getElementById('tracking-pr-form');
  var prDatetime = document.getElementById('tracking-pr-datetime');
  var prMessage = document.getElementById('tracking-pr-message');
  var prError = document.getElementById('tracking-pr-error');
  var prListMain = document.getElementById('tracking-pr-list-main');
  var prListMore = document.getElementById('tracking-pr-list-more');
  var prCardEmpty = document.getElementById('tracking-pr-card-empty');
  var prCardEl = document.querySelector('.card[data-grid-card-id="pr"]');

  var panelRunning = document.getElementById('tracking-pr-panel-running');
  var panelSwimming = document.getElementById('tracking-pr-panel-swimming');
  var panelWl = document.getElementById('tracking-pr-panel-weightlifting');

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

  if (prDatetime && !prDatetime.value) {
    prDatetime.value = defaultDatetimeLocal();
  }

  function syncPrDisciplinePanels() {
    var d = document.querySelector('input[name="tracking-pr-discipline"]:checked');
    var v = d ? d.value : 'running';
    if (panelRunning) panelRunning.hidden = v !== 'running';
    if (panelSwimming) panelSwimming.hidden = v !== 'swimming';
    if (panelWl) panelWl.hidden = v !== 'weightlifting';
  }

  document.querySelectorAll('input[name="tracking-pr-discipline"]').forEach(function (r) {
    r.addEventListener('change', syncPrDisciplinePanels);
  });
  syncPrDisciplinePanels();

  function setPrFormMessage(msg, isError) {
    if (prMessage) {
      prMessage.textContent = msg;
      prMessage.hidden = !msg || !!isError;
    }
    if (prError) {
      prError.textContent = isError ? msg : '';
      prError.hidden = !isError;
    }
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

  if (prForm && PR) {
    prForm.addEventListener('submit', function (e) {
      e.preventDefault();
      setPrFormMessage('', false);
      var dt = prDatetime && prDatetime.value;
      if (!dt) {
        setPrFormMessage('Pick a date and time.', true);
        return;
      }
      var parts = dt.split('T');
      var datePart = parts[0] || '';
      var timePart = parts[1] || '';
      var disc = document.querySelector('input[name="tracking-pr-discipline"]:checked');
      var discipline = disc ? disc.value : 'running';
      var notes = (document.getElementById('tracking-pr-notes') || {}).value;
      notes = (notes || '').trim();

      var eventLabel = '';
      var valueDisplay = '';

      if (discipline === 'running') {
        eventLabel = (document.getElementById('tracking-pr-run-event') || {}).value.trim();
        var rm = (document.getElementById('tracking-pr-run-min') || {}).value;
        var rs = (document.getElementById('tracking-pr-run-sec') || {}).value;
        if (!eventLabel) {
          setPrFormMessage('Enter an event or distance for running.', true);
          return;
        }
        valueDisplay = formatDurationParts(rm, rs);
        if (!valueDisplay || valueDisplay === '0s') {
          setPrFormMessage('Enter a time greater than zero.', true);
          return;
        }
      } else if (discipline === 'swimming') {
        var swimEv = (document.getElementById('tracking-pr-swim-event') || {}).value.trim();
        var course = (document.getElementById('tracking-pr-swim-course') || {}).value;
        var sm = (document.getElementById('tracking-pr-swim-min') || {}).value;
        var ss = (document.getElementById('tracking-pr-swim-sec') || {}).value;
        if (!swimEv) {
          setPrFormMessage('Enter a swimming event.', true);
          return;
        }
        valueDisplay = formatDurationParts(sm, ss);
        if (!valueDisplay || valueDisplay === '0s') {
          setPrFormMessage('Enter a time greater than zero.', true);
          return;
        }
        eventLabel = swimEv + (course ? ' (' + course + ')' : '');
      } else {
        var lift = (document.getElementById('tracking-pr-wl-lift') || {}).value.trim();
        var w = parseFloat((document.getElementById('tracking-pr-wl-weight') || {}).value);
        var unit = (document.getElementById('tracking-pr-wl-unit') || {}).value || 'lb';
        var repsVal = (document.getElementById('tracking-pr-wl-reps') || {}).value;
        var reps = parseInt(repsVal, 10);
        if (!lift) {
          setPrFormMessage('Enter the lift name.', true);
          return;
        }
        if (isNaN(w) || w <= 0) {
          setPrFormMessage('Enter a valid weight.', true);
          return;
        }
        eventLabel = lift;
        valueDisplay = w + ' ' + unit;
        if (!isNaN(reps) && reps > 1) valueDisplay += ' × ' + reps;
      }

      var record = {
        discipline: discipline,
        sport: discipline,
        eventLabel: eventLabel,
        valueDisplay: valueDisplay,
        notes: notes,
        date: datePart,
        time: timePart
      };

      if (discipline === 'running') {
        var runParts =
          window.TimedEventFields && window.TimedEventFields.parseRunningEvent
            ? window.TimedEventFields.parseRunningEvent(eventLabel)
            : { distance: eventLabel, event: eventLabel };
        record.distance = runParts.distance;
        record.event = runParts.event;
      } else if (discipline === 'swimming') {
        var swimParts =
          window.TimedEventFields && window.TimedEventFields.parseSwimmingEvent
            ? window.TimedEventFields.parseSwimmingEvent(
                (document.getElementById('tracking-pr-swim-event') || {}).value.trim()
              )
            : { distance: '', event: '' };
        record.distance = swimParts.distance;
        record.event = swimParts.event;
        var courseVal = (document.getElementById('tracking-pr-swim-course') || {}).value;
        if (courseVal) record.course = courseVal;
      }

      if (
        window.TimedEventFields &&
        typeof window.TimedEventFields.parseTimeDisplaySeconds === 'function'
      ) {
        var valueSeconds = window.TimedEventFields.parseTimeDisplaySeconds(valueDisplay);
        if (valueSeconds != null) record.valueSeconds = valueSeconds;
      }

      PR.addRecord(record);
      setPrFormMessage('Personal record saved.', false);
      prForm.reset();
      document.getElementById('tracking-pr-disc-running').checked = true;
      syncPrDisciplinePanels();
      if (prDatetime) prDatetime.value = defaultDatetimeLocal();
      renderPrCard();
      renderPrArchiveList();
      refreshTrackingUi();

      lastSharePr = JSON.parse(JSON.stringify(record));
      openPrShareModal();
    });
  }

  var lastSharePr = null;
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
        ctx.fillStyle = '#ff8c00';
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
        ctx.fillStyle = '#ff8c00';
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

  function sessionMatchesSearch(s, q) {
    if (!q) return true;
    var needle = q.toLowerCase().trim();
    if (!needle) return true;
    var bits = [
      sessionDisplayTitle(s),
      sessionMetaLine(s),
      s.splitName || '',
      s.notes || '',
      s.title || ''
    ];
    (s.exercises || []).forEach(function (ex) {
      bits.push(ex.name || '');
      bits.push(ex.blockName || '');
    });
    return bits.join(' ').toLowerCase().indexOf(needle) !== -1;
  }

  function getArchiveSessions() {
    if (!WL) return [];
    var all = WL.getSessions();
    if (!archiveSearchQuery) return all;
    return all.filter(function (s) {
      return sessionMatchesSearch(s, archiveSearchQuery);
    });
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

  function getArchiveView() {
    var v = localStorage.getItem(ARCHIVE_VIEW_KEY);
    if (v === 'map') v = 'list';
    return ['list', 'blocks', 'timeline', 'table'].indexOf(v) !== -1 ? v : 'list';
  }

  function setArchiveView(view) {
    if (['list', 'blocks', 'timeline', 'table'].indexOf(view) === -1) return;
    localStorage.setItem(ARCHIVE_VIEW_KEY, view);
    if (archiveScroll) archiveScroll.setAttribute('data-archive-view', view);
    archiveViewBtns.forEach(function (btn) {
      var on = btn.getAttribute('data-archive-view') === view;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderArchiveInline();
  }

  archiveViewBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setArchiveView(btn.getAttribute('data-archive-view'));
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
    return (s.exercises || []).length;
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

  function buildArchiveTimeline(sessions) {
    var wrap = document.createElement('ol');
    wrap.className = 'dash-archive-timeline';
    var byMonth = {};
    sessions.forEach(function (s) {
      if (!s.date) return;
      var p = String(s.date).split('-');
      if (p.length < 2) return;
      var key = p[0] + '-' + p[1];
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(s);
    });
    Object.keys(byMonth)
      .sort(function (a, b) {
        return b.localeCompare(a);
      })
      .forEach(function (key) {
        var parts = key.split('-');
        var y = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var monthLi = document.createElement('li');
        monthLi.className = 'dash-archive-timeline-month';
        var label = document.createElement('h3');
        label.className = 'dash-archive-timeline-month-label';
        label.textContent = monthYearLabel(y, m);
        monthLi.appendChild(label);
        byMonth[key].forEach(function (s) {
          var row = document.createElement('button');
          row.type = 'button';
          row.className = 'dash-archive-timeline-row';
          row.setAttribute('data-session-open', s.id || '');
          var day = document.createElement('span');
          day.className = 'dash-archive-timeline-day';
          day.textContent = s.date ? String(s.date).split('-')[2] || '—' : '—';
          var body = document.createElement('span');
          body.textContent = sessionDisplayTitle(s) + (s.time ? ' · ' + formatTimeDisplay(s.time) : '');
          row.appendChild(day);
          row.appendChild(body);
          monthLi.appendChild(row);
        });
        wrap.appendChild(monthLi);
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
    if (!archiveViewRoot || !WL) return;
    var view = getArchiveView();
    var allSessions = WL.getSessions();
    var sessions = getArchiveSessions();
    archiveViewRoot.innerHTML = '';
    updateArchiveSummary(allSessions, sessions);
    var hasAny = allSessions.length > 0;
    var hasMatches = sessions.length > 0;
    if (archiveInlineEmpty) {
      archiveInlineEmpty.hidden = hasAny;
    }
    if (archiveSearchEmpty) {
      archiveSearchEmpty.hidden = !hasAny || hasMatches || !archiveSearchQuery;
    }
    if (!hasMatches) return;
    if (view === 'list') {
      var ul = document.createElement('ul');
      ul.className = 'dash-archive-list';
      ul.setAttribute('aria-label', 'All logged workouts');
      sessions.forEach(function (s) {
        ul.appendChild(buildSessionLi(s));
      });
      archiveViewRoot.appendChild(ul);
    } else if (view === 'blocks') {
      var grid = document.createElement('ul');
      grid.className = 'dash-archive-blocks-grid';
      grid.setAttribute('aria-label', 'Workouts as blocks');
      sessions.forEach(function (s) {
        grid.appendChild(buildSessionBlockCard(s));
      });
      archiveViewRoot.appendChild(grid);
    } else if (view === 'timeline') {
      archiveViewRoot.appendChild(buildArchiveTimeline(sessions));
    } else if (view === 'table') {
      archiveViewRoot.appendChild(buildArchiveTable(sessions));
    }
  }

  function buildPrArchiveLi(rec) {
    var li = document.createElement('li');
    li.className = 'tracking-saved-item tracking-pr-archive-item';
    var head = document.createElement('div');
    head.className = 'tracking-saved-item-head';
    head.textContent = rec.eventLabel || 'Personal best';
    var meta = document.createElement('div');
    meta.className = 'tracking-saved-item-meta';
    var bits = [];
    if (rec.date) bits.push(rec.date);
    if (rec.time) bits.push(formatTimeDisplay(rec.time));
    if (PR) bits.push(PR.disciplineLabel(rec.discipline));
    meta.textContent = bits.join(' · ');
    var result = document.createElement('div');
    result.className = 'tracking-pr-archive-result';
    result.textContent = rec.valueDisplay || '—';
    var notes = (rec.notes || '').trim();
    li.appendChild(head);
    if (meta.textContent) li.appendChild(meta);
    li.appendChild(result);
    if (notes) {
      var foot = document.createElement('div');
      foot.className = 'tracking-saved-item-foot tracking-pr-archive-notes';
      foot.textContent = notes;
      li.appendChild(foot);
    }
    return li;
  }

  function renderPrArchiveList() {
    if (!prArchiveList || !PR) return;
    var records = PR.getRecords();
    prArchiveList.innerHTML = '';
    if (prArchiveEmpty) prArchiveEmpty.hidden = records.length > 0;
    records.forEach(function (rec) {
      prArchiveList.appendChild(buildPrArchiveLi(rec));
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
    if (key === 'chart') {
      title = 'Training volume trend';
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
        ' Same source as Create → Log workout when you’re signed in. Change the range above the grid to switch views.</p>';
    } else if (key === 'intensity-chart') {
      title = 'Session intensity trend';
      var r2 = getStatsRange();
      var bucket =
        r2 === 'year' ? 'month of this year' : r2 === 'all' ? 'calendar year' : 'day of this month';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Each point is the <strong>average of your self-reported session intensity</strong> (0–100 from Create) for that ' +
        bucket +
        '. Nothing here is inferred from sets, reps, or weight.</p>';
    } else if (key === 'calendar') {
      title = 'Consistency calendar';
      var d = document.getElementById('tracking-stat-days');
      var n = d ? d.textContent.trim() : '—';
      var r = getStatsRange();
      var scope = r === 'all' ? 'all time' : r === 'year' ? 'this calendar year' : 'this calendar month';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Distinct days with at least one logged workout in <strong>' +
        scope +
        '</strong>.</p><p class="tracking-detail-p"><strong>' +
        n +
        '</strong> days</p>';
    } else if (key === 'sets') {
      title = 'Sets logged';
      var setsEl = document.getElementById('tracking-stat-sets');
      var sv = setsEl ? setsEl.textContent.trim() : '—';
      var r = getStatsRange();
      var scope = r === 'all' ? 'all time' : r === 'year' ? 'this calendar year' : 'this calendar month';
      detailBodyEl.innerHTML =
        '<p class="tracking-detail-p">Total strength sets from exercises you logged on Create in <strong>' +
        scope +
        '</strong>. Each exercise line counts its set count; if missing, one set is assumed.</p><p class="tracking-detail-p">Current display: <strong>' +
        sv +
        '</strong> sets</p>';
    } else if (key === 'pr') {
      title = 'Personal records summary';
      var records = PR ? PR.getRecords() : [];
      if (!records.length) {
        detailBodyEl.innerHTML =
          '<p class="tracking-detail-p">No PRs saved yet. Use the <strong>Personal bests</strong> tab to log running, swimming, or strength bests.</p>';
      } else {
        var ul = document.createElement('ul');
        ul.className = 'tracking-detail-pr-list';
        records.slice(0, 12).forEach(function (rec) {
          var li = document.createElement('li');
          var bits = [];
          if (PR) bits.push(PR.disciplineLabel(rec.discipline));
          if (rec.eventLabel) bits.push(rec.eventLabel);
          if (rec.valueDisplay) bits.push(rec.valueDisplay);
          li.textContent = bits.join(' · ');
          ul.appendChild(li);
        });
        detailBodyEl.appendChild(ul);
        if (records.length > 12) {
          var more = document.createElement('p');
          more.className = 'tracking-detail-p';
          more.textContent = 'Showing 12 of ' + records.length + ' — expand the tile on Stats for more.';
          detailBodyEl.appendChild(more);
        }
      }
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

  if (statsGrid) {
    statsGrid.addEventListener('click', function (e) {
      if (!tabLayout || tabLayout.getAttribute('data-active-panel') !== 'stats') return;
      if (statsGrid.classList.contains('tracking-grid--edit-active')) return;
      if (e.target.closest('.tracking-grid-drag-handle')) return;
      if (e.target.closest('.more-btn')) return;
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
      });
      if (tabLayout) tabLayout.setAttribute('data-stats-range', r || 'month');
      refreshTrackingUi();
    });
  });

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

  if (archiveScroll) {
    archiveScroll.addEventListener('click', function (e) {
      var storyBtn = e.target.closest && e.target.closest('.tracking-session-story-btn');
      if (storyBtn) {
        var sidStory = storyBtn.getAttribute('data-workout-story-for');
        if (!sidStory) return;
        e.preventDefault();
        var sessStory = findTrackingSessionById(sidStory);
        if (sessStory) openWorkoutShareModal(sessStory);
        return;
      }
      var editBtn = e.target.closest && e.target.closest('.tracking-session-edit-btn');
      if (editBtn) {
        var sidEdit = editBtn.getAttribute('data-session-edit-for');
        if (!sidEdit) return;
        e.preventDefault();
        var sessEdit = findTrackingSessionById(sidEdit);
        if (sessEdit) openWorkoutEditor(sessEdit);
        return;
      }
      var deleteBtn = e.target.closest && e.target.closest('.tracking-session-delete-btn');
      if (deleteBtn) {
        var sidDel = deleteBtn.getAttribute('data-session-delete-for');
        if (!sidDel) return;
        e.preventDefault();
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
        return;
      }
    });
  }


  function refreshTrackingUi() {
    var range = getStatsRange();
    var sessions = WL ? WL.getSessions() : [];
    var filtered = filterSessionsByRange(sessions, range);
    var records = PR ? PR.getRecords() : [];
    updateStatTilesFromSessions(filtered, records, range);
    var chartSessions = range === 'all' ? sessions : filtered;
    updateTrainingChartFromSessions(chartSessions, range);
    updateIntensityChartFromSessions(chartSessions, range);
    updateStatDaysFromSessions(filtered);
    updateSummaryStrip(filtered, records, range);
    updateRangeHint(range);
    renderArchiveInline();
    renderPhysiqueGallery();
    renderPrCard();
    renderPrArchiveList();
  }

  refreshTrackingUi();
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
