---
inclusion: always
---

# Product: Row-Quant

VisiCalc (1979) resurrected as a quant research workbench. Kiroween 2026, Resurrection category.

## Pitch
VisiCalc turned the personal computer into a finance tool. Row-Quant does the same for quant research:
every cell holds an alpha expression, cells reference other cells, and recalculating runs a backtest.

## Users
Students and hobbyist quants who know (or want to learn) WorldQuant BRAIN-style expressions.

## Core experience
- Grid of cells (A1..Z99) with the original VisiCalc look: green/amber on black, monospace, status line at top, edit line at bottom.
- A cell holds either a data field (`close`, `volume`, `returns`...) or an expression (`rank(ts_delta(close, 5))`, `A1 * B2`).
- Each cell evaluates to a matrix (days x stocks). The grid shows a one-line summary per cell (Sharpe, or ERR).
- Selecting a cell shows its backtest: PnL curve, Sharpe, annual return, turnover, max drawdown.
- `/` opens the VisiCalc-style command menu (e.g. /B blank, /C clear, /S save, /L load, /? help).
- Natural-language mode: type `"buy stocks that dropped most this week"` and get formulas written into cells.
- Errors never crash the app: a bad cell shows `ERR` and the reason in the status line.

## Out of scope
Live trading, user accounts, intraday data, real-time feeds.

## Tone
Faithful to 1979 in look and keyboard flow, modern in what it computes. Spooky touch allowed (Kiroween) but function first.
