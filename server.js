const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};
const TOP_CANDIDATE_UNIVERSE = [
  "SOFI", "PINS", "RBLX", "PATH", "U", "SNAP", "PLTR", "AFRM", "HOOD", "CFLT",
  "LYFT", "UBER", "RIOT", "MARA", "F", "LCID", "RUN", "CHWY", "FUBO", "W",
  "SHOP", "SQ", "NIO", "DKNG", "ROKU", "SNOW", "AI", "HIMS", "CVNA", "UPST",
  "ASTS", "TLRY", "AAL", "CCL", "DAL", "PFE", "BBAI", "SOUN", "CRSR", "RIVN",
  "AMD", "INTC", "NVDA", "AAPL", "TSLA", "QQQ", "IWM", "SPY", "SMCI", "COIN"
];
const CRYPTO_CANDIDATE_UNIVERSE = [
  "X:BTCUSD", "X:ETHUSD", "X:SOLUSD", "X:XRPUSD", "X:ADAUSD", "X:DOGEUSD", "X:AVAXUSD", "X:LINKUSD",
  "X:LTCUSD", "X:BCHUSD", "X:DOTUSD", "X:MATICUSD", "X:ATOMUSD", "X:UNIUSD", "X:NEARUSD", "X:APTUSD",
  "X:HBARUSD", "X:TRXUSD", "X:SHIBUSD", "X:PEPEUSD"
];
const FOREX_CANDIDATE_UNIVERSE = [
  "C:EURUSD", "C:GBPUSD", "C:USDJPY", "C:AUDUSD", "C:USDCAD", "C:USDCHF", "C:NZDUSD", "C:EURJPY",
  "C:GBPJPY", "C:EURGBP", "C:AUDJPY", "C:CHFJPY", "C:EURAUD", "C:EURNZD", "C:GBPAUD", "C:GBPCAD",
  "C:XAUUSD", "C:USDNOK", "C:USDSEK", "C:USDMXN"
];

loadEnvFile();

const apiKey = process.env.POLYGON_API_KEY;
const alpacaKeyId = process.env.ALPACA_API_KEY_ID;
const alpacaSecretKey = process.env.ALPACA_API_SECRET_KEY;
if (!apiKey) {
  console.error("Missing POLYGON_API_KEY in environment or .env file.");
}

const liveClients = new Set();
const streamStateByTicker = new Map();
let polygonSocket = null;
let polygonAuthorized = false;
let polygonConnected = false;
let polygonSubscribed = new Set();
let polygonStreamError = "";
const liveProvider = alpacaKeyId && alpacaSecretKey ? "alpaca" : "polygon";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/options-dashboard") {
    return handleDashboard(url, res);
  }

  if (url.pathname === "/healthz") {
    return sendJson(res, 200, { ok: true, liveProvider });
  }

  return serveStatic(url.pathname, res);
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/live") {
    socket.destroy();
    return;
  }

  handleWebSocketUpgrade(req, socket);
});

server.listen(PORT, () => {
  console.log(`Anthony Figueroa Market listening on http://localhost:${PORT}`);
});

async function handleDashboard(url, res) {
  if (!apiKey) {
    return sendJson(res, 500, { error: "Polygon API key is missing. Add POLYGON_API_KEY to .env." });
  }

  const ticker = (url.searchParams.get("ticker") || "SPY").trim().toUpperCase();

  try {
    const payload = await buildDashboardPayload(ticker);
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      error: error.message || "Polygon request failed."
    });
  }
}

async function buildDashboardPayload(ticker) {
  const now = new Date();
  const fromDate = shiftDate(now, -7);
  const toDate = formatDate(now);
  const expiryFloor = formatDate(now);

  const underlyingAggUrl = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/30/minute/${fromDate}/${toDate}`);
  underlyingAggUrl.searchParams.set("adjusted", "true");
  underlyingAggUrl.searchParams.set("sort", "asc");
  underlyingAggUrl.searchParams.set("limit", "120");
  underlyingAggUrl.searchParams.set("apiKey", apiKey);

  const recentTradesUrl = new URL(`https://api.polygon.io/v3/trades/${encodeURIComponent(ticker)}`);
  recentTradesUrl.searchParams.set("limit", "15");
  recentTradesUrl.searchParams.set("order", "desc");
  recentTradesUrl.searchParams.set("sort", "participant_timestamp");
  recentTradesUrl.searchParams.set("apiKey", apiKey);

  const callChainUrl = new URL(`https://api.polygon.io/v3/snapshot/options/${encodeURIComponent(ticker)}`);
  callChainUrl.searchParams.set("contract_type", "call");
  callChainUrl.searchParams.set("expiration_date.gte", expiryFloor);
  callChainUrl.searchParams.set("limit", "250");
  callChainUrl.searchParams.set("sort", "expiration_date");
  callChainUrl.searchParams.set("order", "asc");
  callChainUrl.searchParams.set("apiKey", apiKey);

  const putChainUrl = new URL(`https://api.polygon.io/v3/snapshot/options/${encodeURIComponent(ticker)}`);
  putChainUrl.searchParams.set("contract_type", "put");
  putChainUrl.searchParams.set("expiration_date.gte", expiryFloor);
  putChainUrl.searchParams.set("limit", "250");
  putChainUrl.searchParams.set("sort", "expiration_date");
  putChainUrl.searchParams.set("order", "asc");
  putChainUrl.searchParams.set("apiKey", apiKey);

  const underlyingAggs = await fetchJson(underlyingAggUrl);

  const underlyingBars = (underlyingAggs.results || []).map(mapAggregate);
  if (underlyingBars.length < 4) {
    throw new Error(`Not enough aggregate bars found for ${ticker}.`);
  }

  const underlyingPrice = underlyingBars[underlyingBars.length - 1].close;
  const historicalContext = buildHistoricalContext(underlyingBars);
  const orderFlow = await fetchOrderFlow(recentTradesUrl, underlyingPrice);
  const topCandidatesPromise = buildTopCandidates(ticker).catch(() => []);
  const cryptoCandidatesPromise = buildCryptoCandidates().catch(() => []);
  const forexCandidatesPromise = buildForexCandidates().catch(() => []);
  try {
    const [callChain, putChain] = await Promise.all([
      fetchJson(callChainUrl),
      fetchJson(putChainUrl)
    ]);

    const selected = selectContract(ticker, underlyingPrice, callChain.results || [], putChain.results || []);

    const optionAggUrl = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(selected.optionsTicker)}/range/30/minute/${fromDate}/${toDate}`);
    optionAggUrl.searchParams.set("adjusted", "true");
    optionAggUrl.searchParams.set("sort", "asc");
    optionAggUrl.searchParams.set("limit", "120");
    optionAggUrl.searchParams.set("apiKey", apiKey);

    const optionAggs = await fetchJson(optionAggUrl);
    const candles = (optionAggs.results || []).map(mapAggregate);
    const chartCandles = candles.length >= 6 ? candles : underlyingBars;

    const metrics = deriveMetrics(chartCandles, selected, underlyingPrice, historicalContext);
    const marketStatus = buildMarketStatus(optionAggs, candles.length, chartCandles === underlyingBars, ticker);
    const [topCandidates, cryptoCandidates, forexCandidates] = await Promise.all([
      topCandidatesPromise,
      cryptoCandidatesPromise,
      forexCandidatesPromise
    ]);

    return {
      ticker,
      contract: selected,
      candles: chartCandles,
      orderFlow,
      topCandidates,
      cryptoCandidates,
      forexCandidates,
      marketStatus,
      error: candles.length >= 6 ? "" : `Using ${ticker} underlying bars because the option contract returned limited candle history.`,
      metrics
    };
  } catch (error) {
    if (!String(error.message || "").includes("NOT_AUTHORIZED")) {
      throw error;
    }

    const [topCandidates, cryptoCandidates, forexCandidates] = await Promise.all([
      topCandidatesPromise,
      cryptoCandidatesPromise,
      forexCandidatesPromise
    ]);

    return {
      ticker,
      contract: null,
      candles: underlyingBars,
      orderFlow,
      topCandidates,
      cryptoCandidates,
      forexCandidates,
      marketStatus: `${ticker} stock candles loaded`,
      error: "Your Polygon key is not entitled to options snapshot/greeks data on the current plan. The dashboard is using stock candles only until the plan is upgraded or a different options provider is connected.",
      metrics: deriveFallbackMetrics(underlyingBars, historicalContext)
    };
  }
}

function handleWebSocketUpgrade(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n"
  ].join("\r\n"));

  socket.setNoDelay(true);
  socket._buffer = Buffer.alloc(0);
  socket._ticker = "SPY";
  liveClients.add(socket);
  ensurePolygonSocket();
  refreshPolygonSubscriptions();
  sendToClient(socket, { type: "connected", ticker: socket._ticker });

  socket.on("data", (chunk) => {
    socket._buffer = Buffer.concat([socket._buffer, chunk]);
    const { messages, remaining } = decodeWebSocketFrames(socket._buffer);
    socket._buffer = remaining;

    for (const message of messages) {
      handleClientMessage(socket, message);
    }
  });

  socket.on("close", () => {
    liveClients.delete(socket);
    refreshPolygonSubscriptions();
  });

  socket.on("end", () => {
    liveClients.delete(socket);
    refreshPolygonSubscriptions();
  });

  socket.on("error", () => {
    liveClients.delete(socket);
    refreshPolygonSubscriptions();
  });
}

function handleClientMessage(socket, message) {
  try {
    const payload = JSON.parse(message);
    if (payload.action === "subscribe" && payload.ticker) {
      socket._ticker = String(payload.ticker).trim().toUpperCase() || "SPY";
      ensurePolygonSocket();
      refreshPolygonSubscriptions();

      const snapshot = streamStateByTicker.get(socket._ticker);
      if (snapshot) {
        sendToClient(socket, {
          type: "flow",
          ticker: socket._ticker,
          orderFlow: snapshot
        });
      }
    }
  } catch (error) {
    // Ignore malformed client frames.
  }
}

function ensurePolygonSocket() {
  if (polygonSocket && (polygonSocket.readyState === WebSocket.OPEN || polygonSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const socketUrl = liveProvider === "alpaca"
    ? "wss://stream.data.alpaca.markets/v2/iex"
    : "wss://socket.polygon.io/stocks";

  polygonSocket = new WebSocket(socketUrl);
  polygonAuthorized = false;
  polygonConnected = false;
  polygonSubscribed = new Set();
  polygonStreamError = "";

  polygonSocket.addEventListener("open", () => {
    polygonConnected = true;
    if (liveProvider === "alpaca") {
      polygonSocket.send(JSON.stringify({
        action: "auth",
        key: alpacaKeyId,
        secret: alpacaSecretKey
      }));
      return;
    }

    polygonSocket.send(JSON.stringify({
      action: "auth",
      params: apiKey
    }));
  });

  polygonSocket.addEventListener("message", (event) => {
    processPolygonMessage(event.data);
  });

  polygonSocket.addEventListener("close", () => {
    polygonConnected = false;
    polygonAuthorized = false;
    polygonSubscribed = new Set();
    polygonSocket = null;

    setTimeout(() => {
      if (liveClients.size) {
        ensurePolygonSocket();
      }
    }, 2000);
  });

  polygonSocket.addEventListener("error", () => {
    // Reconnect via close handler.
  });
}

function processPolygonMessage(rawMessage) {
  let payload;
  try {
    payload = JSON.parse(rawMessage);
  } catch (error) {
    return;
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  for (const message of messages) {
    if (message.ev === "status" || message.T === "success" || message.T === "error") {
      const status = String(message.status || "").toLowerCase();
      const statusMessage = String(message.message || message.msg || "");
      const statusText = `${status} ${statusMessage}`.toLowerCase();

      if (status === "auth_success" || statusText.includes("authenticated")) {
        polygonAuthorized = true;
        polygonStreamError = "";
        refreshPolygonSubscriptions();
      } else if (status === "auth_failed" || statusText.includes("auth failed") || statusText.includes("insufficient subscription")) {
        polygonAuthorized = false;
        polygonStreamError = statusMessage || "Polygon WebSocket auth failed.";
        broadcastStreamStatus();
      }
      continue;
    }

    if (message.ev === "T" || message.ev === "Q" || message.T === "t" || message.T === "q") {
      const ticker = String(message.sym || message.S || "").toUpperCase();
      if (!ticker) {
        continue;
      }

      const nextState = updateLiveStreamState(ticker, message);
      broadcastFlowUpdate(ticker, nextState);
    }
  }
}

function broadcastStreamStatus() {
  for (const client of liveClients) {
    sendToClient(client, {
      type: "stream_status",
      error: polygonStreamError
    });
  }
}

function refreshPolygonSubscriptions() {
  if (!polygonSocket || polygonSocket.readyState !== WebSocket.OPEN || !polygonAuthorized) {
    return;
  }

  const activeTickers = new Set(
    [...liveClients]
      .map((client) => client._ticker)
      .filter(Boolean)
  );

  const subscribeTickers = [...activeTickers].filter((ticker) => !polygonSubscribed.has(ticker));
  const unsubscribeTickers = [...polygonSubscribed].filter((ticker) => !activeTickers.has(ticker));

  if (subscribeTickers.length) {
    if (liveProvider === "alpaca") {
      polygonSocket.send(JSON.stringify({
        action: "subscribe",
        trades: subscribeTickers,
        quotes: subscribeTickers
      }));
    } else {
      const params = subscribeTickers.flatMap((ticker) => [`T.${ticker}`, `Q.${ticker}`]).join(",");
      polygonSocket.send(JSON.stringify({
        action: "subscribe",
        params
      }));
    }
    subscribeTickers.forEach((ticker) => polygonSubscribed.add(ticker));
  }

  if (unsubscribeTickers.length) {
    if (liveProvider === "alpaca") {
      polygonSocket.send(JSON.stringify({
        action: "unsubscribe",
        trades: unsubscribeTickers,
        quotes: unsubscribeTickers
      }));
    } else {
      const params = unsubscribeTickers.flatMap((ticker) => [`T.${ticker}`, `Q.${ticker}`]).join(",");
      polygonSocket.send(JSON.stringify({
        action: "unsubscribe",
        params
      }));
    }
    unsubscribeTickers.forEach((ticker) => polygonSubscribed.delete(ticker));
  }
}

function updateLiveStreamState(ticker, message) {
  const current = streamStateByTicker.get(ticker) || createEmptyStreamState();

  if (message.ev === "Q" || message.T === "q") {
    current.bidPrice = Number(message.bp || current.bidPrice || 0);
    current.askPrice = Number(message.ap || current.askPrice || 0);
    current.bidSize = Number(message.bs || 0) * 100;
    current.askSize = Number(message.as || 0) * 100;
    current.lastQuoteTimestamp = normalizePolygonTimestamp(message.t || 0);
  }

  if (message.ev === "T" || message.T === "t") {
    const trade = {
      side: classifyTradeSide(message, current),
      price: Number(message.p || 0),
      size: Number(message.s || 0),
      timestamp: normalizePolygonTimestamp(message.t || 0)
    };

    current.lastTradePrice = trade.price;
    current.tape = [trade, ...current.tape].slice(0, 15);
  }

  applyFlowTotals(current);
  streamStateByTicker.set(ticker, current);
  return current;
}

function createEmptyStreamState() {
  return {
    tape: [],
    bidPrice: 0,
    askPrice: 0,
    bidSize: 0,
    askSize: 0,
    buyPercent: 50,
    sellPercent: 50,
    buyCount: 0,
    sellCount: 0,
    buySize: 0,
    sellSize: 0,
    quoteBuyPercent: 50,
    quoteSellPercent: 50,
    dominance: "balanced",
    dominanceScore: 0,
    lastTradePrice: 0,
    lastQuoteTimestamp: 0
  };
}

function classifyTradeSide(message, current) {
  const tradePrice = Number(message.p || 0);
  const bid = Number(current.bidPrice || 0);
  const ask = Number(current.askPrice || 0);

  if (ask > 0 && tradePrice >= ask) {
    return "buy";
  }
  if (bid > 0 && tradePrice <= bid) {
    return "sell";
  }
  if (current.lastTradePrice && tradePrice > current.lastTradePrice) {
    return "buy";
  }
  if (current.lastTradePrice && tradePrice < current.lastTradePrice) {
    return "sell";
  }

  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : tradePrice;
  return tradePrice >= mid ? "buy" : "sell";
}

function applyFlowTotals(state) {
  const buyTrades = state.tape.filter((trade) => trade.side === "buy");
  const sellTrades = state.tape.filter((trade) => trade.side === "sell");
  const tradeBuySize = buyTrades.reduce((sum, trade) => sum + trade.size, 0);
  const tradeSellSize = sellTrades.reduce((sum, trade) => sum + trade.size, 0);
  const totalTradeSize = Math.max(1, tradeBuySize + tradeSellSize);
  const tradeBuyPercent = (tradeBuySize / totalTradeSize) * 100;
  const tradeSellPercent = (tradeSellSize / totalTradeSize) * 100;
  const quoteTotal = Math.max(1, state.bidSize + state.askSize);
  const quoteBuyPercent = (state.bidSize / quoteTotal) * 100;
  const quoteSellPercent = (state.askSize / quoteTotal) * 100;
  const combinedBuyPercent = (tradeBuyPercent * 0.65) + (quoteBuyPercent * 0.35);
  const combinedSellPercent = 100 - combinedBuyPercent;

  state.buyCount = buyTrades.length;
  state.sellCount = sellTrades.length;
  state.buySize = tradeBuySize;
  state.sellSize = tradeSellSize;
  state.quoteBuyPercent = quoteBuyPercent;
  state.quoteSellPercent = quoteSellPercent;
  state.buyPercent = combinedBuyPercent;
  state.sellPercent = combinedSellPercent;
  state.dominanceScore = Math.abs(combinedBuyPercent - combinedSellPercent);
  state.dominance = combinedBuyPercent > combinedSellPercent + 8
    ? "buyers"
    : combinedSellPercent > combinedBuyPercent + 8
      ? "sellers"
      : "balanced";
}

function broadcastFlowUpdate(ticker, orderFlow) {
  const payload = JSON.stringify({
    type: "flow",
    ticker,
    orderFlow
  });

  for (const client of liveClients) {
    if (client._ticker === ticker) {
      sendToClient(client, payload, true);
    }
  }
}

function sendToClient(socket, payload, isSerialized = false) {
  if (socket.destroyed || socket.writableEnded) {
    return;
  }

  const text = isSerialized ? payload : JSON.stringify(payload);
  socket.write(encodeWebSocketFrame(text));
}

function encodeWebSocketFrame(data) {
  const payload = Buffer.from(data);
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function decodeWebSocketFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) {
        break;
      }
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) {
        break;
      }
      payloadLength = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;
    if (offset + frameLength > buffer.length) {
      break;
    }

    if (opcode === 0x8) {
      offset += frameLength;
      continue;
    }

    let payload = buffer.slice(offset + headerLength + maskLength, offset + frameLength);
    if (masked) {
      const mask = buffer.slice(offset + headerLength, offset + headerLength + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    if (opcode === 0x1) {
      messages.push(payload.toString("utf8"));
    }
    offset += frameLength;
  }

  return {
    messages,
    remaining: buffer.slice(offset)
  };
}

async function fetchOrderFlow(recentTradesUrl, underlyingPrice) {
  try {
    const tradesPayload = await fetchJson(recentTradesUrl);
    return deriveOrderFlow((tradesPayload.results || []).map(mapTrade), underlyingPrice);
  } catch (error) {
    return deriveOrderFlow([], underlyingPrice, error.message || "Unable to load recent trades.");
  }
}

function selectContract(ticker, underlyingPrice, calls, puts) {
  const mappedCalls = calls.map((item) => mapSnapshot(item, "call", underlyingPrice));
  const mappedPuts = puts.map((item) => mapSnapshot(item, "put", underlyingPrice));

  const topCalls = mappedCalls.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 15);
  const topPuts = mappedPuts.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 15);

  if (!topCalls.length && !topPuts.length) {
    throw new Error(`No option snapshots were returned for ${ticker}.`);
  }

  const callPressure = totalPressure(topCalls);
  const putPressure = totalPressure(topPuts);
  const direction = callPressure >= putPressure ? "bullish" : "bearish";
  const selectedPool = direction === "bullish" ? topCalls : topPuts;
  const selected = selectedPool[0] || topCalls[0] || topPuts[0];

  return {
    ...selected,
    chainDirection: direction,
    callPressure,
    putPressure
  };
}

function totalPressure(contracts) {
  return contracts.reduce((sum, contract) => sum + contract.activityScore * Math.max(0.12, Math.abs(contract.delta)), 0);
}

function mapSnapshot(item, contractType, underlyingPrice) {
  if (!item || !item.details || !item.details.ticker || !item.day) {
    return null;
  }

  const strikePrice = Number(item.details.strike_price || 0);
  const deltaRaw = Number(item.greeks?.delta ?? (contractType === "call" ? 0.45 : -0.45));
  const delta = Math.max(-1, Math.min(1, deltaRaw));
  const volume = Number(item.day.volume || 0);
  const openInterest = Number(item.open_interest || 0);
  const bid = Number(item.last_quote?.bid || 0);
  const ask = Number(item.last_quote?.ask || 0);
  const spread = ask > 0 && bid > 0 ? ask - bid : 0.2;
  const bidSize = Number(item.last_quote?.bid_size || 0);
  const askSize = Number(item.last_quote?.ask_size || 0);
  const quoteDepth = bidSize + askSize;
  const strikeDistance = Math.abs(strikePrice - underlyingPrice);
  const daysToExpiry = Math.max(1, daysBetween(new Date(), new Date(item.details.expiration_date)));
  const closeness = 1 / (1 + strikeDistance);
  const expiryWeight = 1 / daysToExpiry;
  const activityScore = volume * 0.65 + openInterest * 0.35 + quoteDepth * 12;
  const score = activityScore * (0.9 + closeness * 3.2 + expiryWeight * 8) / (1 + spread * 3);

  return {
    optionsTicker: item.details.ticker,
    contractType,
    expirationDate: item.details.expiration_date,
    strikePrice,
    delta,
    volume,
    openInterest,
    bid,
    ask,
    spread,
    quoteDepth,
    activityScore,
    score
  };
}

function deriveMetrics(candles, contract, underlyingPrice, historicalContext) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;
  const recent = candles.slice(-6);
  const avgVolume = average(candles.slice(-12).map((candle) => candle.volume || 0)) || 1;
  const trendSlope = recent.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
  const direction = contract.chainDirection || (trendSlope >= 0 ? "bullish" : "bearish");
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const candleBody = Math.max(Math.abs(last.close - last.open), 0.0001);
  const candleRange = Math.max(0, last.high - last.low);
  const dominantWick = direction === "bullish" ? lowerWick : upperWick;
  const wickBodyRatio = dominantWick / candleBody;
  const wickSupportsDirection = direction === "bullish" ? lowerWick > upperWick * 1.1 : upperWick > lowerWick * 1.1;
  const wickSizeQualified = wickBodyRatio >= 0.75;
  const wickWindow = getWickWindow(last.timestamp);
  const volumeRatio = (last.volume || avgVolume) / avgVolume;
  const chainDelta = contract.callPressure + contract.putPressure > 0
    ? (contract.callPressure - contract.putPressure) / (contract.callPressure + contract.putPressure)
    : contract.delta;
  const delta = Math.max(-1, Math.min(1, chainDelta));
  const liquidityBase = ((contract.quoteDepth * 6) + (contract.openInterest / 8) + (contract.volume / 6)) / (1 + contract.spread * 18);
  const liquidityPercent = Math.max(0, Math.min(100, Math.log10(1 + Math.max(1, liquidityBase)) * 34));
  const historyWeight = historicalContext.biasStrength;
  const historyDirectionMatch = historicalContext.direction === direction;
  const pressure = Math.max(0, Math.min(100,
    Math.abs(delta) * 38 +
    Math.min(2.4, volumeRatio) * 22 +
    (liquidityPercent / 100) * 26 +
    (wickSupportsDirection ? 10 : 0) +
    (Math.abs(trendSlope) > Math.abs(last.close - prev.close) ? 7 : 0) +
    (historyDirectionMatch ? historyWeight * 10 : -historyWeight * 8)
  ));

  const continuationReady = wickSupportsDirection && wickSizeQualified && wickWindow.isEligible && volumeRatio > 1.04 && Math.abs(delta) > 0.22 && pressure > 60;
  const priceGap = Math.abs(contract.strikePrice - underlyingPrice);
  const directionVerdict = buildDirectionVerdict({
    direction,
    pressure,
    delta,
    volumeRatio,
    liquidityPercent,
    wickSupportsDirection,
    wickSizeQualified,
    continuationReady,
    historicalContext,
    contractVolume: Number(contract.volume || 0)
  });
  const volumeForecast = buildVolumeForecast(candles);
  const sessionFlow = buildSessionFlow(candles, direction, historicalContext);
  const projectedUnderlyingMove = Math.max(0, historicalContext.volatility * (pressure / 100) * (1.1 + Math.abs(delta) * 0.55));
  const topBottomSignal = buildTopBottomSignal({
    candles,
    direction,
    pressure,
    delta,
    volumeRatio,
    wickSupportsDirection,
    wickSizeQualified,
    historicalContext,
    sessionFlow,
    contractVolume: Number(contract.volume || 0),
    quoteDepth: Number(contract.quoteDepth || 0),
    openInterest: Number(contract.openInterest || 0)
  });

  return {
    delta,
    volumePercent: Math.min(250, volumeRatio * 100),
    volumeHint: volumeRatio > 1.35
      ? "Volume is clearly above the 30m baseline and supporting continuation"
      : volumeRatio > 1.05
        ? "Volume is slightly above baseline but still needs expansion"
        : "Volume is under the breakout threshold right now",
    liquidityPercent,
    liquidityHint: liquidityPercent > 65 ? "Options book is strong enough to carry the move" : "Liquidity is tradable but not fully supportive yet",
    pressure,
    pressureHint: pressure > 74 ? "Pressure is decisive and aligned with the tape" : pressure > 58 ? "Pressure leans in one direction but still needs confirmation" : "Pressure is still too mixed for a clean continuation call",
    direction,
    directionVerdict,
    volumeForecast,
    sessionFlow,
    topBottomSignal,
    continuationReady,
    wickSupportsDirection,
    wickSizeQualified,
    wickBodyRatio,
    candleRange,
    underlyingPrice,
    historicalContext,
    wickWindowLabel: wickWindow.label,
    minutesToClose: wickWindow.minutesToClose,
    projectedUnderlyingMove,
    flags: {
      deltaBias: Math.abs(delta) > 0.28,
      volumeBurst: volumeRatio > 1.18,
      liquidityShift: liquidityPercent > 56,
      pressureOverdrive: pressure > 69,
      wickStructure: wickSupportsDirection && wickSizeQualified,
      trendAcceptance: Math.abs(trendSlope) > 0.8,
      reversalFailure: pressure > 57 && Math.abs(delta) > 0.18 && priceGap < Math.max(underlyingPrice * 0.035, 3)
    }
  };
}

function deriveFallbackMetrics(candles, historicalContext) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] || last;
  const recent = candles.slice(-6);
  const avgVolume = average(candles.slice(-12).map((candle) => candle.volume || 0)) || 1;
  const trendSlope = recent.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
  const direction = trendSlope >= 0 ? "bullish" : "bearish";
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const candleBody = Math.max(Math.abs(last.close - last.open), 0.0001);
  const candleRange = Math.max(0, last.high - last.low);
  const dominantWick = direction === "bullish" ? lowerWick : upperWick;
  const wickBodyRatio = dominantWick / candleBody;
  const wickSupportsDirection = direction === "bullish" ? lowerWick > upperWick * 1.1 : upperWick > lowerWick * 1.1;
  const wickSizeQualified = wickBodyRatio >= 0.75;
  const wickWindow = getWickWindow(last.timestamp);
  const volumeRatio = (last.volume || avgVolume) / avgVolume;
  const delta = Math.max(-1, Math.min(1, trendSlope / Math.max(1, last.close * 0.05)));
  const liquidityPercent = 0;
  const historyWeight = historicalContext.biasStrength;
  const historyDirectionMatch = historicalContext.direction === direction;
  const pressure = Math.max(0, Math.min(100,
    Math.abs(delta) * 40 +
    Math.min(2.4, volumeRatio) * 24 +
    (wickSupportsDirection ? 12 : 0) +
    (historyDirectionMatch ? historyWeight * 10 : -historyWeight * 8)
  ));

  const continuationReady = wickSupportsDirection && wickSizeQualified && wickWindow.isEligible && volumeRatio > 1.04 && Math.abs(delta) > 0.18;
  const directionVerdict = buildDirectionVerdict({
    direction,
    pressure,
    delta,
    volumeRatio,
    liquidityPercent,
    wickSupportsDirection,
    wickSizeQualified,
    continuationReady,
    historicalContext,
    contractVolume: 0
  });
  const volumeForecast = buildVolumeForecast(candles);
  const sessionFlow = buildSessionFlow(candles, direction, historicalContext);
  const projectedUnderlyingMove = Math.max(0, historicalContext.volatility * (pressure / 100) * (1.05 + Math.abs(delta) * 0.45));
  const topBottomSignal = buildTopBottomSignal({
    candles,
    direction,
    pressure,
    delta,
    volumeRatio,
    wickSupportsDirection,
    wickSizeQualified,
    historicalContext,
    sessionFlow,
    contractVolume: 0,
    quoteDepth: 0,
    openInterest: 0
  });

  return {
    delta,
    volumePercent: Math.min(250, volumeRatio * 100),
    volumeHint: volumeRatio > 1.35
      ? "Stock volume is clearly above the 30m baseline"
      : volumeRatio > 1.05
        ? "Stock volume is slightly above baseline"
        : "Stock volume is below the breakout threshold",
    liquidityPercent,
    liquidityHint: "Options liquidity unavailable on current plan",
    pressure,
    pressureHint: pressure > 70
      ? "Stock-candle pressure is strongly one-sided"
      : pressure > 56
        ? "Stock-candle pressure leans one way but is not locked"
        : "Stock-candle pressure is still mixed",
    direction,
    directionVerdict,
    volumeForecast,
    sessionFlow,
    topBottomSignal,
    continuationReady,
    wickSupportsDirection,
    wickSizeQualified,
    wickBodyRatio,
    candleRange,
    underlyingPrice: last.close,
    historicalContext,
    wickWindowLabel: wickWindow.label,
    minutesToClose: wickWindow.minutesToClose,
    projectedUnderlyingMove,
    flags: {
      deltaBias: Math.abs(delta) > 0.22,
      volumeBurst: volumeRatio > 1.18,
      liquidityShift: false,
      pressureOverdrive: pressure > 60,
      wickStructure: wickSupportsDirection && wickSizeQualified,
      trendAcceptance: Math.abs(trendSlope) > 0.8,
      reversalFailure: pressure > 54 && Math.abs(delta) > 0.16
    }
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getEasternParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[parts.weekday] ?? date.getDay(),
    hour: Number(parts.hour || 0),
    minute: Number(parts.minute || 0)
  };
}

function getEasternMinuteOfDay(timestamp) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return (Number(parts.hour || 0) * 60) + Number(parts.minute || 0);
}

function getVolumeWindows() {
  return [
    {
      key: 'open',
      label: 'Opening Bell Volume Window',
      anchorMinute: 9 * 60 + 30,
      activeStart: 8 * 60 + 30,
      activeEnd: 10 * 60 + 30,
      focusStart: 9 * 60 + 30,
      focusEnd: 10 * 60 + 30
    },
    {
      key: 'two_pm',
      label: '2:00 PM Volume Window',
      anchorMinute: 14 * 60,
      activeStart: 13 * 60,
      activeEnd: 15 * 60,
      focusStart: 14 * 60,
      focusEnd: 15 * 60
    }
  ];
}

function buildDirectionVerdict({ direction, pressure, delta, volumeRatio, liquidityPercent, wickSupportsDirection, wickSizeQualified, continuationReady, historicalContext, contractVolume }) {
  const historyDirection = historicalContext?.direction || 'neutral';
  const historyMatch = historyDirection === direction;
  const confidence = Math.round(clamp(
    38 +
    Math.abs(delta) * 24 +
    Math.min(2.4, volumeRatio) * 13 +
    pressure * 0.24 +
    (liquidityPercent || 0) * 0.08 +
    (wickSupportsDirection ? 8 : -6) +
    (wickSizeQualified ? 6 : -4) +
    (continuationReady ? 10 : 0) +
    (historyMatch ? 6 : -4),
    35,
    98
  ));

  let label = (direction === 'bullish' ? 'Bullish' : 'Bearish') + ' lean only';
  if (confidence >= 84) {
    label = (direction === 'bullish' ? 'Bullish' : 'Bearish') + ' continuation confirmed';
  } else if (confidence >= 70) {
    label = (direction === 'bullish' ? 'Bullish' : 'Bearish') + ' control is in force';
  } else if (confidence >= 60) {
    label = (direction === 'bullish' ? 'Bullish' : 'Bearish') + ' edge is building';
  }

  const summary = confidence >= 84
    ? label + '. Delta, live pressure, wick structure, and ' + (historyMatch ? 'historical trend' : 'live momentum') + ' are all lining up. This board is reading ' + direction + ' until price proves otherwise.'
    : confidence >= 70
      ? label + '. The market is reading ' + direction + ', but the next candle still matters for full continuation confirmation. Contract flow currently reads ' + Number(contractVolume || 0).toLocaleString() + ' contracts.'
      : label + '. There is a ' + direction + ' bias, but the board is not clean enough yet to call the move fully locked.';

  return { label, confidence, summary };
}

function buildVolumeForecast(candles) {
  const windows = getVolumeWindows();
  const nowParts = getEasternParts();
  const nowMinute = nowParts.hour * 60 + nowParts.minute;
  const isWeekday = nowParts.day >= 1 && nowParts.day <= 5;
  if (!isWeekday) {
    return {
      label: 'Next live forecast resumes on the next trading day',
      status: 'inactive',
      summary: 'The prediction windows focus on the opening bell and 2:00 PM only during regular market weekdays.'
    };
  }

  const candlesWithMinutes = candles.map((candle) => ({
    ...candle,
    minuteOfDay: getEasternMinuteOfDay(candle.timestamp)
  }));

  const fallbackAverage = average(candles.map((candle) => candle.volume || 0)) || 0;
  const profiles = windows.map((window) => {
    const focusCandles = candlesWithMinutes.filter((candle) => candle.minuteOfDay >= window.focusStart && candle.minuteOfDay < window.focusEnd);
    const averageVolume = average(focusCandles.map((candle) => candle.volume || 0));
    return {
      ...window,
      averageVolume: averageVolume || fallbackAverage || 0
    };
  });

  const activeWindow = profiles.find((window) => nowMinute >= window.activeStart && nowMinute <= window.activeEnd);
  if (activeWindow) {
    const liveCandles = candlesWithMinutes.filter((candle) => candle.minuteOfDay >= activeWindow.focusStart && candle.minuteOfDay < activeWindow.focusEnd);
    const realized = liveCandles.reduce((sum, candle) => sum + (candle.volume || 0), 0);
    const expected = Math.max(activeWindow.averageVolume, 1);
    const ratio = realized / expected;
    const label = ratio >= 1.1
      ? activeWindow.label + ' is running hot'
      : ratio >= 0.9
        ? activeWindow.label + ' is tracking normally'
        : activeWindow.label + ' is coming in light';
    const summary = activeWindow.label + ' is live now. Realized volume is ' + realized.toLocaleString() + ' versus an expected ' + Math.round(expected).toLocaleString() + ' for this window, which reads ' + (ratio * 100).toFixed(0) + '% of the normal pace.';
    return {
      label,
      status: 'live_window',
      expectedVolume: expected,
      realizedVolume: realized,
      summary
    };
  }

  let targetWindow = profiles.find((window) => nowMinute < window.activeStart);
  if (!targetWindow) {
    targetWindow = profiles[0];
  }
  const expected = Math.max(targetWindow.averageVolume, 1);
  const latestCandleVolume = Number(candles[candles.length - 1]?.volume || 0);
  const momentumRatio = latestCandleVolume / Math.max(average(candles.slice(-4).map((candle) => candle.volume || 0)) || 1, 1);
  const projected = Math.round(expected * clamp(0.85 + momentumRatio * 0.2, 0.7, 1.35));
  const windowDayLabel = targetWindow.key === 'open' && nowMinute > targetWindow.activeEnd
    ? 'next trading day'
    : 'today';
  return {
    label: 'Forecasting ' + targetWindow.label + ' ' + windowDayLabel,
    status: 'predictive',
    expectedVolume: expected,
    projectedVolume: projected,
    summary: 'The board is outside the live one-hour window, so it is forecasting ' + targetWindow.label.toLowerCase() + '. Expected volume is about ' + Math.round(expected).toLocaleString() + ', and current pace suggests roughly ' + projected.toLocaleString() + ' if this momentum carries into that hour.'
  };
}

function deriveOrderFlow(trades, underlyingPrice, loadError = "") {
  if (!trades.length) {
    return {
      buyPercent: 50,
      sellPercent: 50,
      buyCount: 0,
      sellCount: 0,
      buySize: 0,
      sellSize: 0,
      dominance: "balanced",
      dominanceScore: 0,
      tape: [],
      loadError
    };
  }

  const orderedTrades = [...trades]
    .filter((trade) => trade.timestamp)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-15);

  let lastPrice = orderedTrades[0]?.price || underlyingPrice || 0;
  const classifiedTape = orderedTrades.map((trade) => {
    let side = "neutral";
    if (trade.price > lastPrice) {
      side = "buy";
    } else if (trade.price < lastPrice) {
      side = "sell";
    } else if (trade.price >= underlyingPrice) {
      side = "buy";
    } else {
      side = "sell";
    }
    lastPrice = trade.price;

    return {
      ...trade,
      side
    };
  });

  const tape = classifiedTape.slice().reverse();

  const buyTrades = tape.filter((trade) => trade.side === "buy");
  const sellTrades = tape.filter((trade) => trade.side === "sell");
  const buySize = buyTrades.reduce((sum, trade) => sum + trade.size, 0);
  const sellSize = sellTrades.reduce((sum, trade) => sum + trade.size, 0);
  const totalSize = Math.max(1, buySize + sellSize);
  const buyPercent = (buySize / totalSize) * 100;
  const sellPercent = (sellSize / totalSize) * 100;
  const dominanceScore = Math.abs(buyPercent - sellPercent);
  const dominance = buyPercent > sellPercent + 8
    ? "buyers"
    : sellPercent > buyPercent + 8
      ? "sellers"
      : "balanced";

  return {
    buyPercent,
    sellPercent,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    buySize,
    sellSize,
    dominance,
    dominanceScore,
    tape,
    loadError
  };
}

async function buildTopCandidates(activeTicker) {
  const symbols = Array.from(new Set([activeTicker, ...TOP_CANDIDATE_UNIVERSE])).slice(0, 36);
  const now = new Date();
  const fromDate = shiftDate(now, -7);
  const toDate = formatDate(now);
  const candidateResults = await Promise.all(symbols.map(async (symbol) => {
    try {
      const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/30/minute/${fromDate}/${toDate}`);
      url.searchParams.set("adjusted", "true");
      url.searchParams.set("sort", "asc");
      url.searchParams.set("limit", "120");
      url.searchParams.set("apiKey", apiKey);
      const payload = await fetchJson(url);
      const candles = (payload.results || []).map(mapAggregate);
      if (candles.length < 4) {
        return null;
      }
      const historicalContext = buildHistoricalContext(candles);
      const last = candles[candles.length - 1];
      const recent = candles.slice(-Math.min(6, candles.length));
      const avgVolume = average(candles.slice(-Math.min(12, candles.length)).map((candle) => candle.volume || 0)) || 1;
      const trendSlope = recent.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
      const direction = historicalContext.threeDayDirection || (trendSlope >= 0 ? "bullish" : "bearish");
      const volumeRatio = (last.volume || avgVolume) / avgVolume;
      const deltaProxy = clamp(trendSlope / Math.max(1, last.close * 0.03), -1, 1);
      const pressure = clamp(
        Math.abs(deltaProxy) * 36 +
        Math.min(2.8, volumeRatio) * 24 +
        historicalContext.biasStrength * 24 +
        historicalContext.breakoutBias * 16 +
        historicalContext.recentPushPercent * 0.22,
        0,
        100
      );
      const nearFiftyFive = 1 - Math.min(1, Math.abs(last.close - 55) / 18);
      const projectedUnderlyingMove = Math.max(0, historicalContext.volatility * (pressure / 100) * (1 + Math.abs(deltaProxy) * 0.5));
      const projectedProfit = Math.max(0, 400 * (projectedUnderlyingMove / Math.max(0.5, last.close * 0.018)) * (0.9 + pressure / 125));
      const sessionFlow = buildSessionFlow(candles, direction, historicalContext);
      const topBottomSignal = buildTopBottomSignal({
        candles,
        direction,
        pressure,
        delta: deltaProxy,
        volumeRatio,
        wickSupportsDirection: direction === "bullish" ? last.close >= last.open : last.close <= last.open,
        wickSizeQualified: true,
        historicalContext,
        sessionFlow,
        contractVolume: 0,
        quoteDepth: 0,
        openInterest: 0
      });
      const score = (
        topBottomSignal.lockScore * 0.52 +
        pressure * 0.25 +
        historicalContext.recentPushPercent * 0.12 +
        historicalContext.biasStrength * 18 +
        nearFiftyFive * 14 +
        (direction === historicalContext.direction ? 8 : 0)
      );

      return {
        ticker: symbol,
        lastPrice: last.close,
        direction,
        pressure: Math.round(pressure),
        projectedProfit: Math.round(projectedProfit),
        projectedUnderlyingMove,
        topBottomTarget: topBottomSignal.target,
        topBottomState: topBottomSignal.state,
        topBottomLockScore: topBottomSignal.lockScore,
        topBottomBreakoutChance: topBottomSignal.breakoutChance,
        topBottomBreakoutBiasLabel: topBottomSignal.breakoutBiasLabel,
        topBottomTraderDriver: topBottomSignal.traderDriver,
        volumeText: `${Math.round(last.volume || 0).toLocaleString()} / ${Math.round(avgVolume).toLocaleString()}`,
        threeDayPattern: historicalContext.threeDayLabel,
        ceiling: historicalContext.ceiling,
        floor: historicalContext.floor,
        breakoutBias: historicalContext.breakoutBias,
        sessionLabel: buildVolumeForecast(candles).label,
        score
      };
    } catch (error) {
      return null;
    }
  }));

  const ranked = candidateResults
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  if (ranked.length) {
    return ranked;
  }

  return [{
    ticker: activeTicker,
    lastPrice: 0,
    direction: "bullish",
    pressure: 0,
    projectedProfit: 0,
    projectedUnderlyingMove: 0,
    topBottomTarget: "bottom",
    topBottomState: "scanning",
    topBottomLockScore: 0,
    topBottomBreakoutChance: 0,
    topBottomBreakoutBiasLabel: "new higher high",
    topBottomTraderDriver: "normal_traders",
    volumeText: "No ranked list yet",
    threeDayPattern: "Waiting for enough market history",
    ceiling: 0,
    floor: 0,
    breakoutBias: 0,
    sessionLabel: "Fallback board item",
    score: 0
  }];
}

async function buildCryptoCandidates() {
  const now = new Date();
  const fromDate = shiftDate(now, -3);
  const toDate = formatDate(now);
  const results = await Promise.all(CRYPTO_CANDIDATE_UNIVERSE.map(async (ticker) => {
    try {
      const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/30/minute/${fromDate}/${toDate}`);
      url.searchParams.set("adjusted", "true");
      url.searchParams.set("sort", "asc");
      url.searchParams.set("limit", "160");
      url.searchParams.set("apiKey", apiKey);
      const payload = await fetchJson(url);
      const candles = (payload.results || []).map(mapAggregate);
      if (candles.length < 8) {
        return null;
      }
      const historicalContext = buildHistoricalContext(candles);
      const last = candles[candles.length - 1];
      const recent = candles.slice(-Math.min(8, candles.length));
      const avgVolume = average(candles.slice(-Math.min(16, candles.length)).map((candle) => candle.volume || 0)) || 1;
      const trendSlope = recent.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
      const direction = historicalContext.threeDayDirection || (trendSlope >= 0 ? "bullish" : "bearish");
      const volumeRatio = (last.volume || avgVolume) / avgVolume;
      const deltaProxy = clamp(trendSlope / Math.max(0.00001, last.close * 0.025), -1, 1);
      const pressure = clamp(
        Math.abs(deltaProxy) * 38 +
        Math.min(3, volumeRatio) * 20 +
        historicalContext.biasStrength * 26 +
        historicalContext.breakoutBias * 18 +
        historicalContext.recentPushPercent * 0.24,
        0,
        100
      );
      const sessionFlow = buildSessionFlow(candles, direction, historicalContext);
      const topBottomSignal = buildTopBottomSignal({
        candles,
        direction,
        pressure,
        delta: deltaProxy,
        volumeRatio,
        wickSupportsDirection: direction === "bullish" ? last.close >= last.open : last.close <= last.open,
        wickSizeQualified: true,
        historicalContext,
        sessionFlow,
        contractVolume: 0,
        quoteDepth: 0,
        openInterest: 0
      });
      const decimalOffset = Number(topBottomSignal.offset || 0).toFixed(last.close < 10 ? 5 : 2);
      const projectedMove = Math.max(0, historicalContext.volatility * (topBottomSignal.breakoutChance / 100) * 1.3);
      const score = topBottomSignal.lockScore * 0.6 + topBottomSignal.breakoutChance * 0.3 + pressure * 0.1;
      return {
        ticker: ticker.replace("X:", ""),
        marketType: "crypto",
        lastPrice: last.close,
        direction,
        topBottomTarget: topBottomSignal.target,
        topBottomState: topBottomSignal.state,
        topBottomLockScore: topBottomSignal.lockScore,
        topBottomBreakoutChance: topBottomSignal.breakoutChance,
        topBottomBreakoutBiasLabel: topBottomSignal.breakoutBiasLabel,
        topBottomTraderDriver: "global traders",
        decimalOffset,
        projectedMove,
        pressure: Math.round(pressure),
        projectedProfit: Math.round(400 * (projectedMove / Math.max(0.0001, last.close * 0.015))),
        threeDayPattern: `${historicalContext.threeDayLabel} • 24/7 crypto`,
        contextNote: `24/7 crypto read. Decimal turn offset ${decimalOffset} with all-day enthusiasm watching for a ${topBottomSignal.breakoutBiasLabel}.`,
        score
      };
    } catch (error) {
      return null;
    }
  }));

  return results.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
}

async function buildForexCandidates() {
  const now = new Date();
  const fromDate = shiftDate(now, -5);
  const toDate = formatDate(now);
  const results = await Promise.all(FOREX_CANDIDATE_UNIVERSE.map(async (ticker) => {
    try {
      const url = new URL(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/30/minute/${fromDate}/${toDate}`);
      url.searchParams.set("adjusted", "true");
      url.searchParams.set("sort", "asc");
      url.searchParams.set("limit", "160");
      url.searchParams.set("apiKey", apiKey);
      const payload = await fetchJson(url);
      const candles = (payload.results || []).map(mapAggregate);
      if (candles.length < 8) {
        return null;
      }
      const historicalContext = buildHistoricalContext(candles);
      const last = candles[candles.length - 1];
      const recent = candles.slice(-Math.min(8, candles.length));
      const avgVolume = average(candles.slice(-Math.min(16, candles.length)).map((candle) => candle.volume || 0)) || 1;
      const trendSlope = recent.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
      const direction = historicalContext.threeDayDirection || (trendSlope >= 0 ? "bullish" : "bearish");
      const volumeRatio = (last.volume || avgVolume) / avgVolume;
      const deltaProxy = clamp(trendSlope / Math.max(0.00001, last.close * 0.01), -1, 1);
      const pressure = clamp(
        Math.abs(deltaProxy) * 34 +
        Math.min(2.5, volumeRatio) * 18 +
        historicalContext.biasStrength * 24 +
        historicalContext.breakoutBias * 20 +
        historicalContext.recentPushPercent * 0.28,
        0,
        100
      );
      const sessionFlow = buildSessionFlow(candles, direction, historicalContext);
      const topBottomSignal = buildTopBottomSignal({
        candles,
        direction,
        pressure,
        delta: deltaProxy,
        volumeRatio,
        wickSupportsDirection: direction === "bullish" ? last.close >= last.open : last.close <= last.open,
        wickSizeQualified: true,
        historicalContext,
        sessionFlow,
        contractVolume: 0,
        quoteDepth: 0,
        openInterest: 0
      });
      const pipMultiplier = last.close >= 20 ? 100 : 10000;
      const pips = Math.abs(last.close - recent[0].close) * pipMultiplier;
      const score = topBottomSignal.lockScore * 0.52 + topBottomSignal.breakoutChance * 0.26 + Math.min(80, pips) * 0.22;
      return {
        ticker: ticker.replace("C:", ""),
        marketType: "forex",
        lastPrice: last.close,
        direction,
        topBottomTarget: topBottomSignal.target,
        topBottomState: topBottomSignal.state,
        topBottomLockScore: topBottomSignal.lockScore,
        topBottomBreakoutChance: topBottomSignal.breakoutChance,
        topBottomBreakoutBiasLabel: topBottomSignal.breakoutBiasLabel,
        topBottomTraderDriver: "global traders",
        pipMove: pips,
        projectedMove: historicalContext.volatility,
        pressure: Math.round(pressure),
        projectedProfit: Math.round(pips * 8),
        threeDayPattern: `${historicalContext.threeDayLabel} • forex spike`,
        contextNote: buildForexButterflyExplanation(ticker, direction, pips, topBottomSignal),
        score
      };
    } catch (error) {
      return null;
    }
  }));

  return results.filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
}

function buildForexButterflyExplanation(ticker, direction, pips, topBottomSignal) {
  const pair = ticker.replace("C:", "");
  const directionWord = direction === "bullish" ? "higher" : "lower";
  return `Global butterfly read: 1. cross-market positioning is pushing ${pair} ${directionWord}; 2. session handoff is feeding the spike; 3. macro repricing is supporting a ${topBottomSignal.breakoutBiasLabel}. Current spike read ${pips.toFixed(0)} pips.`;
}

function buildHistoricalContext(candles) {
  const sample = candles.slice(-Math.min(39, candles.length));
  const avgClose = average(sample.map((candle) => candle.close));
  const avgVolume = average(sample.map((candle) => candle.volume || 0));
  const momentum = sample.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
  const volatility = average(sample.map((candle) => Math.abs(candle.high - candle.low)));
  const latest = sample[sample.length - 1];
  const priceDeviation = avgClose > 0 ? (latest.close - avgClose) / avgClose : 0;
  const volumeDeviation = avgVolume > 0 ? (latest.volume - avgVolume) / avgVolume : 0;
  const threeDaySample = sample.slice(-39);
  const threeDayMomentum = threeDaySample.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
  const ceiling = Math.max(...sample.map((candle) => candle.high || candle.close || 0));
  const floor = Math.min(...sample.map((candle) => candle.low || candle.close || 0));
  const recentPush = sample.slice(-2).reduce((sum, candle) => sum + Math.abs(candle.close - candle.open), 0);
  const breakoutBias = latest.close >= avgClose
    ? clamp((latest.close - floor) / Math.max(0.01, ceiling - floor), 0, 1)
    : clamp((ceiling - latest.close) / Math.max(0.01, ceiling - floor), 0, 1);

  return {
    averageClose: avgClose,
    averageVolume: avgVolume,
    volatility,
    momentum,
    priceDeviationPercent: priceDeviation * 100,
    volumeDeviationPercent: volumeDeviation * 100,
    direction: momentum >= 0 ? "bullish" : "bearish",
    biasStrength: Math.min(1, (Math.abs(momentum) / Math.max(1, avgClose * 0.08)) + Math.abs(priceDeviation)),
    threeDayDirection: threeDayMomentum >= 0 ? "bullish" : "bearish",
    threeDayLabel: `${threeDayMomentum >= 0 ? "Bullish" : "Bearish"} 3 day pattern`,
    ceiling,
    floor,
    recentPushPercent: avgClose > 0 ? (recentPush / avgClose) * 100 : 0,
    breakoutBias
  };
}

function buildSessionFlow(candles, direction, historicalContext) {
  const lastHour = candles.slice(-2);
  const hourVolume = lastHour.reduce((sum, candle) => sum + (candle.volume || 0), 0);
  const avgHourVolume = average(candles.slice(-10, -2).map((candle) => candle.volume || 0)) * 2 || 1;
  const hourPush = lastHour.reduce((sum, candle) => sum + (candle.close - candle.open), 0);
  const directionalPush = direction === "bullish" ? hourPush : -hourPush;
  const countdown = buildVolumeForecast(candles).label;
  return {
    volumeIntoWindow: Math.round(hourVolume),
    hourVolumePercent: clamp((hourVolume / Math.max(1, avgHourVolume)) * 100, 0, 250),
    directionalPushPercent: clamp((directionalPush / Math.max(0.1, historicalContext.averageClose * 0.01)) * 100, 0, 200),
    countdown,
    ceiling: historicalContext.ceiling,
    floor: historicalContext.floor
  };
}

function buildTopBottomSignal({
  candles,
  direction,
  pressure,
  delta,
  volumeRatio,
  wickSupportsDirection,
  wickSizeQualified,
  historicalContext,
  sessionFlow,
  contractVolume,
  quoteDepth,
  openInterest
}) {
  const recent = candles.slice(-Math.min(18, candles.length));
  const last = recent[recent.length - 1];
  const earlier = recent.slice(0, -1);
  const currentExtreme = direction === "bullish" ? last.low : last.high;
  const comparisonPoints = earlier.map((candle) => direction === "bullish" ? candle.low : candle.high);
  const fallbackExtreme = direction === "bullish" ? historicalContext.floor : historicalContext.ceiling;
  const anchorExtreme = comparisonPoints.length
    ? comparisonPoints.reduce((closest, value) => (
      Math.abs(value - currentExtreme) < Math.abs(closest - currentExtreme) ? value : closest
    ), comparisonPoints[0])
    : fallbackExtreme;
  const offset = Math.abs(currentExtreme - anchorExtreme);
  const normalizedOffset = offset / Math.max(0.01, historicalContext.volatility || 1);
  const historicalPressureBalance = clamp(
    pressure * 0.42 +
    historicalContext.biasStrength * 34 +
    historicalContext.breakoutBias * 24 +
    Number(sessionFlow?.directionalPushPercent || 0) * 0.08,
    0,
    100
  );
  const whaleInflux = clamp(
    (contractVolume / Math.max(1, openInterest || contractVolume || 1)) * 100 +
    (quoteDepth / 10),
    0,
    100
  );
  const isNearSimilarTurn = normalizedOffset <= 1.15;
  const manipulationIndicators = {
    offset: isNearSimilarTurn,
    influx: volumeRatio >= 1.08 || whaleInflux >= 32,
    pressureBalance: historicalPressureBalance >= 58 && wickSupportsDirection
  };
  const breakoutIndicators = {
    reclaim: pressure >= 62,
    whaleHold: whaleInflux >= 26 || Math.abs(delta) >= 0.2,
    windowUrgency: isFocusWindowActive()
  };
  const unhookIndicators = {
    sideways: Number(sessionFlow?.directionalPushPercent || 0) <= 18,
    fade: pressure < 48 || volumeRatio < 0.92,
    manipulationDominant: !wickSupportsDirection || historicalPressureBalance < 48
  };
  const manipulationCount = Object.values(manipulationIndicators).filter(Boolean).length;
  const breakoutCount = Object.values(breakoutIndicators).filter(Boolean).length;
  const unhookCount = Object.values(unhookIndicators).filter(Boolean).length;
  const focusWindow = getFocusWindowState();
  const lockScore = clamp(
    manipulationCount * 18 +
    breakoutCount * 16 +
    historicalPressureBalance * 0.28 +
    whaleInflux * 0.18 -
    unhookCount * 14 -
    focusWindow.distancePenalty,
    0,
    100
  );
  const breakoutChance = clamp(
    historicalPressureBalance +
    breakoutCount * 6 -
    unhookCount * 8 -
    focusWindow.distancePenalty * 0.7,
    0,
    100
  );
  const ignitionScore = clamp(
    lockScore * 0.54 +
    breakoutChance * 0.34 +
    breakoutCount * 6 -
    unhookCount * 10 -
    (focusWindow.minutesToWindow > 50 ? 10 : 0),
    0,
    100
  );
  const state = unhookCount >= 2
    ? "unhooked"
    : ignitionScore >= 96 && breakoutCount >= 2
      ? "ignited"
      : lockScore >= 78 && breakoutCount >= 2
      ? "locked"
      : lockScore >= 56
        ? "building"
        : "scanning";

  return {
    target: direction === "bullish" ? "bottom" : "top",
    offset,
    normalizedOffset,
    historicalPressureBalance,
    whaleInflux,
    manipulationIndicators,
    breakoutIndicators,
    unhookIndicators,
    manipulationCount,
    breakoutCount,
    unhookCount,
    lockScore,
    breakoutChance,
    ignitionScore,
    pulseMs: lockScore >= 86 ? 420 : lockScore >= 72 ? 700 : lockScore >= 56 ? 1100 : 1800,
    laserDensity: lockScore >= 86 ? 6 : lockScore >= 72 ? 5 : lockScore >= 56 ? 4 : 3,
    state,
    windowLabel: focusWindow.label,
    minutesToWindow: focusWindow.minutesToWindow,
    traderDriver: whaleInflux >= 26 ? "whales" : "normal_traders",
    breakoutBiasLabel: direction === "bullish" ? "new higher high" : "new lower low"
  };
}

function isFocusWindowActive() {
  return getFocusWindowState().isActive;
}

function getFocusWindowState() {
  const parts = getEasternParts();
  const minute = parts.hour * 60 + parts.minute;
  const windows = [
    { label: "9:30 AM bell", minute: 9 * 60 + 30 },
    { label: "2:00 PM wave", minute: 14 * 60 }
  ];
  const closest = windows.reduce((best, item) => (
    Math.abs(item.minute - minute) < Math.abs(best.minute - minute) ? item : best
  ), windows[0]);
  const minutesToWindow = Math.abs(closest.minute - minute);
  return {
    label: closest.label,
    minutesToWindow,
    isActive: minutesToWindow <= 45,
    distancePenalty: clamp((minutesToWindow - 20) * 0.9, 0, 26)
  };
}

function getWickWindow(lastTimestamp) {
  const now = new Date();
  const nextClose = new Date(now);
  nextClose.setSeconds(0, 0);

  const minutes = nextClose.getMinutes();
  if (minutes < 30) {
    nextClose.setMinutes(30, 0, 0);
  } else if (minutes === 30 && now.getSeconds() === 0 && now.getMilliseconds() === 0) {
    nextClose.setMinutes(30, 0, 0);
  } else {
    nextClose.setHours(nextClose.getHours() + 1);
    nextClose.setMinutes(0, 0, 0);
  }

  const minutesToClose = Math.max(0, Math.ceil((nextClose.getTime() - now.getTime()) / 60000));
  const candleAgeMinutes = Math.max(0, Math.floor((now.getTime() - lastTimestamp) / 60000));
  const sameActiveWindow = candleAgeMinutes <= 30;
  let label = `${minutesToClose}m until 30m close`;
  let isEligible = false;

  if (sameActiveWindow && minutesToClose <= 5) {
    label = "5m wick confirmation window";
    isEligible = true;
  } else if (sameActiveWindow && minutesToClose <= 10) {
    label = "10m wick confirmation window";
    isEligible = true;
  } else if (sameActiveWindow && minutesToClose <= 15) {
    label = "15m wick confirmation window";
    isEligible = true;
  }

  return {
    label,
    minutesToClose,
    isEligible
  };
}

function buildMarketStatus(optionAggs, candleCount, usingUnderlyingFallback, ticker) {
  const status = optionAggs.resultsCount ? `${candleCount} option candles loaded` : "No option candles reported";
  if (usingUnderlyingFallback) {
    return `${status} • fallback to ${ticker} underlying candles`;
  }
  return status;
}

function mapAggregate(item) {
  return {
    open: Number(item.o || 0),
    high: Number(item.h || 0),
    low: Number(item.l || 0),
    close: Number(item.c || 0),
    volume: Number(item.v || 0),
    timestamp: Number(item.t || 0)
  };
}

function mapTrade(item) {
  return {
    price: Number(item.price || 0),
    size: Number(item.size || 0),
    exchange: Number(item.exchange || 0),
    timestamp: normalizePolygonTimestamp(item.participant_timestamp || item.sip_timestamp || 0)
  };
}

function normalizePolygonTimestamp(timestamp) {
  if (typeof timestamp === "string" && Number.isNaN(Number(timestamp))) {
    const parsed = Date.parse(timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const value = Number(timestamp || 0);
  if (!value) {
    return 0;
  }
  if (value > 9999999999999) {
    return Math.floor(value / 1000000);
  }
  return value;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date, days) {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return formatDate(shifted);
}

function daysBetween(start, end) {
  return Math.ceil((end - start) / 86400000);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Anthony-Figueroa-Market/1.0"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Polygon request failed (${response.status}): ${text.slice(0, 180)}`);
  }

  return response.json();
}

function serveStatic(requestPath, res) {
  const pathname = requestPath === "/" ? "/index.html" : requestPath;
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500);
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    res.end(contents);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
