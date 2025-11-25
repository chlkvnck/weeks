/**
 * Weeks-only interactive chart logic with settings panel.
 */
(function () {
  var STORAGE_KEY = 'WeeksSettings';

  var settingsToggle = document.querySelector('.settings-toggle');
  var settingsOverlay = document.querySelector('.settings-overlay');
  var settingsPanel = document.querySelector('.settings-panel');
  var settingsForm = document.querySelector('.settings-form');
  var maxAgeInput = document.getElementById('maxAge');
  var cellColorInput = document.getElementById('cellColor');
  var dateInput = document.getElementById('dateInput');
  var viewTabs = document.querySelectorAll('.view-tab');
  var shapeInputs = document.querySelectorAll('input[name="cellShape"]');
  var drawingModeInput = document.getElementById('drawingMode');
  var periodLegendEl = document.querySelector('.period-legend');
  var periodTooltipEl = document.querySelector('.period-tooltip');
  var periodEditorOverlay = document.querySelector('.period-editor-overlay');
  var periodEditorForm = document.querySelector('.period-editor-form');
  var periodEditorTitle = document.querySelector('.period-editor-title');
  var periodEditorNameInput = document.getElementById('periodEditorName');
  var periodEditorColorInput = document.getElementById('periodEditorColor');
  var periodEditorSpansEl = document.querySelector('.period-editor-spans');
  var periodEditorAddSpanBtn = document.querySelector('.period-editor-add-span');
  var periodEditorDeleteBtn = document.querySelector('.period-editor-delete');
  var periodEditorCancelBtn = document.querySelector('.period-editor-cancel');

  var chartEl = document.querySelector('.chart');
  var titleViewEl = document.querySelector('.title-view');
  var progressCurrentEl = document.querySelector('.progress-current');
  var progressTotalEl = document.querySelector('.progress-total');
  var progressPercentEl = document.querySelector('.progress-percent');
  var xMarkersEl = chartEl.querySelector('.x-axis .markers');
  var yMarkersEl = chartEl.querySelector('.y-axis .markers');
  var periodsToggleInput = document.getElementById('periodsToggle');
  var lifeStatsEl = document.querySelector('.life-remaining');
  var remainingLifeValueEls = {
    years: document.querySelector('[data-remaining-unit="years"]'),
    months: document.querySelector('[data-remaining-unit="months"]'),
    weeks: document.querySelector('[data-remaining-unit="weeks"]'),
    days: document.querySelector('[data-remaining-unit="days"]'),
    hours: document.querySelector('[data-remaining-unit="hours"]'),
    minutes: document.querySelector('[data-remaining-unit="minutes"]'),
    seconds: document.querySelector('[data-remaining-unit="seconds"]')
  };

  var rootEl = document.documentElement;
  var items;
  var itemCount = 0;
  var COLOR = '#ff0000';
  var COLOR_NAME_MAP = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff'
  };
  var DAY_MS = 24 * 60 * 60 * 1000;
  var WHITE_RGB = { r: 255, g: 255, b: 255 };
  var BLACK_RGB = { r: 0, g: 0, b: 0 };
  var DEFAULT_DOB = '2000-01-01';
  var MONTHS_IN_YEAR = 12;
  var DAYS_IN_YEAR = 365.25;
  var HOURS_IN_DAY = 24;
  var MINUTES_IN_HOUR = 60;
  var SECONDS_IN_MINUTE = 60;
  var WEEKS_IN_YEAR = DAYS_IN_YEAR / 7;

  var VIEW_CONFIGS = {
    weeks: {
      className: 'weeks',
      columns: 52,
      gap: '2px',
      rowYears: 1,
      columnStep: 1,
      items: function (maxAge) {
        return maxAge * 52;
      },
      xMarkers: [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
      getYMarkers: function (maxAge) {
        return [1].concat(_generateRange(5, maxAge, 5));
      }
    },
    months: {
      className: 'months',
      columns: 12,
      gap: '2px',
      lockCellAspect: false,
      matchRowHeight: true,
      matchBaseWidth: true,
      barFill: true,
      rowYears: 1,
      columnStep: 1,
      items: function (maxAge) {
        return maxAge * 12;
      },
      xMarkers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      getYMarkers: function (maxAge) {
        return [1].concat(_generateRange(5, maxAge, 5));
      }
    },
    years: {
      className: 'years',
      columns: 52,
      itemsPerRow: 1,
      gap: '2px',
      barFill: true,
      rowYears: 1,
      columnStep: 1,
      items: function (maxAge) {
        return maxAge;
      },
      xMarkers: [],
      getYMarkers: function (maxAge) {
        return [1].concat(_generateRange(5, maxAge, 5));
      }
    }
  };
  var VIEW_LABELS = {
    weeks: 'Weeks',
    months: 'Months',
    years: 'Years'
  };

  var settings = {
    dob: null,
    maxAge: 80,
    color: '#000000',
    view: 'weeks',
    cellShape: 'circle',
    drawingMode: false,
    showPeriods: false,
    periods: []
  };

  var isDrawingGesture = false;
  var lastDrawnCell = null;
  var gestureTouchedCells = new Set();
  var tooltipAutoHideId = null;
  var spanMetaById = {};
  var periodActiveState = Object.create(null);
  var legendLongPressTimer = null;
  var legendLongPressTarget = null;
  var suppressLegendToggle = false;
  var editorState = null;
  var deleteHoldTimer = null;
  var hasStoredSettings = false;

  function _normalizeColorValue(value) {
    if (!value) {
      return '#000000';
    }
    var color = value.trim();
    var hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      if (color.length === 4) {
        return '#' + color.slice(1).split('').map(function (char) {
          return char + char;
        }).join('');
      }
      return color;
    }
    var mapped = COLOR_NAME_MAP[color.toLowerCase()];
    return mapped || '#000000';
  }

  _loadSettings();
  _switchView(settings.view || 'weeks', { skipPersist: true });
  _handleDateChange();
  window.addEventListener('resize', _handleResize);

  settingsToggle.addEventListener('click', function () {
    settingsOverlay.classList.toggle('hidden');
  });
  settingsOverlay.addEventListener('click', function (evt) {
    if (evt.target === settingsOverlay) {
      settingsOverlay.classList.add('hidden');
    }
  });

  viewTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      _switchView(tab.dataset.view);
    });
  });
  shapeInputs.forEach(function (input) {
    input.addEventListener('change', function () {
      if (input.checked) {
        settings.cellShape = input.value;
        _applyShapeSetting();
        _persistSettings();
      }
    });
  });
  if (drawingModeInput) {
    drawingModeInput.addEventListener('change', function () {
      settings.drawingMode = drawingModeInput.checked;
      _applyDrawingMode();
      _persistSettings();
      settingsOverlay.classList.add('hidden');
    });
  }
  if (periodsToggleInput) {
    periodsToggleInput.addEventListener('change', function () {
      settings.showPeriods = periodsToggleInput.checked;
      _applyPeriodsEnabledState();
      _persistSettings();
    });
  }
  if (titleViewEl) {
    titleViewEl.addEventListener('click', function () {
      _cycleView();
    });
  }
  dateInput.addEventListener('change', _applySettings);
  maxAgeInput.addEventListener('change', _applySettings);
  cellColorInput.addEventListener('input', _applySettings);
  _setSettingsSection('data');
  chartEl.addEventListener('pointerdown', _handleDrawingPointerDown);
  chartEl.addEventListener('pointermove', _handleDrawingPointerMove);
  chartEl.addEventListener('pointerleave', _handleDrawingPointerUp);
  chartEl.addEventListener('pointerenter', _handleDrawingPointerMove);
  window.addEventListener('pointerup', _handleDrawingPointerUp);
  chartEl.addEventListener('pointerover', _handlePeriodCellPointerOver);
  chartEl.addEventListener('pointerout', _handlePeriodCellPointerOut);
  chartEl.addEventListener('pointerdown', _handlePeriodCellPointerDown);
  window.addEventListener('pointerdown', function (evt) {
    if (settings.drawingMode) {
      return;
    }
    if (periodTooltipEl && periodTooltipEl.contains(evt.target)) {
      return;
    }
    var fromLegend = periodLegendEl && periodLegendEl.contains(evt.target);
    var cellTarget = evt.target.closest('li');
    var fromCell = chartEl && chartEl.contains(evt.target) &&
      cellTarget && cellTarget.dataset && cellTarget.dataset.spanIds;
    if (fromLegend || fromCell) {
      return;
    }
    _hidePeriodTooltip();
  });
  if (periodLegendEl) {
    periodLegendEl.addEventListener('click', _handleLegendClick);
    periodLegendEl.addEventListener('contextmenu', _handleLegendContextMenu);
    periodLegendEl.addEventListener('pointerdown', _handleLegendPointerDown);
    periodLegendEl.addEventListener('pointerup', _clearLegendLongPress);
    periodLegendEl.addEventListener('pointerleave', _clearLegendLongPress);
    periodLegendEl.addEventListener('pointercancel', _clearLegendLongPress);
  }
  if (periodEditorOverlay) {
    periodEditorOverlay.addEventListener('click', function (evt) {
      if (evt.target === periodEditorOverlay) {
        _closePeriodEditor();
      }
    });
  }
  if (periodEditorForm) {
    periodEditorForm.addEventListener('submit', function (evt) {
      evt.preventDefault();
      _savePeriodFromEditor();
    });
  }
  if (periodEditorAddSpanBtn) {
    periodEditorAddSpanBtn.addEventListener('click', function () {
      _addEditorSpan();
    });
  }
  if (periodEditorSpansEl) {
    periodEditorSpansEl.addEventListener('input', _handleEditorSpanInput);
    periodEditorSpansEl.addEventListener('change', _handleEditorSpanInput);
    periodEditorSpansEl.addEventListener('click', _handleEditorSpanClick);
  }
  if (periodEditorCancelBtn) {
    periodEditorCancelBtn.addEventListener('click', function () {
      _closePeriodEditor();
    });
  }
  if (periodEditorDeleteBtn) {
    periodEditorDeleteBtn.addEventListener('pointerdown', function (evt) {
      if (evt.pointerType === 'mouse' && evt.button !== 0) {
        return;
      }
      _startDeleteHold();
    });
    periodEditorDeleteBtn.addEventListener('pointerup', _cancelDeleteHold);
    periodEditorDeleteBtn.addEventListener('pointerleave', _cancelDeleteHold);
    periodEditorDeleteBtn.addEventListener('pointercancel', _cancelDeleteHold);
  }

  _handleInitialOverlayState();

  function _applySettings() {
    var dateValue = dateInput.value;
    if (dateValue) {
      var parsed = new Date(dateValue);
      settings.dob = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      settings.dob = null;
    }

    var maxAge = parseInt(maxAgeInput.value, 10);
    if (!isNaN(maxAge) && maxAge >= 10 && maxAge <= 120) {
      settings.maxAge = maxAge;
    }

    settings.color = _normalizeColorValue(cellColorInput.value || settings.color);
    var selectedShape = settingsForm.querySelector('input[name="cellShape"]:checked');
    if (selectedShape) {
      settings.cellShape = selectedShape.value;
    }
    if (drawingModeInput) {
      settings.drawingMode = drawingModeInput.checked;
    }
    if (periodsToggleInput) {
      settings.showPeriods = periodsToggleInput.checked;
    }
    COLOR = settings.color;
    _applyThemeColors();

    _persistSettings();

    _setupChart();
    _handleDateChange();
    _repaintItems(itemCount);
    _handleResize();
    _updateProgressDisplay();
    _updateDateInputHighlight();
  }

  function _handleInitialOverlayState() {
    _updateDateInputHighlight();
    if (!hasStoredSettings && settingsOverlay) {
      settingsOverlay.classList.remove('hidden');
    }
  }

  function _updateDateInputHighlight() {
    if (!dateInput) {
      return;
    }
    var value = dateInput.value || '';
    var highlight = !settings.dob || value === DEFAULT_DOB;
    dateInput.classList.toggle('needs-attention', highlight);
  }

  function _switchView(view, options) {
    if (!VIEW_CONFIGS[view]) {
      return;
    }
    settings.view = view;
    _setActiveTab(view);
    _updateViewLabel();
    if (!options || !options.skipPersist) {
      _persistSettings();
    }
    _setupChart();
    _handleDateChange();
    _handleResize();
    _updateProgressDisplay();
  }

  function _loadSettings() {
    var stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      stored = null;
    }
    hasStoredSettings = Boolean(stored);
    if (stored) {
      if (stored.dob) {
        var parsed = new Date(stored.dob);
        settings.dob = isNaN(parsed.getTime()) ? null : parsed;
      }
      if (stored.maxAge) {
        settings.maxAge = stored.maxAge;
      }
      if (stored.color) {
        settings.color = _normalizeColorValue(stored.color);
        COLOR = settings.color;
      } else {
        settings.color = _normalizeColorValue(settings.color);
        COLOR = settings.color;
      }
      if (stored.view) {
        settings.view = stored.view;
      }
      if (stored.cellShape) {
        settings.cellShape = stored.cellShape;
      }
      if (typeof stored.drawingMode === 'boolean') {
      settings.drawingMode = stored.drawingMode;
    }
    if (typeof stored.showPeriods === 'boolean') {
      settings.showPeriods = stored.showPeriods;
    }
    if (Array.isArray(stored.periods)) {
      settings.periods = stored.periods.map(_normalizeStoredPeriod);
    }
  }
  periodActiveState = Object.create(null);

    if (settings.dob) {
      dateInput.value = settings.dob.toISOString().slice(0, 10);
    }
    maxAgeInput.value = settings.maxAge;
    settings.color = _normalizeColorValue(settings.color);
    cellColorInput.value = settings.color;
    COLOR = settings.color;
    _applyThemeColors();
    _setActiveTab(settings.view);
    _updateViewLabel();
    settings.drawingMode = false;
  if (drawingModeInput) {
    drawingModeInput.checked = settings.drawingMode;
  }
  if (periodsToggleInput) {
    periodsToggleInput.checked = settings.showPeriods;
  }
  shapeInputs.forEach(function (input) {
    input.checked = input.value === settings.cellShape;
  });
    _applyDrawingMode();
    _applyPeriodsEnabledState();
    _updateProgressDisplay();
    _syncPeriodActiveState();
    _updateDateInputHighlight();
    _renderPeriodLegend();
  }

  function _handleDateChange() {
    if (_dateIsValid()) {
      itemCount = calculateElapsedUnits();
      _repaintItems(itemCount);
    } else {
      _repaintItems(0);
    }
    _updateProgressDisplay();
  }

  function _populateChartCells(count) {
    var existing = chartEl.querySelectorAll('li');
    var diff = count - existing.length;

    if (diff > 0) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < diff; i++) {
        frag.appendChild(document.createElement('li'));
      }
      chartEl.appendChild(frag);
    } else if (diff < 0) {
      for (var j = 0; j < Math.abs(diff); j++) {
        var lastCell = chartEl.querySelector('li:last-of-type');
        if (lastCell) {
          chartEl.removeChild(lastCell);
        }
      }
    }

    items = chartEl.querySelectorAll('li');
    _applyPeriodHighlights();
  }

  function _handleResize() {
    _applyLayout(_getViewConfig());
    _positionAxisMarkers();
    _positionXAxisMarkers();
    _updateProgressDisplay();
  }

  function _positionAxisMarkers() {
    var config = _getViewConfig();
    var maxAge = settings.maxAge;
    var rowYears = config.rowYears;
    var metrics = _getRowMetrics(chartEl);
    var rowStep = metrics.rowStep || chartEl.offsetHeight / Math.ceil(maxAge / rowYears);
    var firstCenter = metrics.firstCenter || rowStep / 2;

    Array.prototype.forEach.call(yMarkersEl.querySelectorAll('span'), function (span) {
      var value = parseFloat(span.dataset.value || span.textContent);
      if (isNaN(value)) {
        span.style.top = '';
        return;
      }
      var rowIndex = Math.floor(Math.max(value - 1, 0) / rowYears);
      span.style.bottom = '';
      span.style.top = firstCenter + rowIndex * rowStep + 'px';
      if (value >= maxAge) {
        span.classList.add('is-terminal');
      } else {
        span.classList.remove('is-terminal');
      }
    });
  }

  function _positionXAxisMarkers() {
    var config = _getViewConfig();
    var metrics = _getColumnMetrics(chartEl);
    if (!metrics.colStep) {
      return;
    }
    Array.prototype.forEach.call(xMarkersEl.querySelectorAll('span'), function (span) {
      var value = parseFloat(span.dataset.value || span.textContent);
      if (isNaN(value)) {
        return;
      }
      var columnIndex = (value / config.columnStep) - 1;
      span.style.left = metrics.firstCenter + columnIndex * metrics.colStep + 'px';
    });
  }

  function calculateElapsedUnits() {
    var dob = settings.dob;
    if (!dob) {
      return 0;
    }

    var currentDate = new Date();
    var config = _getViewConfig();

    if (settings.view === 'years') {
      return _calculateElapsedYears(dob, currentDate);
    } else if (settings.view === 'months') {
      return _calculateElapsedMonths(dob, currentDate);
    }

    return _calculateElapsedWeeks(dob, currentDate);
  }

  function _calculateElapsedYears(dob, current) {
    var years = current.getFullYear() - dob.getFullYear();
    var beforeBirthday =
      current.getMonth() < dob.getMonth() ||
      (current.getMonth() === dob.getMonth() && current.getDate() < dob.getDate());
    if (beforeBirthday) {
      years--;
    }
    return Math.max(0, years);
  }

  function _calculateElapsedMonths(dob, current) {
    var years = current.getFullYear() - dob.getFullYear();
    var months = current.getMonth() - dob.getMonth();
    var totalMonths = years * 12 + months;
    if (current.getDate() < dob.getDate()) {
      totalMonths--;
    }
    return Math.max(0, totalMonths);
  }

  function _calculateElapsedWeeks(dob, current) {
    var diff = current.getTime() - dob.getTime();
    var elapsedYears = new Date(diff).getUTCFullYear() - 1970;
    var isBirthdayPassed =
      current.getTime() >
      new Date(current.getUTCFullYear(), dob.getMonth(), dob.getDate()).getTime();
    var birthdayYearOffset = isBirthdayPassed ? 0 : 1;
    var dateOfLastBirthday = new Date(
      current.getUTCFullYear() - birthdayYearOffset,
      dob.getMonth(),
      dob.getDate()
    );
    var elapsedDaysSinceLastBirthday = Math.floor(
      (current.getTime() - dateOfLastBirthday.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, elapsedYears * 52 + Math.floor(elapsedDaysSinceLastBirthday / 7));
  }

  function _calculateCurrentMonthProgress(completedMonths) {
    var dob = settings.dob;
    if (!dob) {
      return 0;
    }
    var monthStart = _addMonths(dob, completedMonths);
    var monthEnd = _addMonths(monthStart, 1);
    var now = new Date();
    if (now.getTime() <= monthStart.getTime()) {
      return 0;
    }
    var total = monthEnd.getTime() - monthStart.getTime();
    if (total <= 0) {
      return 0;
    }
    var elapsed = Math.min(now.getTime() - monthStart.getTime(), total);
    return Math.max(0, Math.min(1, elapsed / total));
  }

  function _addMonths(date, count) {
    var year = date.getFullYear();
    var monthIndex = date.getMonth() + count;
    year += Math.floor(monthIndex / 12);
    monthIndex = ((monthIndex % 12) + 12) % 12;
    var day = Math.min(date.getDate(), _getDaysInMonth(year, monthIndex));
    return new Date(
      year,
      monthIndex,
      day,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
  }

  function _addDays(date, count) {
    return new Date(date.getTime() + count * DAY_MS);
  }

  function _addYears(date, count) {
    var year = date.getFullYear() + count;
    var month = date.getMonth();
    var day = Math.min(date.getDate(), _getDaysInMonth(year, month));
    return new Date(
      year,
      month,
      day,
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    );
  }

  function _generatePeriodId() {
    return 'period-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
  }

  function _generatePeriodSpanId() {
    return 'span-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
  }

  function _createPeriodSpan(template) {
    return {
      id: _generatePeriodSpanId(),
      startDate: template && template.startDate ? template.startDate : '',
      endDate: template && template.endDate ? template.endDate : ''
    };
  }

  function _getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function _getRowMetrics(chart) {
    var metrics = { rowStep: 0, firstCenter: 0 };
    var elements = chart.querySelectorAll('li');
    if (!elements.length) {
      return metrics;
    }
    var chartRect = chart.getBoundingClientRect();
    var firstRect = elements[0].getBoundingClientRect();
    var firstTop = firstRect.top - chartRect.top;
    metrics.firstCenter = firstTop + firstRect.height / 2;
    for (var i = 1; i < elements.length; i++) {
      var rect = elements[i].getBoundingClientRect();
      var diff = rect.top - firstRect.top;
      if (Math.abs(diff) > 0.5) {
        metrics.rowStep = diff;
        break;
      }
    }
    if (!metrics.rowStep) {
      metrics.rowStep = firstRect.height;
    }
    return metrics;
  }

  function _getColumnMetrics(chart) {
    var metrics = { colStep: 0, firstCenter: 0 };
    var elements = chart.querySelectorAll('li');
    if (!elements.length) {
      return metrics;
    }
    var chartRect = chart.getBoundingClientRect();
    var firstRect = elements[0].getBoundingClientRect();
    var rowTop = firstRect.top;
    metrics.firstCenter = firstRect.left - chartRect.left + firstRect.width / 2;
    for (var i = 1; i < elements.length; i++) {
      var rect = elements[i].getBoundingClientRect();
      if (Math.abs(rect.top - rowTop) < rect.height * 0.5) {
        metrics.colStep = rect.left - firstRect.left;
        break;
      }
    }
    if (!metrics.colStep) {
      metrics.colStep = firstRect.width;
    }
    return metrics;
  }

  function _dateIsValid() {
    return Boolean(settings.dob);
  }

  function _repaintItems(number) {
    if (!items) {
      return;
    }
    var config = _getViewConfig();
    var totalCells = config.items(settings.maxAge);
    var limit = Math.min(number, totalCells);
    var useBarFill = Boolean(config.barFill);
    var partialRatio = 0;

    if (useBarFill && _dateIsValid() && limit < totalCells) {
      if (settings.view === 'years') {
        var now = new Date();
        var totalWeeks = _calculateElapsedWeeks(settings.dob, now);
        var weeksIntoCurrentYear = totalWeeks - (limit * 52);
        if (weeksIntoCurrentYear > 0) {
          partialRatio = Math.min(1, weeksIntoCurrentYear / 52);
        }
      } else if (settings.view === 'months') {
        partialRatio = _calculateCurrentMonthProgress(limit);
      }
    }

    for (var i = 0; i < items.length; i++) {
      if (useBarFill) {
        var fillAmount = 0;
        if (i < limit) {
          fillAmount = 1;
        } else if (i === limit && partialRatio > 0) {
          fillAmount = partialRatio;
        }
        items[i].style.backgroundColor = '';
        items[i].style.setProperty('--fill-percent', fillAmount);
        items[i].style.setProperty('--fill-color', fillAmount > 0 ? COLOR : 'transparent');
      } else {
        items[i].classList.toggle('future', i >= limit);
        items[i].style.removeProperty('--fill-percent');
        items[i].style.removeProperty('--fill-color');
        items[i].style.backgroundColor = i < limit ? COLOR : '';
      }
    }
    _applyPeriodHighlights();
  }

  function _setupChart() {
    var config = _getViewConfig();
    chartEl.classList.remove('weeks', 'months', 'years');
    chartEl.classList.add(config.className);
    _populateChartCells(config.items(settings.maxAge));
    _renderMarkers(xMarkersEl, config.xMarkers);
    _renderMarkers(yMarkersEl, config.getYMarkers(settings.maxAge));
    _applyShapeSetting();
    _applyLayout(config);
    _applyDrawingMode();
    _applyPeriodsEnabledState();
    _applyPeriodHighlights();
  }

  function _applyLayout(config) {
    var totalCells = config.items(settings.maxAge);
    var columns = config.columns;
    var itemsPerRow = config.itemsPerRow || columns;
    var rows = Math.ceil(totalCells / itemsPerRow);
    var columnGapValue = _parseGap(config.columnGap || config.gap || '2px');
    var rowGapValue = _parseGap(config.rowGap || config.gap || '2px');
    var viewportWidth = document.documentElement.clientWidth;
    var horizontalPadding = viewportWidth <= 640 ? 24 : 32;
    var maxWidth = viewportWidth <= 640
      ? Math.max(200, (viewportWidth - horizontalPadding) * 0.9)
      : Math.min(viewportWidth * 0.66, viewportWidth - horizontalPadding);
    var maxHeight = viewportWidth <= 700 ? 800 : 1000;
    var baselineMetrics = _getBaselineMetrics(maxWidth, maxHeight);
    var cellWidthSpace = (maxWidth - columnGapValue * (columns - 1)) / columns;
    var cellHeightSpace = (maxHeight - rowGapValue * (rows - 1)) / rows;
    var defaultCellSize = Math.max(2, Math.min(cellWidthSpace, cellHeightSpace));
    var lockAspect = config.lockCellAspect !== false;
    var cellWidthValue;
    var cellHeightValue;

    if (lockAspect) {
      cellWidthValue = defaultCellSize;
      cellHeightValue = defaultCellSize;
    } else {
      cellWidthValue = Math.max(2, cellWidthSpace);
      if (config.matchRowHeight) {
        cellHeightValue = baselineMetrics.cellSize;
      } else {
        cellHeightValue = Math.max(2, cellHeightSpace);
      }
      if (config.maxCellHeight) {
        cellHeightValue = Math.min(cellHeightValue, config.maxCellHeight);
      }
      if (config.minCellHeight) {
        cellHeightValue = Math.max(cellHeightValue, config.minCellHeight);
      }
    }

    var chartWidthValue;
    if (config.matchBaseWidth) {
      var adjustedWidth =
        baselineMetrics.width - columnGapValue * Math.max(columns - 1, 0);
      cellWidthValue = Math.max(2, adjustedWidth / columns);
      chartWidthValue = baselineMetrics.width;
    } else {
      chartWidthValue = columns * cellWidthValue + columnGapValue * Math.max(columns - 1, 0);
    }

    chartEl.style.setProperty('--columns', columns);
    chartEl.style.setProperty('--cell-gap', config.gap || '2px');
    chartEl.style.setProperty('--column-gap', config.columnGap || config.gap || '2px');
    chartEl.style.setProperty('--row-gap', config.rowGap || config.gap || '2px');
    chartEl.style.setProperty('--cell-width', cellWidthValue + 'px');
    chartEl.style.setProperty('--cell-height', cellHeightValue + 'px');
    chartEl.style.setProperty('--cell-size', Math.min(cellWidthValue, cellHeightValue) + 'px');

    if (config.fullWidth) {
      chartEl.style.gridTemplateColumns = '1fr';
      chartEl.style.gridAutoRows = cellHeightValue + 'px';
      chartEl.style.width = maxWidth + 'px';
      chartEl.style.height = rows * (cellHeightValue + rowGapValue) - rowGapValue + 'px';
    } else {
      chartEl.style.gridTemplateColumns = 'repeat(' + columns + ', ' + cellWidthValue + 'px)';
      chartEl.style.gridAutoRows = cellHeightValue + 'px';
      var height = rows * cellHeightValue + rowGapValue * Math.max(rows - 1, 0);
      chartEl.style.width = chartWidthValue + 'px';
      chartEl.style.height = height + 'px';
    }
    _syncLifeRemainingWidth();
  }

  function _getViewConfig() {
    return VIEW_CONFIGS[settings.view] || VIEW_CONFIGS.weeks;
  }

  function _renderMarkers(container, values) {
    container.innerHTML = '';
    values.forEach(function (value) {
      var span = document.createElement('span');
      span.textContent = value;
      span.dataset.value = value;
      container.appendChild(span);
    });
  }

  function _generateRange(start, end, step) {
    var values = [];
    for (var i = start; i <= end; i += step) {
      values.push(i);
    }
    return values;
  }

  function _syncLifeRemainingWidth() {
    if (!lifeStatsEl || !chartEl) {
      return;
    }
    var chartWidth = chartEl.getBoundingClientRect().width;
    if (!chartWidth) {
      lifeStatsEl.style.removeProperty('width');
      return;
    }
    lifeStatsEl.style.width = chartWidth + 'px';
  }

  function _updateProgressDisplay() {
    if (!progressCurrentEl || !progressTotalEl) {
      return;
    }
    var config = _getViewConfig();
    var totalUnits = config.items(settings.maxAge);
    var hasDob = _dateIsValid();
    var livedUnits = hasDob ? calculateElapsedUnits() : 0;
    var currentAgeYears = hasDob ? _diffInYears(settings.dob, new Date()) : 0;
    progressCurrentEl.textContent = livedUnits.toLocaleString('ru-RU');
    progressTotalEl.textContent = totalUnits.toLocaleString('ru-RU');
    if (progressPercentEl) {
      var weeksConfig = VIEW_CONFIGS.weeks;
      var weeksTotal = weeksConfig.items(settings.maxAge);
      var weeksLived = hasDob ? _calculateElapsedWeeks(settings.dob, new Date()) : 0;
      var percentValue = weeksTotal > 0
        ? Math.min(100, Math.max(0, (weeksLived / weeksTotal) * 100))
        : 0;
      progressPercentEl.textContent = '(' + percentValue.toFixed(2) + '%)';
    }
    _updateRemainingLifeStats(hasDob, currentAgeYears);
  }

  function _updateRemainingLifeStats(hasDob, currentAgeYears) {
    if (!lifeStatsEl) {
      return;
    }
    if (!hasDob) {
      lifeStatsEl.classList.add('hidden');
      _resetRemainingLifeValues();
      return;
    }
    lifeStatsEl.classList.remove('hidden');
    var maxAge = typeof settings.maxAge === 'number' ? settings.maxAge : 80;
    var remainingYears = Math.max(0, maxAge - currentAgeYears);
    var remainingMonths = remainingYears * MONTHS_IN_YEAR;
    var remainingWeeks = remainingYears * WEEKS_IN_YEAR;
    var remainingDays = remainingYears * DAYS_IN_YEAR;
    var remainingHours = remainingDays * HOURS_IN_DAY;
    var remainingMinutes = remainingHours * MINUTES_IN_HOUR;
    var remainingSeconds = remainingMinutes * SECONDS_IN_MINUTE;
    var values = {
      years: remainingYears,
      months: remainingMonths,
      weeks: remainingWeeks,
      days: remainingDays,
      hours: remainingHours,
      minutes: remainingMinutes,
      seconds: remainingSeconds
    };
    Object.keys(values).forEach(function (unit) {
      var el = remainingLifeValueEls[unit];
      if (!el) {
        return;
      }
      el.textContent = _formatRemainingValue(values[unit]);
    });
  }

  function _resetRemainingLifeValues() {
    Object.keys(remainingLifeValueEls).forEach(function (unit) {
      var el = remainingLifeValueEls[unit];
      if (el) {
        el.textContent = '—';
      }
    });
  }

  function _formatRemainingValue(value) {
    return Math.max(0, Math.round(value)).toLocaleString('ru-RU');
  }

  function _getBaselineMetrics(maxWidth, maxHeight) {
    var baseConfig = VIEW_CONFIGS.weeks;
    var baseColumns = baseConfig.columns;
    var baseColumnGap = _parseGap(baseConfig.columnGap || baseConfig.gap || '2px');
    var baseRowGap = _parseGap(baseConfig.rowGap || baseConfig.gap || '2px');
    var baseRows = Math.ceil(baseConfig.items(settings.maxAge) / baseColumns);
    var baseCellWidthSpace = (maxWidth - baseColumnGap * (baseColumns - 1)) / baseColumns;
    var baseCellHeightSpace = (maxHeight - baseRowGap * (baseRows - 1)) / baseRows;
    var cellSize = Math.max(2, Math.min(baseCellWidthSpace, baseCellHeightSpace));
    var width = baseColumns * cellSize + baseColumnGap * Math.max(baseColumns - 1, 0);
    return { cellSize: cellSize, width: width };
  }

  function _applyThemeColors() {
    var accent = settings.color || 'black';
    var accentRgb = _hexToRgb(accent) || { r: 0, g: 0, b: 0 };
    var accentContrast = _getContrastColor(accentRgb);
    var surfaceRgb = _mixColor(accentRgb, WHITE_RGB, 0.85);
    var textRgb = _mixColor(accentRgb, BLACK_RGB, 0.8);
    var mutedRgb = _mixColor(accentRgb, BLACK_RGB, 0.6);
    var borderRgb = _mixColor(accentRgb, BLACK_RGB, 0.5);
    rootEl.style.setProperty('--color-accent', accent);
    rootEl.style.setProperty('--color-accent-contrast', accentContrast);
    rootEl.style.setProperty('--color-surface-solid', _rgbToHex(surfaceRgb));
    rootEl.style.setProperty('--color-text', _rgbToHex(textRgb));
    rootEl.style.setProperty('--color-muted', _rgbToHex(mutedRgb));
    rootEl.style.setProperty('--color-border', _rgbToHex(borderRgb));
  }

  function _parseGap(value) {
    if (typeof value === 'number') {
      return value;
    }
    var parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  function _hexToRgb(hex) {
    var normalized = hex.replace('#', '').trim();
    if (normalized.length === 3) {
      normalized = normalized.split('').map(function (char) {
        return char + char;
      }).join('');
    }
    if (normalized.length !== 6) {
      return null;
    }
    var r = parseInt(normalized.slice(0, 2), 16);
    var g = parseInt(normalized.slice(2, 4), 16);
    var b = parseInt(normalized.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }
    return { r: r, g: g, b: b };
  }

  function _rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function (value) {
      var hex = Math.max(0, Math.min(255, Math.round(value))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function _mixColor(color, target, amount) {
    return {
      r: color.r * (1 - amount) + target.r * amount,
      g: color.g * (1 - amount) + target.g * amount,
      b: color.b * (1 - amount) + target.b * amount
    };
  }

  function _rgbaString(rgb, alpha) {
    return 'rgba(' +
      Math.round(rgb.r) + ', ' +
      Math.round(rgb.g) + ', ' +
      Math.round(rgb.b) + ', ' +
      alpha +
    ')';
  }

  function _getContrastColor(rgb) {
    var luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? '#000000' : '#ffffff';
  }

  function _persistSettings() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dob: settings.dob ? settings.dob.toISOString() : null,
        maxAge: settings.maxAge,
        color: settings.color,
        view: settings.view,
        cellShape: settings.cellShape,
        drawingMode: settings.drawingMode,
        showPeriods: settings.showPeriods,
        periods: settings.periods
      })
    );
  }

  function _setActiveTab(view) {
    viewTabs.forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.view === view);
    });
  }

  function _applyShapeSetting() {
    chartEl.classList.toggle('square-cells', settings.cellShape === 'square');
    _updateLegendShape();
  }


  function _updateViewLabel() {
    if (!titleViewEl) {
      return;
    }
  titleViewEl.textContent = VIEW_LABELS[settings.view] || '';
  }

  function _applyDrawingMode() {
    var enabled = Boolean(settings.drawingMode);
    chartEl.classList.toggle('drawing-board', enabled);
    if (drawingModeInput) {
      drawingModeInput.checked = enabled;
    }
    _clearDrawingTouches();
  }

  function _applyPeriodsEnabledState() {
    if (!settings.showPeriods) {
      _clearAllPeriodHighlights();
      if (periodLegendEl) {
        periodLegendEl.classList.add('hidden');
      }
      _hidePeriodTooltip();
      return;
    }
    _refreshPeriodsVisuals();
  }

  function _toggleDrawCell(cell) {
    if (!cell) {
      return;
    }
    cell.classList.toggle('drawing-flipped');
  }

  function _clearDrawingTouches() {
    if (!items) {
      return;
    }
    Array.prototype.forEach.call(items, function (item) {
      item.classList.remove('drawing-flipped');
    });
  }

  function _handleDrawingPointerDown(evt) {
    if (!settings.drawingMode) {
      return;
    }
    if (!chartEl.contains(evt.target)) {
      return;
    }
    evt.preventDefault();
    isDrawingGesture = true;
    gestureTouchedCells.clear();
    var cell = evt.target.closest('li');
    if (cell && chartEl.contains(cell)) {
      lastDrawnCell = cell;
      _toggleDrawCell(cell);
      gestureTouchedCells.add(cell);
    } else {
      lastDrawnCell = null;
    }
  }

  function _handleDrawingPointerMove(evt) {
    if (!isDrawingGesture || !settings.drawingMode) {
      return;
    }
    var cell = _getCellFromPoint(evt.clientX, evt.clientY);
    if (cell && cell !== lastDrawnCell && !gestureTouchedCells.has(cell)) {
      lastDrawnCell = cell;
      _toggleDrawCell(cell);
      gestureTouchedCells.add(cell);
    }
  }

  function _handleDrawingPointerUp() {
    if (!isDrawingGesture) {
      return;
    }
    isDrawingGesture = false;
    lastDrawnCell = null;
    gestureTouchedCells.clear();
  }

  function _getCellFromPoint(x, y) {
    var element = document.elementFromPoint(x, y);
    if (!element || !chartEl.contains(element)) {
      return null;
    }
    return element.closest('li');
  }

  function _openPeriodEditor(options) {
    var periodId = options && options.periodId;
    var source = periodId ? _findPeriod(periodId) : null;
    var draft = source ? _clonePeriod(source) : {
      id: _generatePeriodId(),
      name: '',
      color: _getSuggestedPeriodColor(),
      spans: [_createPeriodSpan()]
    };
    editorState = {
      isEdit: Boolean(source),
      originalId: source ? source.id : draft.id,
      draft: draft
    };
    if (periodEditorTitle) {
      periodEditorTitle.textContent = editorState.isEdit ? 'Редактирование периода' : 'Новый период';
    }
    if (periodEditorNameInput) {
      periodEditorNameInput.value = draft.name || '';
    }
    if (periodEditorColorInput) {
      periodEditorColorInput.value = draft.color || settings.color || '#000000';
    }
    if (periodEditorDeleteBtn) {
      periodEditorDeleteBtn.classList.toggle('hidden', !editorState.isEdit);
    }
    _renderEditorSpansList();
    if (periodEditorOverlay) {
      periodEditorOverlay.classList.remove('hidden');
    }
  }

  function _closePeriodEditor() {
    editorState = null;
    if (periodEditorOverlay) {
      periodEditorOverlay.classList.add('hidden');
    }
  }

  function _syncPeriodActiveState() {
    var nextState = Object.create(null);
    settings.periods.forEach(function (period) {
      if (!period || !period.id) {
        return;
      }
      if (typeof periodActiveState[period.id] === 'boolean') {
        nextState[period.id] = periodActiveState[period.id];
      } else {
        nextState[period.id] = false;
      }
    });
    periodActiveState = nextState;
  }

  function _renderEditorSpansList() {
    if (!editorState || !periodEditorSpansEl) {
      return;
    }
    var spans = editorState.draft.spans;
    if (!Array.isArray(spans) || !spans.length) {
      spans = editorState.draft.spans = [_createPeriodSpan()];
    }
    periodEditorSpansEl.innerHTML = '';
    spans.forEach(function (span) {
      if (!span.id) {
        span.id = _generatePeriodSpanId();
      }
      var spanEl = document.createElement('div');
      spanEl.className = 'period-editor-span';
      spanEl.dataset.spanId = span.id;
      spanEl.innerHTML =
        '<div class="period-dates">' +
          '<div class="period-date-field">' +
            '<label>Начало</label>' +
            '<input type="date" class="period-start-input" />' +
          '</div>' +
          '<div class="period-date-field">' +
            '<label>Конец</label>' +
            '<input type="date" class="period-end-input" />' +
          '</div>' +
        '</div>' +
        '<div class="period-editor-span-controls">' +
          '<button type="button" class="remove-period-span" aria-label="Удалить интервал">&times;</button>' +
        '</div>';
      var startInput = spanEl.querySelector('.period-start-input');
      var endInput = spanEl.querySelector('.period-end-input');
      var removeBtn = spanEl.querySelector('.remove-period-span');
      startInput.value = span.startDate || '';
      endInput.value = span.endDate || '';
      if (removeBtn) {
        var isDisabled = spans.length <= 1;
        removeBtn.disabled = isDisabled;
        removeBtn.classList.toggle('is-disabled', isDisabled);
      }
      periodEditorSpansEl.appendChild(spanEl);
    });
  }

  function _addEditorSpan() {
    if (!editorState) {
      return;
    }
    var spans = editorState.draft.spans;
    var template = spans.length ? spans[spans.length - 1] : null;
    editorState.draft.spans.push(_createPeriodSpan(template));
    _renderEditorSpansList();
  }

  function _handleEditorSpanInput(evt) {
    if (!editorState) {
      return;
    }
    var spanEl = evt.target.closest('.period-editor-span');
    if (!spanEl) {
      return;
    }
    var span = editorState.draft.spans.find(function (entry) {
      return entry.id === spanEl.dataset.spanId;
    });
    if (!span) {
      return;
    }
    if (evt.target.classList.contains('period-start-input')) {
      span.startDate = evt.target.value;
    } else if (evt.target.classList.contains('period-end-input')) {
      span.endDate = evt.target.value;
    }
  }

  function _handleEditorSpanClick(evt) {
    if (!editorState) {
      return;
    }
    if (!evt.target.classList.contains('remove-period-span')) {
      return;
    }
    if (evt.target.disabled) {
      return;
    }
    var spanEl = evt.target.closest('.period-editor-span');
    if (!spanEl) {
      return;
    }
    editorState.draft.spans = editorState.draft.spans.filter(function (span) {
      return span.id !== spanEl.dataset.spanId;
    });
    if (!editorState.draft.spans.length) {
      editorState.draft.spans.push(_createPeriodSpan());
    }
    _renderEditorSpansList();
  }

  function _savePeriodFromEditor() {
    if (!editorState) {
      return;
    }
    editorState.draft.name = periodEditorNameInput ? periodEditorNameInput.value.trim() : editorState.draft.name;
    editorState.draft.color = periodEditorColorInput ? (periodEditorColorInput.value || editorState.draft.color) : editorState.draft.color;
    var spans = editorState.draft.spans.map(_cloneSpan).filter(function (span) {
      return span.startDate || span.endDate;
    });
    if (!spans.length) {
      spans = [_createPeriodSpan()];
    }
    editorState.draft.spans = spans;
    var hadPeriodsBefore = settings.periods.length > 0;
    if (editorState.isEdit) {
      var existing = _findPeriod(editorState.originalId);
      if (existing) {
        existing.name = editorState.draft.name;
        existing.color = editorState.draft.color;
        existing.spans = spans.map(_cloneSpan);
      }
    } else {
      settings.periods.push({
        id: editorState.draft.id,
        name: editorState.draft.name,
        color: editorState.draft.color,
        spans: spans.map(_cloneSpan)
      });
      periodActiveState[editorState.draft.id] = false;
      if (!hadPeriodsBefore && settings.drawingMode) {
        settings.drawingMode = false;
        _applyDrawingMode();
      }
    }
    _persistSettings();
    _refreshPeriodsVisuals();
    _closePeriodEditor();
  }

  function _deletePeriodFromEditor() {
    if (!editorState || !editorState.isEdit) {
      _closePeriodEditor();
      return;
    }
    settings.periods = settings.periods.filter(function (period) {
      return period.id !== editorState.originalId;
    });
    delete periodActiveState[editorState.originalId];
    _persistSettings();
    _refreshPeriodsVisuals();
    _closePeriodEditor();
  }

  function _startDeleteHold() {
    if (!editorState || !editorState.isEdit || !periodEditorDeleteBtn) {
      return;
    }
    _cancelDeleteHold();
    periodEditorDeleteBtn.classList.add('is-holding');
    deleteHoldTimer = window.setTimeout(function () {
      deleteHoldTimer = null;
      periodEditorDeleteBtn.classList.remove('is-holding');
      _deletePeriodFromEditor();
    }, 1000);
  }

  function _cancelDeleteHold() {
    if (deleteHoldTimer) {
      window.clearTimeout(deleteHoldTimer);
      deleteHoldTimer = null;
    }
    if (periodEditorDeleteBtn) {
      periodEditorDeleteBtn.classList.remove('is-holding');
    }
  }

  function _clonePeriod(period) {
    return {
      id: period.id || _generatePeriodId(),
      name: period.name || '',
      color: period.color || settings.color || '#000000',
      spans: Array.isArray(period.spans) && period.spans.length
        ? period.spans.map(_cloneSpan)
        : [_createPeriodSpan()]
    };
  }

  function _cloneSpan(span) {
    return {
      id: span.id || _generatePeriodSpanId(),
      startDate: span.startDate || '',
      endDate: span.endDate || ''
    };
  }

  function _findPeriod(id) {
    return settings.periods.find(function (period) {
      return period.id === id;
    });
  }

  function _getSuggestedPeriodColor() {
    var palette = ['#f46e6e', '#f09942', '#2ab7ca', '#fed766', '#76b041', '#9d4edd'];
    return palette[settings.periods.length % palette.length] || settings.color || '#ff0000';
  }

  function _refreshPeriodsVisuals() {
    if (!settings.showPeriods) {
      _clearAllPeriodHighlights();
      if (periodLegendEl) {
        periodLegendEl.classList.add('hidden');
      }
      return;
    }
    if (items && items.length) {
      _repaintItems(itemCount);
    } else {
      _renderPeriodLegend();
    }
  }

  function _applyPeriodHighlights() {
    if (!settings.showPeriods) {
      _clearAllPeriodHighlights();
      return;
    }
    var spans = _getRenderableSpans();
    spanMetaById = {};
    spans.forEach(function (span) {
      spanMetaById[span.spanId] = span;
    });
    if (!items || !items.length) {
      _renderPeriodLegend();
      if (!spans.length) {
        _hidePeriodTooltip();
      }
      return;
    }
    var highlighted = new Array(items.length);
    spans.forEach(function (span) {
      if (!_isPeriodActive(span.periodId)) {
        return;
      }
      for (var i = span.range.start; i <= span.range.end; i++) {
        if (i < 0 || i >= highlighted.length) {
          continue;
        }
        var coverage = _calculateCellCoverage(span, i);
        if (!coverage) {
          continue;
        }
        if (!highlighted[i]) {
          highlighted[i] = [];
        }
        highlighted[i].push({
          period: span,
          periodId: span.periodId,
          spanId: span.spanId,
          coverage: coverage
        });
      }
    });

    for (var index = 0; index < items.length; index++) {
      var segments = highlighted[index];
      var cell = items[index];
      if (segments && segments.length) {
        var normalizedSegments = _normalizeSegmentsForCell(segments);
        var datasetValue = normalizedSegments.map(function (segment) {
          return segment.spanId;
        }).join(',');
        cell.classList.add('period-highlight');
        cell.dataset.spanIds = datasetValue;
        _renderCellLayers(cell, normalizedSegments);
      } else {
      cell.classList.remove('period-highlight');
        _clearCellLayers(cell);
        if (cell.dataset) {
          delete cell.dataset.spanIds;
        }
      }
    }
    if (!spans.length) {
      _hidePeriodTooltip();
    }
    _renderPeriodLegend();
  }

  function _clearAllPeriodHighlights() {
    if (!items || !items.length) {
      return;
    }
    for (var i = 0; i < items.length; i++) {
      var cell = items[i];
      cell.classList.remove('period-highlight');
      if (cell.dataset && cell.dataset.spanIds) {
        delete cell.dataset.spanIds;
      }
      _clearCellLayers(cell);
    }
  }

  function _getRenderableSpans() {
    if (!settings.dob) {
      return [];
    }
    var config = _getViewConfig();
    var totalCells = config.items(settings.maxAge);
    var lastIndex = totalCells - 1;
    if (lastIndex < 0) {
      return [];
    }
    var renderable = [];
    settings.periods.forEach(function (period) {
      if (!Array.isArray(period.spans)) {
        return;
      }
      period.spans.forEach(function (span) {
        if (!span.startDate || !span.endDate) {
          return;
        }
        var startDate = new Date(span.startDate);
        var endDate = new Date(span.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return;
        }
        if (endDate.getTime() < startDate.getTime()) {
          var swap = startDate;
          startDate = endDate;
          endDate = swap;
        }
        var range = _calculatePeriodRange(startDate, endDate);
        if (!range) {
          return;
        }
        if (range.end < 0 || range.start > lastIndex) {
          return;
        }
        range.start = Math.max(0, range.start);
        range.end = Math.min(lastIndex, range.end);
        if (range.start > range.end) {
          return;
        }
        var spanId = span.id || _generatePeriodSpanId();
        if (!span.id) {
          span.id = spanId;
        }
        renderable.push({
          periodId: period.id,
          spanId: spanId,
          name: period.name && period.name.trim() ? period.name.trim() : 'Без названия',
          color: period.color || settings.color || '#000000',
          startDate: startDate,
          endDate: endDate,
          range: range
        });
      });
    });
    return renderable;
  }

  function _calculateCellCoverage(period, cellIndex) {
    var boundaries = _getCellBoundaries(cellIndex);
    if (!boundaries) {
      return null;
    }
    var cellStart = boundaries.start.getTime();
    var cellEnd = boundaries.end.getTime();
    var overlapStart = Math.max(cellStart, period.startDate.getTime());
    var overlapEnd = Math.min(cellEnd, period.endDate.getTime());
    if (overlapEnd <= overlapStart) {
      return null;
    }
    var duration = cellEnd - cellStart;
    if (duration <= 0) {
      return null;
    }
    return {
      start: Math.max(0, Math.min(1, (overlapStart - cellStart) / duration)),
      end: Math.max(0, Math.min(1, (overlapEnd - cellStart) / duration))
    };
  }

  function _getCellBoundaries(index) {
    if (!settings.dob) {
      return null;
    }
    if (settings.view === 'years') {
      return {
        start: _addYears(settings.dob, index),
        end: _addYears(settings.dob, index + 1)
      };
    }
    if (settings.view === 'months') {
      var startMonth = _addMonths(settings.dob, index);
      return {
        start: startMonth,
        end: _addMonths(startMonth, 1)
      };
    }
    var startWeek = _addDays(settings.dob, index * 7);
    return {
      start: startWeek,
      end: _addDays(startWeek, 7)
    };
  }

  function _normalizeStoredPeriod(period) {
    var base = period || {};
    var normalized = {
      id: String(base.id || _generatePeriodId()),
      name: base.name || '',
      color: base.color || settings.color,
      spans: []
    };
    if (Array.isArray(base.spans) && base.spans.length) {
      normalized.spans = base.spans.map(_normalizeStoredSpan).filter(Boolean);
    } else if (base.startDate || base.endDate) {
      var span = _normalizeStoredSpan({
        id: base.spanId || (base.id ? base.id + '-span' : null),
        startDate: base.startDate,
        endDate: base.endDate
      });
      if (span) {
        normalized.spans = [span];
      }
    }
    if (!normalized.spans.length) {
      normalized.spans = [_createPeriodSpan()];
    }
    return normalized;
  }

  function _normalizeStoredSpan(span) {
    if (!span) {
      return null;
    }
    return {
      id: String(span.id || _generatePeriodSpanId()),
      startDate: span.startDate || '',
      endDate: span.endDate || ''
    };
  }

  function _normalizeSegmentsForCell(segments) {
    return segments || [];
  }

  function _renderCellLayers(cell, segments) {
    var overlay = cell.querySelector('.period-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'period-overlay';
      cell.appendChild(overlay);
    }
    if (!segments.length) {
      _clearCellLayers(cell);
      return;
    }
    var backgrounds = [];
    if (settings.view === 'weeks') {
      backgrounds.push(_buildVerticalStackGradient(segments));
    } else {
      backgrounds.push(_buildCoverageBlendGradient(segments));
    }
    overlay.style.background = backgrounds.join(', ');
    var start = Math.min.apply(null, segments.map(function (segment) {
      return Math.max(0, Math.min(1, (segment.coverage && segment.coverage.start) || 0));
    }));
    var end = Math.max.apply(null, segments.map(function (segment) {
      return Math.max(0, Math.min(1, (segment.coverage && segment.coverage.end) || 1));
    }));
    start = Math.max(0, Math.min(1, start));
    end = Math.max(0, Math.min(1, end));
    if (end <= start) {
      overlay.style.clipPath = 'none';
    } else {
      var leftInset = start * 100;
      var rightInset = (1 - end) * 100;
      overlay.style.clipPath = 'inset(0 ' + rightInset + '% 0 ' + leftInset + '%)';
    }
  }

  function _clearCellLayers(cell) {
    var overlay = cell.querySelector('.period-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function _buildVerticalStackGradient(segments) {
    if (!segments.length) {
      return 'transparent';
    }
    var share = 1 / segments.length;
    var stops = [];
    segments.forEach(function (segment, index) {
      var color = segment.period.color || '#000000';
      var start = share * index;
      var end = share * (index + 1);
      stops.push(color + ' ' + (start * 100) + '% ' + (end * 100) + '%');
    });
    return 'linear-gradient(180deg, ' + stops.join(', ') + ')';
  }

  function _buildPeriodGradient(segments) {
    if (!segments || !segments.length) {
      return '';
    }
    var sorted = segments.slice().sort(function (a, b) {
      return (a.coverage && a.coverage.start || 0) - (b.coverage && b.coverage.start || 0);
    });
    var share = 1 / sorted.length;
    var parts = [];
    var current = 0;
    sorted.forEach(function (segment, index) {
      var color = segment.period.color || '#000000';
      var start = current;
      var end = current + share;
      parts.push(color + ' ' + (start * 100) + '% ' + (end * 100) + '%');
      current = end;
    });
    if (current < 1 && sorted.length) {
      var lastColor = sorted[sorted.length - 1].period.color || '#000000';
      parts.push(lastColor + ' ' + (current * 100) + '% 100%');
    }
    return 'conic-gradient(' + parts.join(', ') + ')';
  }

  function _buildCoverageBlendGradient(segments) {
    if (!segments.length) {
      return 'transparent';
    }
    var slices = _calculateBlendSlices(segments);
    if (!slices.length) {
      return 'transparent';
    }
    var stops = slices.map(function (slice) {
      return slice.color + ' ' + (slice.start * 100) + '% ' + (slice.end * 100) + '%';
    });
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  function _calculateBlendSlices(segments) {
    var normalized = segments.map(function (segment) {
      var coverage = segment.coverage || { start: 0, end: 1 };
      var start = Math.max(0, Math.min(1, coverage.start || 0));
      var end = Math.max(0, Math.min(1, coverage.end || 1));
      if (end <= start) {
        return null;
      }
      return {
        start: start,
        end: end,
        color: segment.period && segment.period.color ? segment.period.color : '#000000'
      };
    }).filter(Boolean);
    if (!normalized.length) {
      return [];
    }
    var points = [0, 1];
    normalized.forEach(function (segment) {
      if (points.indexOf(segment.start) === -1) {
        points.push(segment.start);
      }
      if (points.indexOf(segment.end) === -1) {
        points.push(segment.end);
      }
    });
    points.sort(function (a, b) {
      return a - b;
    });
    var slices = [];
    for (var i = 0; i < points.length - 1; i++) {
      var start = points[i];
      var end = points[i + 1];
      if (end <= start) {
        continue;
      }
      var active = normalized.filter(function (segment) {
        return segment.start < end && segment.end > start;
      });
      if (!active.length) {
        continue;
      }
      var blended = _blendSegmentColors(active);
      if (!blended) {
        continue;
      }
      slices.push({
        start: start,
        end: end,
        color: blended
      });
    }
    return slices;
  }

  function _blendSegmentColors(segments) {
    if (!segments.length) {
      return null;
    }
    var total = { r: 0, g: 0, b: 0 };
    var count = 0;
    segments.forEach(function (segment) {
      var rgb = _hexToRgb(segment.color);
      if (!rgb) {
        return;
      }
      total.r += rgb.r;
      total.g += rgb.g;
      total.b += rgb.b;
      count++;
    });
    if (!count) {
      return null;
    }
    var blended = {
      r: total.r / count,
      g: total.g / count,
      b: total.b / count
    };
    return _rgbToHex(blended);
  }

  function _isPeriodActive(periodId) {
    if (typeof periodActiveState[periodId] === 'boolean') {
      return periodActiveState[periodId];
    }
    periodActiveState[periodId] = false;
    return false;
  }

  function _calculatePeriodRange(startDate, endDate) {
    var startIndex = _calculateUnitIndexForDate(startDate);
    var endIndex = _calculateUnitIndexForDate(endDate);
    if (typeof startIndex !== 'number' || typeof endIndex !== 'number') {
      return null;
    }
    var minIndex = Math.min(startIndex, endIndex);
    var maxIndex = Math.max(startIndex, endIndex);
    return { start: minIndex, end: maxIndex };
  }

  function _calculateUnitIndexForDate(date) {
    if (!settings.dob) {
      return null;
    }
    if (settings.view === 'years') {
      return _diffInYears(settings.dob, date);
    }
    if (settings.view === 'months') {
      return _diffInMonths(settings.dob, date);
    }
    return _diffInWeeks(settings.dob, date);
  }

  function _diffInWeeks(start, target) {
    var diff = target.getTime() - start.getTime();
    return Math.floor(diff / (7 * 24 * 60 * 60 * 1000));
  }

  function _diffInMonths(start, target) {
    var years = target.getFullYear() - start.getFullYear();
    var months = target.getMonth() - start.getMonth();
    var total = years * 12 + months;
    if (target.getDate() < start.getDate()) {
      total--;
    }
    return total;
  }

  function _diffInYears(start, target) {
    var years = target.getFullYear() - start.getFullYear();
    var beforeBirthday =
      target.getMonth() < start.getMonth() ||
      (target.getMonth() === start.getMonth() && target.getDate() < start.getDate());
    if (beforeBirthday) {
      years--;
    }
    return years;
  }

  function _renderPeriodLegend() {
    if (!settings.showPeriods) {
      if (periodLegendEl) {
        periodLegendEl.classList.add('hidden');
      }
      return;
    }
    if (!periodLegendEl) {
      return;
    }
    _hidePeriodTooltip();
    var data = _getLegendPeriodData();
    periodLegendEl.innerHTML = '';
    if (!data.length) {
      _hidePeriodTooltip();
    }
    var fragment = document.createDocumentFragment();
    data.sort(function (a, b) {
      var aValue = isFinite(a.earliest) ? a.earliest : Infinity;
      var bValue = isFinite(b.earliest) ? b.earliest : Infinity;
      return aValue - bValue;
    }).forEach(function (period) {
      var item = document.createElement('div');
      item.className = 'legend-item';
      item.dataset.id = period.id;
      var color = document.createElement('span');
      color.className = 'legend-color';
      color.style.backgroundColor = period.color;
      var label = document.createElement('span');
      label.textContent = period.name;
      item.appendChild(color);
      item.appendChild(label);
      if (!_isPeriodActive(period.id)) {
        item.classList.add('inactive');
      }
      fragment.appendChild(item);
    });
    var addItem = document.createElement('div');
    addItem.className = 'legend-item legend-add';
    var addColor = document.createElement('span');
    addColor.className = 'legend-color';
    var addLabel = document.createElement('span');
    addLabel.textContent = 'Добавить период';
    addItem.appendChild(addColor);
    addItem.appendChild(addLabel);
    fragment.appendChild(addItem);
    var toggleAllItem = _createToggleAllItem();
    fragment.insertBefore(toggleAllItem, fragment.firstChild);
    periodLegendEl.appendChild(fragment);
    periodLegendEl.classList.remove('hidden');
    _updateLegendShape();
  }

  function _createToggleAllItem() {
    var item = document.createElement('div');
    item.className = 'legend-item legend-toggle-all';
    item.dataset.id = '__toggle_all__';
    var color = document.createElement('span');
    color.className = 'legend-color';
    color.style.backgroundColor = _hasDisabledPeriods() ? 'black' : 'white';
    var label = document.createElement('span');
    label.textContent = _hasDisabledPeriods() ? 'Показать все' : 'Скрыть все';
    item.appendChild(color);
    item.appendChild(label);
    return item;
  }

  function _getLegendPeriodData() {
    var entries = [];
    settings.periods.forEach(function (period) {
      if (!Array.isArray(period.spans) || !period.spans.length) {
        return;
      }
      var validSpans = period.spans.filter(function (span) {
        return span.startDate && span.endDate;
      });
      if (!validSpans.length) {
        return;
      }
      entries.push({
        id: period.id,
        name: period.name && period.name.trim() ? period.name.trim() : 'Без названия',
        color: period.color || settings.color || '#000000',
        earliest: _getEarliestSpanTimestamp(validSpans)
      });
    });
    return entries;
  }

  function _getEarliestSpanTimestamp(spans) {
    var min = Infinity;
    spans.forEach(function (span) {
      var time = new Date(span.startDate).getTime();
      if (!isNaN(time)) {
        min = Math.min(min, time);
      }
    });
    return min;
  }

  function _formatDateForDisplay(date) {
    if (!(date instanceof Date)) {
      return '';
    }
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function _updateLegendShape() {
    if (!periodLegendEl) {
      return;
    }
    periodLegendEl.classList.toggle('square-markers', settings.cellShape === 'square');
  }

  function _handlePeriodCellPointerOver(evt) {
    if (settings.drawingMode || !settings.showPeriods) {
      return;
    }
    if (evt.pointerType === 'touch') {
      return;
    }
    var cell = _getPeriodCellFromEvent(evt);
    if (!cell) {
      _hidePeriodTooltip();
      return;
    }
    _cancelTooltipAutoHide();
    _showPeriodTooltipForCell(cell);
  }

  function _handlePeriodCellPointerOut(evt) {
    if (settings.drawingMode || !settings.showPeriods) {
      return;
    }
    if (evt.pointerType === 'touch') {
      return;
    }
    _hidePeriodTooltip();
  }

  function _handlePeriodCellPointerDown(evt) {
    if (settings.drawingMode || !settings.showPeriods) {
      return;
    }
    var cell = _getPeriodCellFromEvent(evt);
    if (!cell) {
      _hidePeriodTooltip();
      return;
    }
    _showPeriodTooltipForCell(cell);
    _scheduleTooltipAutoHide();
  }

  function _handleLegendClick(evt) {
    var item = evt.target.closest('.legend-item');
    if (!item) {
      return;
    }
    if (item.classList.contains('legend-toggle-all')) {
      evt.preventDefault();
      var enable = _hasDisabledPeriods();
      _setAllPeriodsActive(enable);
      _hidePeriodTooltip();
      _applyPeriodHighlights();
      return;
    }
    if (item.classList.contains('legend-add')) {
      evt.preventDefault();
      _openPeriodEditor();
      return;
    }
    if (!item.dataset.id) {
      return;
    }
    if (suppressLegendToggle) {
      suppressLegendToggle = false;
      return;
    }
    var id = item.dataset.id;
    periodActiveState[id] = !_isPeriodActive(id);
    _hidePeriodTooltip();
    _applyPeriodHighlights();
  }

  function _handleLegendContextMenu(evt) {
    var item = evt.target.closest('.legend-item');
    if (!item || item.classList.contains('legend-add')) {
      return;
    }
    evt.preventDefault();
    suppressLegendToggle = true;
    _openPeriodEditor({ periodId: item.dataset.id });
  }

  function _handleLegendPointerDown(evt) {
    if (evt.pointerType !== 'touch') {
      return;
    }
    var item = evt.target.closest('.legend-item');
    if (!item || item.classList.contains('legend-add')) {
      return;
    }
    _clearLegendLongPress();
    legendLongPressTarget = item;
    legendLongPressTimer = window.setTimeout(function () {
      legendLongPressTimer = null;
      if (legendLongPressTarget) {
        suppressLegendToggle = true;
        _openPeriodEditor({ periodId: legendLongPressTarget.dataset.id });
      }
    }, 600);
  }

  function _clearLegendLongPress() {
    if (legendLongPressTimer) {
      window.clearTimeout(legendLongPressTimer);
      legendLongPressTimer = null;
    }
    legendLongPressTarget = null;
  }

  function _hasDisabledPeriods() {
    return Object.keys(periodActiveState).some(function (id) {
      return periodActiveState[id] === false;
    });
  }

  function _setAllPeriodsActive(active) {
    settings.periods.forEach(function (period) {
      periodActiveState[period.id] = active;
    });
  }

  function _cycleView() {
    var order = ['weeks', 'months', 'years'];
    var currentIndex = order.indexOf(settings.view);
    var nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
    _switchView(order[nextIndex]);
  }

  function _getPeriodCellFromEvent(evt) {
    if (!chartEl) {
      return null;
    }
    var cell = evt.target.closest('li');
    if (!cell || !chartEl.contains(cell)) {
      return null;
    }
    if (!cell.dataset || !cell.dataset.spanIds) {
      return null;
    }
    return cell;
  }

  function _showPeriodTooltipForCell(cell) {
    if (!cell || !cell.dataset) {
      _hidePeriodTooltip();
      return;
    }
    var ids = (cell.dataset.spanIds || '').split(',').filter(Boolean);
    if (!ids.length) {
      _hidePeriodTooltip();
      return;
    }
    var spans = ids.map(function (id) {
      return spanMetaById[id];
    }).filter(Boolean);
    if (!spans.length) {
      _hidePeriodTooltip();
      return;
    }
    _showPeriodTooltip(spans, cell);
  }

  function _showPeriodTooltip(spans, anchorElement) {
    if (!periodTooltipEl || !anchorElement) {
      return;
    }
    var lines = [].concat(spans).map(function (span) {
      if (!span) {
        return '';
      }
      var startLabel = _formatDateForDisplay(span.startDate);
      var endLabel = _formatDateForDisplay(span.endDate);
      var text = span.name;
      if (startLabel && endLabel) {
        text += ' (' + startLabel + ' – ' + endLabel + ')';
      }
      return text;
    }).filter(Boolean);
    if (!lines.length) {
      _hidePeriodTooltip();
      return;
    }
    periodTooltipEl.textContent = lines.join('\n');
    var rect = anchorElement.getBoundingClientRect();
    var top = Math.max(8, rect.top - 6);
    var left = rect.left + rect.width / 2;
    periodTooltipEl.style.top = top + 'px';
    periodTooltipEl.style.left = left + 'px';
    periodTooltipEl.classList.remove('hidden');
  }

  function _hidePeriodTooltip() {
    if (!periodTooltipEl) {
      return;
    }
    _cancelTooltipAutoHide();
    periodTooltipEl.classList.add('hidden');
  }

  function _scheduleTooltipAutoHide() {
    _cancelTooltipAutoHide();
    tooltipAutoHideId = window.setTimeout(function () {
      _hidePeriodTooltip();
    }, 2200);
  }

  function _cancelTooltipAutoHide() {
    if (tooltipAutoHideId) {
      window.clearTimeout(tooltipAutoHideId);
      tooltipAutoHideId = null;
    }
  }
})();
