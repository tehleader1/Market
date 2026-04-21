const SIGNALS = [
  {
    key: "deltaBias",
    title: "Delta Bias Threshold",
    description: "Calls or puts are gaining directional dominance."
  },
  {
    key: "volumeBurst",
    title: "Volume Burst",
    description: "Current option volume is well above the rolling baseline."
  },
  {
    key: "liquidityShift",
    title: "Liquidity Shift",
    description: "Resting liquidity and spread support continuation."
  },
  {
    key: "pressureOverdrive",
    title: "Pressure Overdrive",
    description: "Combined pressure shows continuation strength over reversal risk."
  },
  {
    key: "wickStructure",
    title: "Wick Structure",
    description: "Recent wick behavior is supporting the active direction."
  },
  {
    key: "trendAcceptance",
    title: "Trend Acceptance",
    description: "Several candles are closing with consistent directional acceptance."
  },
  {
    key: "reversalFailure",
    title: "Reversal Failure",
    description: "Counter-move attempts are weak enough to keep the same direction active."
  }
];

const HISTORY_STORAGE_KEY = "anthony-market-indicator-history-v1";
const HISTORY_INTERVAL_MS = 3 * 60 * 60 * 1000;
const HISTORY_LIMIT = 80;
const LIVE_REFRESH_MS = 5000;

const state = {
  ticker: "SPY",
  candles: [],
  dashboard: null,
  refreshTimer: null,
  liveSocket: null,
  liveStreamError: "",
  loading: false,
  tradeArmed: false,
  historyEntries: loadHistoryEntries(),
  tradeConfig: {
    budget: 400,
    symbol: "SPY",
    direction: "bullish",
    strikePrice: 55,
    rangeStart: 45.06,
    rangeEnd: 46.7,
    expiration: "",
    targetGain: 1000
  },
  turbulence: {
    lockScore: 0,
    repeatWhaleScore: 0,
    disengaged: false
  }
};

const els = {
  tickerInput: document.getElementById("tickerInput"),
  applyTickerBtn: document.getElementById("applyTickerBtn"),
  chartCanvas: document.getElementById("chartCanvas"),
  chartTitle: document.getElementById("chartTitle"),
  lastPrice: document.getElementById("lastPrice"),
  mainReader: document.getElementById("mainReader"),
  mainReaderStatus: document.getElementById("mainReaderStatus"),
  mainReaderText: document.getElementById("mainReaderText"),
  turbulenceReader: document.getElementById("turbulenceReader"),
  turbulenceReaderStatus: document.getElementById("turbulenceReaderStatus"),
  turbulenceReaderText: document.getElementById("turbulenceReaderText"),
  neutralZoneReader: document.getElementById("neutralZoneReader"),
  neutralZoneStatus: document.getElementById("neutralZoneStatus"),
  neutralZoneText: document.getElementById("neutralZoneText"),
  strikeReader: document.getElementById("strikeReader"),
  strikeReaderStatus: document.getElementById("strikeReaderStatus"),
  strikeReaderText: document.getElementById("strikeReaderText"),
  biasLabel: document.getElementById("biasLabel"),
  setupLabel: document.getElementById("setupLabel"),
  pressureStack: document.getElementById("pressureStack"),
  stackScore: document.getElementById("stackScore"),
  verdictReader: document.getElementById("verdictReader"),
  verdictStatus: document.getElementById("verdictStatus"),
  verdictText: document.getElementById("verdictText"),
  forecastReader: document.getElementById("forecastReader"),
  forecastStatus: document.getElementById("forecastStatus"),
  forecastText: document.getElementById("forecastText"),
  centerIndicator: document.getElementById("centerIndicator"),
  centerIndicatorText: document.getElementById("centerIndicatorText"),
  deltaValue: document.getElementById("deltaValue"),
  deltaHint: document.getElementById("deltaHint"),
  volumeValue: document.getElementById("volumeValue"),
  volumeHint: document.getElementById("volumeHint"),
  liquidityValue: document.getElementById("liquidityValue"),
  liquidityHint: document.getElementById("liquidityHint"),
  pressureValue: document.getElementById("pressureValue"),
  pressureHint: document.getElementById("pressureHint"),
  orderFlowStatus: document.getElementById("orderFlowStatus"),
  buyFlowFill: document.getElementById("buyFlowFill"),
  sellFlowFill: document.getElementById("sellFlowFill"),
  buyFlowValue: document.getElementById("buyFlowValue"),
  sellFlowValue: document.getElementById("sellFlowValue"),
  orderFlowSummary: document.getElementById("orderFlowSummary"),
  orderFlowTape: document.getElementById("orderFlowTape"),
  contractLabel: document.getElementById("contractLabel"),
  marketStatus: document.getElementById("marketStatus"),
  errorBanner: document.getElementById("errorBanner"),
  deployStatus: document.getElementById("deployStatus"),
  deployText: document.getElementById("deployText"),
  flowSteps: document.getElementById("flowSteps"),
  verdictMetrics: document.getElementById("verdictMetrics"),
  forecastMetrics: document.getElementById("forecastMetrics"),
  mainReaderMetrics: document.getElementById("mainReaderMetrics"),
  turbulenceMetrics: document.getElementById("turbulenceMetrics"),
  neutralZoneMetrics: document.getElementById("neutralZoneMetrics"),
  strikeMetrics: document.getElementById("strikeMetrics"),
  armTradeBtn: document.getElementById("armTradeBtn"),
  armedStatus: document.getElementById("armedStatus"),
  touchTradeText: document.getElementById("touchTradeText"),
  budgetInput: document.getElementById("budgetInput"),
  manualSymbolInput: document.getElementById("manualSymbolInput"),
  directionSelect: document.getElementById("directionSelect"),
  strikeInput: document.getElementById("strikeInput"),
  rangeStartInput: document.getElementById("rangeStartInput"),
  rangeEndInput: document.getElementById("rangeEndInput"),
  expirationInput: document.getElementById("expirationInput"),
  targetGainInput: document.getElementById("targetGainInput"),
  tradeDecisionBadge: document.getElementById("tradeDecisionBadge"),
  tradeDecisionText: document.getElementById("tradeDecisionText"),
  topCandidatesStatus: document.getElementById("topCandidatesStatus"),
  topCandidates: document.getElementById("topCandidates"),
  historyStatus: document.getElementById("historyStatus"),
  historyTableBody: document.getElementById("historyTableBody")
};

const ctx = els.chartCanvas.getContext("2d");

async function fetchDashboard(ticker) {
  const response = await fetch(`/api/options-dashboard?ticker=${encodeURIComponent(ticker)}&ts=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to load market data." }));
    throw new Error(payload.error || "Unable to load market data.");
  }
  return response.json();
}

function getOpportunityProfile(metrics, contract, config = state.tradeConfig) {
  const estimatedMovePercent = estimateMovePercent(metrics, contract);
  const estimatedProfit = estimateTradeProfit(metrics, contract, config);
  const projectedUnderlyingMove = Number(metrics.projectedUnderlyingMove || 0);
  const aroundFiftyFive = (metrics.underlyingPrice ?? 55) >= 40 && (metrics.underlyingPrice ?? 55) <= 70;
  const lightBand = estimatedProfit >= 1000 && aroundFiftyFive;
  const darkBand = estimatedProfit >= 4000 && projectedUnderlyingMove >= 4.5 && aroundFiftyFive;
  const band = darkBand ? "dark" : lightBand ? "light" : "off";
  return {
    estimatedMovePercent,
    estimatedProfit,
    projectedUnderlyingMove,
    band,
    aroundFiftyFive
  };
}

function setReaderBand(element, band, direction) {
  element.classList.toggle("is-on", band !== "off");
  element.classList.toggle("is-soft-green", band === "light");
  element.classList.toggle("is-dark-green", band === "dark");
  element.classList.toggle("is-bearish", direction === "bearish");
}

function setReaderMetricLine(element, parts) {
  if (!element) {
    return;
  }
  element.textContent = parts.filter(Boolean).join("  •  ");
}

function renderPressureStack(metrics, contract) {
  const activeCount = Object.values(metrics.flags).filter(Boolean).length;
  els.stackScore.textContent = `${activeCount} / 7 active`;
  els.pressureStack.innerHTML = "";

  SIGNALS.forEach((signal) => {
    const item = document.createElement("article");
    item.className = `stack-item${metrics.flags[signal.key] ? " is-on" : ""}`;
    const detail = getSignalDetail(signal.key, metrics, contract);
    item.innerHTML = `
      <strong>${signal.title}</strong>
      <p>${detail}</p>
    `;
    els.pressureStack.appendChild(item);
  });
}

function loadHistoryEntries() {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveHistoryEntries() {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.historyEntries));
  } catch (error) {
    // Ignore storage failures so the dashboard keeps running.
  }
}

function getWhaleStats(metrics, contract) {
  const history = metrics.historicalContext || {};
  const whaleUnit = Math.max(1, Number(contract?.openInterest || 0) / 12);
  const contractVolume = Number(contract?.volume || 0);
  const quoteDepth = Number(contract?.quoteDepth || 0);
  const repeatWhaleEntries = Math.max(0, Math.floor(contractVolume / whaleUnit) - 1);
  const sameDirectionSupport = history.direction === metrics.direction ? 1 : 0;

  return {
    history,
    contractVolume,
    quoteDepth,
    repeatWhaleEntries,
    sameDirectionSupport
  };
}

function getPressureProfile(metrics, contract) {
  const targetMove = getConfiguredDistance();
  const winProfileMove = 1.67;
  const wickThresholdPassed = metrics.wickBodyRatio >= 0.5;
  const candleRange = Number(metrics.candleRange || 0);
  const moveDepth = targetMove > 0 ? Math.min(1.5, candleRange / targetMove) : 0;
  const distanceCloseness = targetMove > 0 ? Math.max(0, Math.min(100, (candleRange / targetMove) * 100)) : 0;
  const secondLegReady = wickThresholdPassed && moveDepth >= 0.6;
  const pressureScore = Math.max(0, Math.min(100,
    (metrics.pressure * 0.46) +
    (Math.max(0, metrics.volumePercent - 100) * 0.2) +
    (metrics.liquidityPercent * 0.18) +
    (Math.abs(metrics.delta) * 24) +
    (wickThresholdPassed ? 10 : -8) +
    (metrics.continuationReady ? 10 : 0)
  ));
  const moveReadiness = Math.max(0, Math.min(99,
    (pressureScore * 0.72) +
    (distanceCloseness * 0.18) +
    (secondLegReady ? 8 : 0)
  ));
  const pressureImpliedMove = winProfileMove * (moveReadiness / 100);
  const winProfileProgress = Math.max(0, Math.min(100, (pressureImpliedMove / winProfileMove) * 100));
  const pressureLabel = moveReadiness >= 82
    ? "Pressure says this move can fully play out"
    : moveReadiness >= 68
      ? "Pressure says this move is realistic"
      : moveReadiness >= 52
        ? "Pressure is building toward the move"
        : "Pressure is not there yet";

  return {
    targetMove,
    winProfileMove,
    wickThresholdPassed,
    candleRange,
    moveDepth,
    distanceCloseness,
    secondLegReady,
    pressureScore,
    moveReadiness,
    pressureImpliedMove,
    winProfileProgress,
    pressureLabel
  };
}

function buildHistorySnapshot(metrics, contract) {
  const whaleStats = getWhaleStats(metrics, contract);
  const pressureProfile = getPressureProfile(metrics, contract);
  const timestamp = new Date().toISOString();

  return {
    id: `${state.ticker}-${timestamp}`,
    timestamp,
    ticker: state.ticker,
    direction: metrics.direction,
    contractLabel: contract?.optionsTicker || "Underlying",
    whaleReinforcementCount: whaleStats.repeatWhaleEntries,
    impliedMove: pressureProfile.pressureImpliedMove,
    winProfileProgress: pressureProfile.winProfileProgress,
    volumeBurst: Number(contract?.volume || 0),
    volumePercent: metrics.volumePercent,
    delta: metrics.delta,
    liquidityPercent: metrics.liquidityPercent,
    pressure: metrics.pressure,
    pressureScore: pressureProfile.pressureScore,
    moveReadiness: pressureProfile.moveReadiness,
    wickBodyRatio: metrics.wickBodyRatio,
    contractVolume: whaleStats.contractVolume
  };
}

function maybeRecordHistory(metrics, contract) {
  if (!metrics) {
    return;
  }

  const tickerEntries = state.historyEntries.filter((entry) => entry.ticker === state.ticker);
  const lastEntry = tickerEntries[0];
  const now = Date.now();
  const shouldRecord = !lastEntry || (now - new Date(lastEntry.timestamp).getTime()) >= HISTORY_INTERVAL_MS;

  if (!shouldRecord) {
    renderHistoryTable();
    return;
  }

  state.historyEntries = [
    buildHistorySnapshot(metrics, contract),
    ...state.historyEntries
  ].slice(0, HISTORY_LIMIT);
  saveHistoryEntries();
  renderHistoryTable();
}

function renderHistoryTable() {
  const entries = state.historyEntries.filter((entry) => entry.ticker === state.ticker).slice(0, 12);

  els.historyStatus.textContent = entries.length
    ? `3 hour snapshots • ${entries.length} saved`
    : "3 hour snapshots";

  if (!entries.length) {
    els.historyTableBody.innerHTML = `
      <tr>
        <td colspan="11">The board will start recording 3 hour indicator snapshots here.</td>
      </tr>
    `;
    return;
  }

  els.historyTableBody.innerHTML = entries.map((entry) => {
    const readinessClass = entry.moveReadiness >= 82
      ? "history-pill is-strong"
      : entry.moveReadiness >= 60
        ? "history-pill is-building"
        : "history-pill";

    return `
      <tr>
        <td>${formatHistoryTime(entry.timestamp)}</td>
        <td>${entry.ticker}</td>
        <td>${entry.whaleReinforcementCount}</td>
        <td>$${Number(entry.impliedMove || 0).toFixed(2)}</td>
        <td>${Number(entry.winProfileProgress || 0).toFixed(0)}%</td>
        <td>${Number(entry.volumeBurst || 0).toLocaleString()} / ${Number(entry.volumePercent || 0).toFixed(0)}%</td>
        <td>${Number(entry.delta || 0).toFixed(2)}</td>
        <td>${Number(entry.liquidityPercent || 0).toFixed(0)}%</td>
        <td>${Number(entry.pressure || 0).toFixed(0)}%</td>
        <td><span class="${readinessClass}">${Number(entry.moveReadiness || 0).toFixed(0)}%</span></td>
        <td>${Number(entry.wickBodyRatio || 0).toFixed(2)}x</td>
      </tr>
    `;
  }).join("");
}

function formatHistoryTime(timestamp) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getSignalDetail(key, metrics, contract) {
  const contractVolume = Number(contract?.volume || 0);
  const openInterest = Number(contract?.openInterest || 0);
  const liquidityDepth = Number(contract?.quoteDepth || 0);
  const directionalPct = Math.min(99, Math.max(1, 50 + Math.abs(metrics.delta) * 45));
  const history = metrics.historicalContext || {};
  const historyDirection = history.direction || "neutral";
  const historyBias = Number(history.biasStrength || 0) * 100;

  const details = {
    deltaBias: `Delta ${metrics.delta.toFixed(2)} with ${directionalPct.toFixed(0)}% pushing ${metrics.direction}. Stock history bias ${historyBias.toFixed(0)}% ${historyDirection}.`,
    volumeBurst: `Volume Burst: ${contractVolume.toLocaleString()} contracts, ${metrics.volumePercent.toFixed(0)}% of baseline, ${directionalPct.toFixed(0)}% one-way pressure. Historical stock volume shift ${Number(history.volumeDeviationPercent || 0).toFixed(0)}%.`,
    liquidityShift: `Liquidity ${metrics.liquidityPercent.toFixed(0)}% with ${liquidityDepth.toLocaleString()} visible size and ${openInterest.toLocaleString()} open interest. History average close $${Number(history.averageClose || 0).toFixed(2)}.`,
    pressureOverdrive: `Pressure ${metrics.pressure.toFixed(0)}%. ${getPressureGrade(metrics.pressure)} load into the next candle. History counterweight ${historyBias.toFixed(0)}% ${historyDirection}.`,
    wickStructure: `Wick/body ${metrics.wickBodyRatio.toFixed(2)}x. ${metrics.wickSizeQualified ? "75% threshold passed." : "75% threshold not passed."}`,
    trendAcceptance: `Participation is ${Math.max(0, metrics.volumePercent - 100).toFixed(0)}% above neutral in the active direction. Historical price drift ${Number(history.priceDeviationPercent || 0).toFixed(2)}%.`,
    reversalFailure: `${metrics.pressure > 57 ? "Reversal pressure is being absorbed." : "Reversal pressure still threatens the move."} Continuation edge ${Math.max(0, metrics.pressure - 45).toFixed(0)}%. History direction is ${historyDirection}.`
  };

  return details[key] || "Signal is waiting for live numbers.";
}

function drawChart() {
  const width = els.chartCanvas.clientWidth;
  const height = els.chartCanvas.clientHeight;
  const scale = window.devicePixelRatio || 1;

  if (els.chartCanvas.width !== Math.floor(width * scale) || els.chartCanvas.height !== Math.floor(height * scale)) {
    els.chartCanvas.width = Math.floor(width * scale);
    els.chartCanvas.height = Math.floor(height * scale);
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const candles = state.candles;
  if (!candles.length) {
    ctx.fillStyle = "#8ea3c6";
    ctx.font = "16px IBM Plex Mono";
    ctx.fillText("Loading candles...", 24, 36);
    return;
  }

  const maxPrice = Math.max(...candles.map((candle) => candle.high));
  const minPrice = Math.min(...candles.map((candle) => candle.low));
  const priceRange = Math.max(1, maxPrice - minPrice);
  const padding = { top: 24, right: 16, bottom: 38, left: 18 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = plotWidth / candles.length;
  const candleWidth = Math.max(6, step * 0.54);

  drawGrid(width, height, padding, plotWidth, plotHeight, minPrice, priceRange);

  candles.forEach((candle, index) => {
    const x = padding.left + index * step + step / 2;
    const openY = padding.top + ((maxPrice - candle.open) / priceRange) * plotHeight;
    const closeY = padding.top + ((maxPrice - candle.close) / priceRange) * plotHeight;
    const highY = padding.top + ((maxPrice - candle.high) / priceRange) * plotHeight;
    const lowY = padding.top + ((maxPrice - candle.low) / priceRange) * plotHeight;
    const isUp = candle.close >= candle.open;

    ctx.strokeStyle = isUp ? "#61f4a6" : "#ff7a7a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(3, Math.abs(closeY - openY));
    ctx.fillStyle = isUp ? "rgba(97, 244, 166, 0.85)" : "rgba(255, 122, 122, 0.82)";
    ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
  });

  drawVolumeBars(candles, height, padding, plotHeight, step);
}

function drawGrid(width, height, padding, plotWidth, plotHeight, minPrice, priceRange) {
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#89a0c6";
  ctx.font = "12px IBM Plex Mono";

  for (let row = 0; row < 5; row += 1) {
    const y = padding.top + (plotHeight / 4) * row;
    const value = minPrice + ((4 - row) / 4) * priceRange;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(`$${value.toFixed(2)}`, width - padding.right - 68, y - 6);
  }

  for (let column = 0; column < 7; column += 1) {
    const x = padding.left + (plotWidth / 6) * column;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
  }
}

function drawVolumeBars(candles, height, padding, plotHeight, step) {
  const volumeBase = height - padding.bottom + 4;
  const maxVolume = Math.max(...candles.map((candle) => candle.volume || 0), 1);

  candles.forEach((candle, index) => {
    const x = padding.left + index * step + step * 0.14;
    const barHeight = ((candle.volume || 0) / maxVolume) * (plotHeight * 0.16);
    const isUp = candle.close >= candle.open;

    ctx.fillStyle = isUp ? "rgba(97, 244, 166, 0.28)" : "rgba(255, 122, 122, 0.22)";
    ctx.fillRect(x, volumeBase - barHeight, step * 0.72, barHeight);
  });
}

function updateUi() {
  const dashboard = state.dashboard;
  if (!dashboard) {
    return;
  }

  const { metrics, contract, marketStatus, error, orderFlow, topCandidates } = dashboard;
  const last = state.candles[state.candles.length - 1];

  els.chartTitle.textContent = `${state.ticker} Options Flow`;
  els.lastPrice.textContent = last ? `$${last.close.toFixed(2)}` : "$0.00";
  els.biasLabel.textContent = metrics.directionVerdict?.label || `${capitalize(metrics.direction)} Continuation`;
  els.setupLabel.textContent = metrics.volumeForecast?.label
    || (metrics.wickSupportsDirection
      ? metrics.direction === "bullish" ? "Lower Wick Support" : "Upper Wick Rejection"
      : "No Wick Edge");

  els.contractLabel.textContent = contract
    ? `${contract.optionsTicker} • ${contract.contractType.toUpperCase()} • ${contract.expirationDate} • $${contract.strikePrice.toFixed(2)}`
    : "No option contract selected";
  els.marketStatus.textContent = marketStatus || "Awaiting market status";
  els.errorBanner.textContent = error || "";
  els.errorBanner.hidden = !error;

  els.deltaValue.textContent = `${metrics.delta > 0 ? "+" : ""}${metrics.delta.toFixed(2)}`;
  els.deltaHint.textContent = metrics.delta > 0 ? "Buy pressure leads" : "Sell pressure leads";
  els.volumeValue.textContent = `${metrics.volumePercent.toFixed(0)}%`;
  els.volumeHint.textContent = metrics.volumeHint;
  els.liquidityValue.textContent = `${metrics.liquidityPercent.toFixed(0)}%`;
  els.liquidityHint.textContent = metrics.liquidityHint;
  els.pressureValue.textContent = `${metrics.pressure.toFixed(0)}%`;
  els.pressureHint.textContent = metrics.pressureHint;
  renderOrderFlow(orderFlow);
  updateDeployPanel();
  renderTopCandidates(topCandidates || []);

  els.centerIndicator.classList.toggle("is-on", metrics.continuationReady);
  els.centerIndicator.classList.toggle("is-off", !metrics.continuationReady);
  els.centerIndicatorText.textContent = metrics.continuationReady
    ? `${metrics.wickWindowLabel} active for ${metrics.direction} continuation`
    : `Waiting for wick setup inside the 15m/10m/5m close window • ${metrics.wickWindowLabel}`;

  updateVerdictReader(metrics, contract);
  updateForecastReader(metrics);
  updateTurbulenceReader(metrics, contract);
  updateNeutralZoneReader(metrics, contract);
  updateMainReader(metrics, contract);
  updateStrikeReader(metrics, contract);
  updateTradeDecision(metrics, contract);
  updateTouchTradePanel(metrics);
  renderFlowSteps(metrics, contract);
  renderPressureStack(metrics, contract);
  maybeRecordHistory(metrics, contract);
}

function renderOrderFlow(orderFlow) {
  const flow = orderFlow || {
    buyPercent: 50,
    sellPercent: 50,
    buyCount: 0,
    sellCount: 0,
    buySize: 0,
    sellSize: 0,
    bidPrice: 0,
    askPrice: 0,
    bidSize: 0,
    askSize: 0,
    quoteBuyPercent: 50,
    quoteSellPercent: 50,
    dominance: "balanced",
    dominanceScore: 0,
    tape: [],
    loadError: ""
  };

  els.buyFlowFill.style.width = `${flow.buyPercent.toFixed(1)}%`;
  els.sellFlowFill.style.width = `${flow.sellPercent.toFixed(1)}%`;
  els.buyFlowValue.textContent = `${flow.buyPercent.toFixed(0)}% buys`;
  els.sellFlowValue.textContent = `${flow.sellPercent.toFixed(0)}% sells`;
  els.orderFlowStatus.textContent = flow.loadError
    ? "Recent trades unavailable"
    : `Live 5s tape • ${capitalize(flow.dominance)} in control`;
  if (state.liveStreamError) {
    els.orderFlowStatus.textContent = "Live socket unavailable";
  } else if (!isRegularMarketHours()) {
    els.orderFlowStatus.textContent = "Market off-hours";
  }
  els.orderFlowSummary.textContent = buildOrderFlowSummary(flow);

  if (!flow.tape?.length) {
    els.orderFlowTape.innerHTML = `<p class="order-flow-empty">${flow.loadError || "Waiting for live trade prints."}</p>`;
    return;
  }

  els.orderFlowTape.innerHTML = flow.tape.map((trade) => `
    <article class="order-flow-item is-${trade.side}">
      <span class="order-flow-side">${trade.side}</span>
      <span class="order-flow-time">${formatTapeTime(trade.timestamp)}</span>
      <span class="order-flow-size">${Number(trade.size || 0).toLocaleString()} sh</span>
      <span class="order-flow-price">$${Number(trade.price || 0).toFixed(2)}</span>
    </article>
  `).join("");
}

function updateDeployPanel() {
  const hosted = window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost";
  els.deployStatus.textContent = hosted ? "Permanent link live" : "Render-ready";
  els.deployText.textContent = hosted
    ? `You are on the hosted board at ${window.location.host}. This is the permanent access point for the reader system.`
    : "This board is ready to deploy to a permanent Node host like Render. Once deployed, this panel will show the hosted link instead of the local `127.0.0.1` address.";
}

function renderTopCandidates(candidates) {
  els.topCandidatesStatus.textContent = candidates.length
    ? `${candidates.length} names ranked for one-direction flow`
    : "Scanning near $55 zone";

  if (!candidates.length) {
    els.topCandidates.innerHTML = `<p class="order-flow-empty">Waiting for top candidates.</p>`;
    return;
  }

  els.topCandidates.innerHTML = candidates.map((item, index) => `
    <article class="candidate-item is-${item.direction}">
      <div>
        <strong>#${index + 1} ${item.ticker}</strong>
        <p>${capitalize(item.direction)} • ${item.threeDayPattern}</p>
      </div>
      <div class="candidate-meta">
        <span>$${Number(item.lastPrice || 0).toFixed(2)}</span>
        <span>${Number(item.pressure || 0).toFixed(0)}% pressure</span>
        <span>$${Number(item.projectedProfit || 0).toLocaleString()} est.</span>
      </div>
    </article>
  `).join("");
}

function renderFlowSteps(metrics, contract) {
  const opportunity = getOpportunityProfile(metrics, contract);
  const steps = [
    {
      label: "Top 10 board",
      detail: "Use ranked one-direction names first",
      active: Boolean(state.dashboard?.topCandidates?.length)
    },
    {
      label: "Volume window",
      detail: metrics.sessionFlow?.countdown || metrics.volumeForecast?.label || "Outside setup window",
      active: Number(metrics.sessionFlow?.hourVolumePercent || 0) >= 100
    },
    {
      label: "Pressure line",
      detail: `${metrics.pressure.toFixed(0)}% pressure • ${metrics.direction}`,
      active: metrics.pressure >= 60
    },
    {
      label: "Main reader",
      detail: `${metrics.wickBodyRatio.toFixed(2)}x wick • ${metrics.delta.toFixed(2)} delta`,
      active: metrics.continuationReady
    },
    {
      label: "Strike payout",
      detail: `$${opportunity.estimatedProfit.toFixed(0)} est. on $${Number(state.tradeConfig.budget || 0).toFixed(0)}`,
      active: opportunity.band !== "off"
    }
  ];

  els.flowSteps.innerHTML = steps.map((step, index) => `
    <article class="flow-step${step.active ? " is-active" : ""}">
      <strong>${index + 1}. ${step.label}</strong>
      <p>${step.detail}</p>
    </article>
  `).join("");
}

function buildOrderFlowSummary(flow) {
  if (flow.loadError) {
    return `${flow.loadError} The gauge needs live trade prints to classify aggressive buying versus dumping pressure.`;
  }

  if (state.liveStreamError) {
    return `${state.liveStreamError} The board is falling back to REST snapshots right now, so you are not seeing true live incoming orders until WebSocket access is available on the Polygon plan.`;
  }

  if (!isRegularMarketHours()) {
    return `The live tape is connected, but it is currently outside regular stock market hours, so individual trade prints can be sparse or completely quiet until the market is active again.`;
  }

  if (flow.dominance === "buyers") {
    return `Buyers are shoving sellers off the tape. ${flow.buyCount} of the last 15 inferred prints are buy-side, with ${flow.buySize.toLocaleString()} shares pressing against ${flow.sellSize.toLocaleString()} sold shares. Quote pressure is ${Number(flow.quoteBuyPercent || 50).toFixed(0)}% bid support with ${Number(flow.bidSize || 0).toLocaleString()} bid shares stacked near $${Number(flow.bidPrice || 0).toFixed(2)}.`;
  }

  if (flow.dominance === "sellers") {
    return `Sellers are dumping into the tape. ${flow.sellCount} of the last 15 inferred prints are sell-side, with ${flow.sellSize.toLocaleString()} shares overwhelming ${flow.buySize.toLocaleString()} bought shares. Quote pressure is ${Number(flow.quoteSellPercent || 50).toFixed(0)}% ask weight with ${Number(flow.askSize || 0).toLocaleString()} ask shares stacked near $${Number(flow.askPrice || 0).toFixed(2)}.`;
  }

  return `Buys and sells are still pushing against each other. The last 15 inferred prints are balanced, with ${flow.buySize.toLocaleString()} buy shares versus ${flow.sellSize.toLocaleString()} sell shares. Quote pressure is ${Number(flow.quoteBuyPercent || 50).toFixed(0)}% bid support versus ${Number(flow.quoteSellPercent || 50).toFixed(0)}% ask weight.`;
}

function formatTapeTime(timestamp) {
  if (!timestamp) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(timestamp));
}

function isRegularMarketHours() {
  const now = new Date();
  const easternNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = easternNow.getDay();
  const minutes = easternNow.getHours() * 60 + easternNow.getMinutes();
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;

  return day >= 1 && day <= 5 && minutes >= marketOpen && minutes <= marketClose;
}

function updateTurbulenceReader(metrics, contract) {
  const whaleStats = getWhaleStats(metrics, contract);
  const { history, contractVolume, quoteDepth, repeatWhaleEntries, sameDirectionSupport } = whaleStats;
  const fakeoutRisk = Math.max(0, (100 - metrics.pressure) / 100) + (sameDirectionSupport ? 0 : 0.45);
  const reinforcement = (
    repeatWhaleEntries * 0.22 +
    Math.max(0, (metrics.pressure - 55) / 100) +
    Math.max(0, (metrics.volumePercent - 100) / 160) +
    Math.max(0, quoteDepth / 1200) +
    sameDirectionSupport * 0.4
  );

  state.turbulence.repeatWhaleScore = repeatWhaleEntries;

  if (reinforcement > 1.05 && metrics.wickSizeQualified) {
    state.turbulence.lockScore = Math.min(100, state.turbulence.lockScore + reinforcement * 12);
    state.turbulence.disengaged = false;
  } else if (fakeoutRisk > 0.9 || metrics.pressure < 48) {
    state.turbulence.lockScore = Math.max(0, state.turbulence.lockScore - 28);
    state.turbulence.disengaged = state.turbulence.lockScore < 18;
  } else {
    state.turbulence.lockScore = Math.max(0, state.turbulence.lockScore - 6);
  }

  const isLocked = state.turbulence.lockScore >= 62;
  const isWarning = !isLocked && state.turbulence.lockScore >= 30;
  const directionalPct = Math.min(99, Math.max(1, 50 + Math.abs(metrics.delta) * 45));
  const band = isLocked ? "light" : "off";

  setReaderBand(els.turbulenceReader, band, metrics.direction);
  els.turbulenceReader.classList.toggle("is-warning", isWarning);
  setReaderMetricLine(els.turbulenceMetrics, [
    `Whales ${repeatWhaleEntries}`,
    `Lock ${state.turbulence.lockScore.toFixed(0)}%`,
    `Flow ${contractVolume.toLocaleString()}`,
    `Directional ${directionalPct.toFixed(0)}%`
  ]);

  if (isLocked) {
    els.turbulenceReaderStatus.textContent = `Firm lock ${state.turbulence.lockScore.toFixed(0)}%`;
    els.turbulenceReaderText.textContent = `Slippery green lock is engaged. Repeated whale reinforcement count ${repeatWhaleEntries}, live contract flow ${contractVolume.toLocaleString()}, and ${directionalPct.toFixed(0)}% pressure pushing ${metrics.direction} are keeping the move latched until it is obviously over.`;
    return;
  }

  if (state.turbulence.disengaged) {
    els.turbulenceReaderStatus.textContent = "Sudden disengage";
    els.turbulenceReaderText.textContent = `The turbulence hold snapped off. Repeated whale reinforcement fell back, pressure dropped to ${metrics.pressure.toFixed(0)}%, and the move is now reading more like a fake-out or exhausted push than a clean one-direction play.`;
    return;
  }

  els.turbulenceReaderStatus.textContent = isWarning
    ? `Loose hold ${state.turbulence.lockScore.toFixed(0)}%`
    : "Scanning for sticky pressure";
  els.turbulenceReaderText.textContent = `Turbulence check: ${repeatWhaleEntries} repeated whale-style entries, ${contractVolume.toLocaleString()} live contracts, quote depth ${quoteDepth.toLocaleString()}, pressure ${metrics.pressure.toFixed(0)}%, and stock-history bias ${(Number(history.biasStrength || 0) * 100).toFixed(0)}% ${history.direction || "neutral"}. The green light will stay slippery until repeated same-direction pressure locks it in.`;
}

function updateNeutralZoneReader(metrics, contract) {
  const profile = getPressureProfile(metrics, contract);
  const {
    winProfileMove,
    wickThresholdPassed,
    candleRange,
    moveDepth,
    secondLegReady,
    pressureScore,
    moveReadiness,
    pressureImpliedMove,
    winProfileProgress,
    pressureLabel
  } = profile;
  const inZone = wickThresholdPassed && moveDepth >= 0.35;
  const deepZone = wickThresholdPassed && moveDepth >= 0.85;
  const contractVolume = Number(contract?.volume || 0);
  const pressureReady = metrics.pressure >= 58 && metrics.volumePercent >= 108;
  const band = deepZone ? "dark" : inZone ? "light" : "off";

  setReaderBand(els.neutralZoneReader, band, metrics.direction);
  els.neutralZoneReader.classList.toggle("is-deep", deepZone);
  setReaderMetricLine(els.neutralZoneMetrics, [
    `Implied $${pressureImpliedMove.toFixed(2)}`,
    `Profile ${winProfileProgress.toFixed(0)}%`,
    `Readiness ${moveReadiness.toFixed(0)}%`,
    `Wick ${metrics.wickBodyRatio.toFixed(2)}x`
  ]);

  if (deepZone) {
    els.neutralZoneStatus.textContent = `Pressure read ${moveReadiness.toFixed(0)}% • locked`;
    els.neutralZoneText.textContent = `${pressureLabel}. Pressure math is reading off delta, volume, liquidity, wick strength, and continuation timing. The current 30 minute candle has a pressure score of ${pressureScore.toFixed(0)}%, a move-readiness score of ${moveReadiness.toFixed(0)}%, and a wick/body reading of ${metrics.wickBodyRatio.toFixed(2)}x. For this current option, pressure is implying about a $${pressureImpliedMove.toFixed(2)} move right now, which is ${winProfileProgress.toFixed(0)}% of the $${winProfileMove.toFixed(2)} win-profile setup. Live flow is ${contractVolume.toLocaleString()} contracts, and the board is reading this option as strong enough to fully play out if the pressure stays firm.`;
    return;
  }

  if (inZone) {
    els.neutralZoneStatus.textContent = secondLegReady
      ? `Pressure read ${moveReadiness.toFixed(0)}% • move building`
      : `Pressure read ${moveReadiness.toFixed(0)}% • highlighted`;
    els.neutralZoneText.textContent = `Pressure is building inside this 30 minute candle. Pressure math is reading delta, volume, liquidity, wick strength, and live continuation timing together. The pressure score is ${pressureScore.toFixed(0)}%, move readiness is ${moveReadiness.toFixed(0)}%, and wick/body is ${metrics.wickBodyRatio.toFixed(2)}x. For this current option, pressure is implying about a $${pressureImpliedMove.toFixed(2)} move, which is ${winProfileProgress.toFixed(0)}% of the $${winProfileMove.toFixed(2)} win-profile setup${pressureReady ? ". Current pressure is strong enough to keep the move alive." : ". Current pressure still needs more reinforcement."}`;
    return;
  }

  els.neutralZoneStatus.textContent = `Pressure read ${moveReadiness.toFixed(0)}% • watching`;
  els.neutralZoneText.textContent = `Pressure is being measured for this option through delta, volume, liquidity, wick strength, and continuation timing. Right now the pressure score is ${pressureScore.toFixed(0)}%, move readiness is ${moveReadiness.toFixed(0)}%, and wick/body is ${metrics.wickBodyRatio.toFixed(2)}x. For this current option, pressure is implying about a $${pressureImpliedMove.toFixed(2)} move, which is ${winProfileProgress.toFixed(0)}% of the $${winProfileMove.toFixed(2)} win-profile setup.`;
}

function getPressureGrade(pressure) {
  if (pressure >= 88) {
    return "Extreme dark green";
  }
  if (pressure >= 76) {
    return "Heavy green";
  }
  if (pressure >= 69) {
    return "Strong green";
  }
  if (pressure >= 58) {
    return "Building green";
  }
  return "Gray";
}

function estimateMovePercent(metrics, contract) {
  const spreadPenalty = Number(contract?.spread || 0.2) * 8;
  return Math.max(0, (metrics.pressure * 0.55) + (metrics.volumePercent - 100) * 0.18 - spreadPenalty);
}

function estimateTradeProfit(metrics, contract, config) {
  const budget = Number(config.budget || 0);
  const confidence = Math.max(0, metrics.pressure / 100);
  const movePercent = estimateMovePercent(metrics, contract) / 100;
  return budget * movePercent * (0.8 + confidence * 0.7);
}

function updateTouchTradePanel(metrics) {
  const pressureReady = metrics.pressure >= 69;
  const wickReady = Boolean(metrics.wickSupportsDirection && metrics.wickSizeQualified && metrics.wickWindowLabel);
  const tradeReady = pressureReady && metrics.continuationReady;

  els.armTradeBtn.classList.toggle("is-armed", state.tradeArmed);
  els.armTradeBtn.textContent = state.tradeArmed ? "Disarm Next 30m Candle" : "Arm Next 30m Candle";
  els.armedStatus.textContent = state.tradeArmed ? "System armed" : "System idle";

  if (!state.tradeArmed) {
    els.touchTradeText.textContent = "Tap to evaluate whether the next 30 minute candle is over-pressured and whether the wick setup is strong enough before entering a live trade.";
    return;
  }

  if (tradeReady) {
    els.touchTradeText.textContent = `Trade-ready: over-pressure passed and wick pressure confirmed for the next ${metrics.direction} 30 minute candle.`;
    return;
  }

  const pressureMessage = pressureReady
    ? "Over-pressure passed"
    : "Over-pressure has not passed yet";
  const wickMessage = wickReady && metrics.continuationReady
    ? "wick confirmation passed"
    : "wick confirmation is not ready yet";

  els.touchTradeText.textContent = `${pressureMessage}. ${wickMessage}. Arm stays active while this candle is being monitored.`;
}

function updateTradeDecision(metrics, contract) {
  const config = state.tradeConfig;
  const directionMatch = config.direction === metrics.direction;
  const opportunity = getOpportunityProfile(metrics, contract, config);
  const rangeHit = metrics.volumePercent >= 115 && metrics.pressure >= 58;
  const targetDistance = getConfiguredDistance();
  const outcome = !directionMatch
    ? `${capitalize(metrics.direction)} mode`
    : opportunity.band === "dark"
      ? "Dark green setup"
      : opportunity.band === "light"
        ? "Light green setup"
        : "Below payout threshold";

  els.tradeDecisionBadge.textContent = outcome;
  els.tradeDecisionBadge.className = "";
  els.tradeDecisionBadge.classList.add(`decision-${opportunity.band}`);
  els.tradeDecisionText.textContent = [
    `Board mode is ${metrics.direction}.`,
    `Budget $${Number(config.budget || 0).toFixed(0)} with ${config.direction === "bullish" ? "call" : "put"} side selected on ${config.symbol}.`,
    `Strike $${Number(config.strikePrice || 0).toFixed(2)} with anchor distance $${targetDistance.toFixed(2)} and target gain $${Number(config.targetGain || 0).toFixed(0)}.`,
    `Pressure ${metrics.pressure.toFixed(0)}%, delta ${metrics.delta.toFixed(2)}, volume ${metrics.volumePercent.toFixed(0)}%, liquidity ${metrics.liquidityPercent.toFixed(0)}%.`,
    `${metrics.wickWindowLabel} and 75% wick rule are ${metrics.wickSizeQualified ? "passing" : "not passing"}.`,
    `Projected underlying move $${opportunity.projectedUnderlyingMove.toFixed(2)} and projected option result $${opportunity.estimatedProfit.toFixed(0)}.`,
    !directionMatch ? `The board would rather take the ${metrics.direction} move here, so the system flips ${metrics.direction} until the opposite side proves itself again.` : "",
    opportunity.band === "dark" ? "Dark green means this setup is close to the bigger breakout profile." : opportunity.band === "light" ? "Light green means this can pay, but it is still short of the larger breakout profile." : "Green stays off until the payout math clears at least $1,000 on the $400 budget.",
    rangeHit ? "The live candle is approaching a real measured-distance move." : "The live candle has not built enough pressure for the full measured-distance move yet."
  ].join(" ");
}

function updateMainReader(metrics, contract) {
  const directionalWick = metrics.direction === "bullish" ? "downward wick pressure" : "upward wick pressure";
  const highDelta = Math.abs(metrics.delta) >= 0.28;
  const highVolume = metrics.volumePercent >= 115;
  const highLiquidity = metrics.liquidityPercent >= 56;
  const allPressureAligned = metrics.wickSizeQualified && highDelta && highVolume && highLiquidity;
  const exactContinuation = allPressureAligned && metrics.continuationReady;
  const intensity = getPressureGrade(metrics.pressure);
  const directionalPct = Math.min(99, Math.max(1, 50 + Math.abs(metrics.delta) * 45));
  const contractVolume = Number(contract?.volume || 0);
  const history = metrics.historicalContext || {};
  const historyDirection = history.direction || "neutral";
  const historyBias = Number(history.biasStrength || 0) * 100;

  const opportunity = getOpportunityProfile(metrics, contract);
  const band = exactContinuation ? opportunity.band : allPressureAligned ? "light" : "off";
  setReaderBand(els.mainReader, band, metrics.direction);
  setReaderMetricLine(els.mainReaderMetrics, [
    `${capitalize(metrics.direction)} ${metrics.pressure.toFixed(0)}%`,
    `Delta ${metrics.delta.toFixed(2)}`,
    `Vol ${metrics.volumePercent.toFixed(0)}%`,
    `Liq ${metrics.liquidityPercent.toFixed(0)}%`,
    `Est $${opportunity.estimatedProfit.toFixed(0)}`
  ]);
  els.mainReaderStatus.textContent = exactContinuation
    ? `${intensity} continuation`
    : allPressureAligned
      ? "Pressure aligned, waiting on close window"
      : "Waiting for pressure alignment";

  if (exactContinuation) {
    els.mainReaderText.textContent = `Main reader ${intensity}. The ${directionalWick} is ${metrics.wickBodyRatio.toFixed(2)}x the candle body, volume is ${metrics.volumePercent.toFixed(0)}%, liquidity is ${metrics.liquidityPercent.toFixed(0)}%, and ${directionalPct.toFixed(0)}% of pressure is pushing ${metrics.direction}. Live count reading ${contractVolume.toLocaleString()} contracts. Stock history bias is ${historyBias.toFixed(0)}% ${historyDirection}, which is supporting the same continuation into the next candle.`;
    return;
  }

  els.mainReaderText.textContent = `Reader check: wick/body ${metrics.wickBodyRatio.toFixed(2)}x, delta ${metrics.delta.toFixed(2)}, volume ${metrics.volumePercent.toFixed(0)}%, liquidity ${metrics.liquidityPercent.toFixed(0)}%, pressure ${metrics.pressure.toFixed(0)}%. ${directionalPct.toFixed(0)}% is pressing ${metrics.direction}, while stock history is ${historyBias.toFixed(0)}% ${historyDirection}. The main reader only turns fully green when live pressure and ticker history align.`;
}

function updateVerdictReader(metrics, contract) {
  const verdict = metrics.directionVerdict || {
    label: `${capitalize(metrics.direction)} but not decisive yet`,
    confidence: Math.max(50, Math.min(95, Math.round(metrics.pressure || 0))),
    summary: "The board is still waiting for a cleaner lock between direction, wick, and live pressure."
  };
  const opportunity = getOpportunityProfile(metrics, contract);
  const isStrong = verdict.confidence >= 78;
  const isWarning = verdict.confidence < 62;
  setReaderBand(els.verdictReader, isStrong ? opportunity.band : "off", metrics.direction);
  els.verdictReader.classList.toggle("is-warning", isWarning);
  els.verdictStatus.textContent = `${verdict.label} • ${verdict.confidence}% confidence`;
  setReaderMetricLine(els.verdictMetrics, [
    `3 day ${metrics.historicalContext?.threeDayDirection || metrics.direction}`,
    `Push ${Number(metrics.sessionFlow?.directionalPushPercent || 0).toFixed(0)}%`,
    `Ceiling $${Number(metrics.historicalContext?.ceiling || 0).toFixed(2)}`,
    `Floor $${Number(metrics.historicalContext?.floor || 0).toFixed(2)}`
  ]);
  els.verdictText.textContent = verdict.summary;
}

function updateForecastReader(metrics) {
  const forecast = metrics.volumeForecast || {};
  const status = forecast.status || "inactive";
  const isLive = status === "live_window";
  const isPredictive = status === "predictive";
  setReaderBand(els.forecastReader, isLive || isPredictive ? "light" : "off", metrics.direction);
  els.forecastReader.classList.toggle("is-warning", !isLive && !isPredictive);
  els.forecastStatus.textContent = forecast.label || "Waiting for volume forecast";
  setReaderMetricLine(els.forecastMetrics, [
    `30-60m push ${Number(metrics.sessionFlow?.hourVolumePercent || 0).toFixed(0)}%`,
    `Window ${forecast.status || "inactive"}`,
    `Vol ${Number(forecast.projectedVolume || forecast.realizedVolume || 0).toLocaleString()}`,
    `3 day ${metrics.historicalContext?.threeDayLabel || "trend"}`
  ]);
  els.forecastText.textContent = forecast.summary || "The board is waiting for enough historical candles to estimate the opening-bell or 2:00 PM volume window.";
}

function updateStrikeReader(metrics, contract) {
  const config = state.tradeConfig;
  const chosenDirectionMatches = config.direction === metrics.direction;
  const strikeDistance = Math.abs((metrics.underlyingPrice ?? 0) - Number(config.strikePrice || 0));
  const strikeDistancePercent = (metrics.underlyingPrice ?? 0) > 0
    ? (strikeDistance / metrics.underlyingPrice) * 100
    : 100;
  const strikeIsNear = strikeDistancePercent <= 6;
  const strikeSupported = chosenDirectionMatches && strikeIsNear && metrics.wickSizeQualified && metrics.continuationReady;
  const opportunity = getOpportunityProfile(metrics, contract, config);
  const estimatedProfit = opportunity.estimatedProfit;
  const estimatedMovePct = opportunity.estimatedMovePercent;
  const history = metrics.historicalContext || {};
  const historyDirection = history.direction || "neutral";
  const historyBias = Number(history.biasStrength || 0) * 100;
  const band = strikeSupported ? opportunity.band : "off";

  setReaderBand(els.strikeReader, band, metrics.direction);
  setReaderMetricLine(els.strikeMetrics, [
    `Strike ${Number(config.strikePrice || 0).toFixed(2)}`,
    `Distance ${strikeDistancePercent.toFixed(2)}%`,
    `Move ${estimatedMovePct.toFixed(1)}%`,
    `Payout $${estimatedProfit.toFixed(0)}`
  ]);
  els.strikeReaderStatus.textContent = strikeSupported
    ? `Chosen strike supported • est. $${estimatedProfit.toFixed(0)}`
    : chosenDirectionMatches
      ? "Pressure is not fully supporting this strike yet"
      : "Direction mismatch with chosen option";

  const underlyingText = metrics.underlyingPrice ? `$${metrics.underlyingPrice.toFixed(2)}` : "unknown";
  els.strikeReaderText.textContent = strikeSupported
    ? `Your selected ${config.direction === "bullish" ? "call" : "put"} strike at $${Number(config.strikePrice || 0).toFixed(2)} is lining up with the current pressure read. Underlying price ${underlyingText}, strike distance ${strikeDistancePercent.toFixed(2)}%, estimated option move ${estimatedMovePct.toFixed(1)}%, estimated money result $${estimatedProfit.toFixed(0)} if the next candle follows through. Stock history bias ${historyBias.toFixed(0)}% ${historyDirection} is confirming the same move.`
    : `Chosen strike $${Number(config.strikePrice || 0).toFixed(2)} with ${config.direction === "bullish" ? "call" : "put"} direction is being checked against underlying price ${underlyingText}. Strike distance is ${strikeDistancePercent.toFixed(2)}%, estimated option move ${estimatedMovePct.toFixed(1)}%, and stock history bias ${historyBias.toFixed(0)}% ${historyDirection} is being used to counterbalance the live continuation read.`;
}

function syncTradeConfigFromInputs() {
  state.tradeConfig = {
    budget: Number(els.budgetInput.value || 0),
    symbol: (els.manualSymbolInput.value || "").trim().toUpperCase() || "ENPH",
    direction: els.directionSelect.value,
    strikePrice: Number(els.strikeInput.value || 0),
    rangeStart: Number(els.rangeStartInput.value || 0),
    rangeEnd: Number(els.rangeEndInput.value || 0),
    expiration: els.expirationInput.value,
    targetGain: Number(els.targetGainInput.value || 0)
  };
}

function getConfiguredDistance() {
  const { rangeStart, rangeEnd } = state.tradeConfig;
  return Math.abs(Number(rangeEnd || 0) - Number(rangeStart || 0));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function loadTicker(ticker) {
  const normalized = ticker.trim().toUpperCase() || "SPY";
  state.ticker = normalized;
  state.loading = true;
  els.errorBanner.hidden = true;
  els.marketStatus.textContent = "Refreshing market data...";
  subscribeLiveTicker(normalized);

  try {
    const dashboard = await fetchDashboard(normalized);
    state.dashboard = dashboard;
    state.candles = dashboard.candles || [];
    drawChart();
    updateUi();
  } catch (error) {
    state.dashboard = {
      candles: state.candles,
      topCandidates: state.dashboard?.topCandidates || [],
      metrics: state.dashboard?.metrics || {
        delta: 0,
        volumePercent: 0,
        liquidityPercent: 0,
        pressure: 0,
        pressureHint: "Unable to compute pressure",
        direction: "bullish",
        projectedUnderlyingMove: 0,
        continuationReady: false,
        wickSupportsDirection: false,
        volumeHint: "No data",
        liquidityHint: "No data",
        historicalContext: {},
        sessionFlow: {},
        flags: {
          deltaBias: false,
          volumeBurst: false,
          liquidityShift: false,
          pressureOverdrive: false,
          wickStructure: false,
          trendAcceptance: false,
          reversalFailure: false
        }
      },
      contract: state.dashboard?.contract || null,
      marketStatus: "Polygon request failed",
      error: error.message
    };
    updateUi();
    drawChart();
  } finally {
    state.loading = false;
  }
}

function connectLiveSocket() {
  if (state.liveSocket && (state.liveSocket.readyState === WebSocket.OPEN || state.liveSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}/live`);
  state.liveSocket = socket;

  socket.addEventListener("open", () => {
    subscribeLiveTicker(state.ticker);
  });

  socket.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === "flow" && payload.ticker === state.ticker) {
        state.liveStreamError = "";
        state.dashboard = {
          ...(state.dashboard || {}),
          orderFlow: payload.orderFlow
        };
        renderOrderFlow(payload.orderFlow);
      } else if (payload.type === "stream_status") {
        state.liveStreamError = payload.error || "";
        renderOrderFlow(state.dashboard?.orderFlow);
      }
    } catch (error) {
      // Ignore malformed live messages.
    }
  });

  socket.addEventListener("close", () => {
    if (state.liveSocket === socket) {
      state.liveSocket = null;
    }
    window.setTimeout(connectLiveSocket, 1500);
  });

  socket.addEventListener("error", () => {
    socket.close();
  });
}

function subscribeLiveTicker(ticker) {
  if (!state.liveSocket || state.liveSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  state.liveSocket.send(JSON.stringify({
    action: "subscribe",
    ticker
  }));
}

function scheduleRefresh() {
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = window.setInterval(() => {
    if (!state.loading && !document.hidden) {
      loadTicker(state.ticker);
    }
  }, LIVE_REFRESH_MS);
}

els.applyTickerBtn.addEventListener("click", () => {
  loadTicker(els.tickerInput.value);
});

els.armTradeBtn.addEventListener("click", () => {
  state.tradeArmed = !state.tradeArmed;
  if (state.dashboard?.metrics) {
    updateTouchTradePanel(state.dashboard.metrics);
  }
});

[
  els.budgetInput,
  els.manualSymbolInput,
  els.directionSelect,
  els.strikeInput,
  els.rangeStartInput,
  els.rangeEndInput,
  els.expirationInput,
  els.targetGainInput
].forEach((element) => {
  element.addEventListener("input", () => {
    syncTradeConfigFromInputs();
    if (element === els.manualSymbolInput) {
      els.tickerInput.value = state.tradeConfig.symbol;
    }
    if (state.dashboard?.metrics) {
      updateMainReader(state.dashboard.metrics, state.dashboard.contract);
      updateStrikeReader(state.dashboard.metrics, state.dashboard.contract);
      updateTradeDecision(state.dashboard.metrics, state.dashboard.contract);
      renderPressureStack(state.dashboard.metrics, state.dashboard.contract);
    }
  });
});

els.tickerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadTicker(els.tickerInput.value);
  }
});

window.addEventListener("resize", drawChart);

syncTradeConfigFromInputs();
renderHistoryTable();
drawChart();
connectLiveSocket();
loadTicker(state.tradeConfig.symbol);
scheduleRefresh();


