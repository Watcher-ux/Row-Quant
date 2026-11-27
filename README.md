# Row-Quant

VisiCalc (1979) resurrected as a quant research workbench. Every cell holds an alpha expression, cells reference other cells, and recalculating runs a backtest.

Built with [Kiro](https://kiro.dev) for Kiroween 2026 (Resurrection category). Specs, steering docs and hooks live in [`.kiro/`](.kiro).

## Data

The bundled dataset (`public/data/market.json`) contains 10 years of daily OHLCV data for 100 large-cap stocks across all 11 GICS sectors. The universe consists of current S&P 500 constituents as of 2024, so **backtests have survivorship bias** — delisted and bankrupt companies are not included.

To regenerate the data:
```bash
pip install yfinance pandas numpy
python scripts/fetch_data.py
```

## Run locally

```bash
npm install
npm run dev     # app
npm test        # unit + property-based tests
```

## License

MIT
