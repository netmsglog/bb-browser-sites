/* @meta
{
  "name": "yahoo-finance/chart",
  "description": "Get candlestick (OHLCV) chart data from Yahoo Finance",
  "domain": "finance.yahoo.com",
  "args": {
    "symbol": {"required": true, "description": "Stock ticker symbol, e.g. TQQQ, AAPL, MSFT"},
    "range": {"required": false, "description": "Time range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max (default: 1y)"},
    "interval": {"required": false, "description": "Candle interval: 1m, 5m, 15m, 30m, 1h, 1d, 1wk, 1mo (default: 1d)"}
  },
  "readOnly": true,
  "example": "bb-browser site yahoo-finance/chart TQQQ"
}
*/
async function(args) {
  if (!args.symbol) return { error: 'Missing argument: symbol' };

  const symbol = args.symbol.toUpperCase();
  const range = args.range || '1y';
  const interval = args.interval || '1d';

  const url = 'https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol)
    + '?interval=' + interval + '&range=' + range
    + '&events=div|split&includePrePost=false&lang=en-US&region=US';

  const resp = await fetch(url, { credentials: 'include' });
  if (!resp.ok) return { error: 'HTTP ' + resp.status };

  const data = await resp.json();
  if (!data.chart || !data.chart.result || !data.chart.result[0]) {
    return { error: data.chart?.error?.description || 'No data returned', symbol };
  }

  const result = data.chart.result[0];
  const meta = result.meta;
  const q = result.indicators.quote[0];
  const ts = result.timestamp || [];

  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open[i] == null) continue;
    const d = new Date(ts[i] * 1000);
    candles.push({
      date: interval.includes('m') || interval === '1h'
        ? d.toISOString().replace('T', ' ').slice(0, 16)
        : d.toISOString().split('T')[0],
      open: +q.open[i].toFixed(2),
      high: +q.high[i].toFixed(2),
      low: +q.low[i].toFixed(2),
      close: +q.close[i].toFixed(2),
      volume: q.volume[i]
    });
  }

  return {
    symbol: meta.symbol,
    currency: meta.currency,
    exchange: meta.exchangeName,
    interval,
    range,
    candles,
    total: candles.length
  };
}
