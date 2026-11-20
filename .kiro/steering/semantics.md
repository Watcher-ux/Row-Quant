---
inclusion: fileMatch
fileMatchPattern: ["src/engine/**", "tests/**"]
---

# Expression semantics (source of truth for the engine)

Every value is a matrix X[t][i]: day t, stock i. Scalars broadcast. NaN propagates unless stated.

## Data fields
`open high low close volume vwap returns` (returns = close[t]/close[t-1] - 1), `sector` (group label).

## Cross-sectional (per day, across stocks; NaNs ignored and preserved)
- `rank(x)`: percentile rank in [0, 1]; ties get the average rank; a single valid value gets 0.5.
- `zscore(x)`: (x - mean) / std; all-equal row -> 0.
- `scale(x)`: x / sum(|x|) so the row's absolute values sum to 1; all-zero row stays 0.
- `group_neutralize(x, sector)`: subtract the group mean within each sector.

## Time-series (per stock, across days; window d >= 1, integer)
- `ts_delay(x, d)`: x[t-d]; first d rows NaN.
- `ts_delta(x, d)`: x[t] - x[t-d].
- `ts_mean(x, d)`, `ts_sum(x, d)`, `ts_std_dev(x, d)` (population std).
- `ts_rank(x, d)`: rank of x[t] within the last d values, in [0, 1].
- `ts_decay_linear(x, d)`: weighted mean, weights d, d-1, ..., 1 (newest heaviest).
- `ts_corr(x, y, d)`: Pearson correlation over the window.
- Windows with fewer than d valid values -> NaN.

## Element-wise
`+ - * /` (division by 0 -> NaN), unary `-`, `abs sign log sqrt`, `max(x,y) min(x,y)`,
comparisons `< > <= >= ==` -> 1/0, `if_else(cond, a, b)`.

## Cell references
`A1`, `B12` etc. refer to another cell's matrix. Cycles are an error reported on every cell in the cycle.

## Backtest (delay 1)
1. weights w[t] = alpha[t], NaN -> 0, then demean across stocks (market neutral), then scale so sum|w[t]| = 1.
2. daily pnl[t+1] = sum_i w[t][i] * returns[t+1][i].
3. Metrics: annualized Sharpe = mean/std * sqrt(252); annual return = mean * 252;
   turnover = mean over t of sum|w[t] - w[t-1]|; max drawdown on cumulative pnl.

## Invariants (must be property-tested)
- rank and ts_rank outputs are in [0, 1] or NaN.
- rank is invariant to any strictly increasing transform of its input.
- group_neutralize output has group mean 0 (within float tolerance).
- Backtest weights each day: sum = 0 and sum|w| = 1 (or all 0).
- ts_delay(x, d) shifted back by d equals x.
- parse(print(ast)) == ast for any generated AST.
- Evaluation is deterministic and never throws on generated valid expressions.
