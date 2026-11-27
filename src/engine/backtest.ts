/**
 * Backtest Module for Row-Quant Formula Engine
 *
 * This module converts alpha matrices into portfolio weights and computes
 * performance metrics using delay-1 backtesting.
 */

import { Matrix, createMatrix } from './ast.js';

/**
 * Result of a backtest containing daily PnL and performance metrics.
 */
export interface BacktestResult {
  pnl: number[];           // Daily PnL
  cumulativePnl: number[]; // Cumulative PnL curve
  sharpe: number;          // Annualized Sharpe ratio
  annualReturn: number;    // Annualized return
  turnover: number;        // Average daily turnover
  maxDrawdown: number;     // Maximum drawdown
}

/**
 * Converts an alpha matrix to portfolio weights following the backtest rules:
 * 1. Stocks with NaN alpha get weight exactly 0
 * 2. For stocks with valid alpha:
 *    - Demean across valid alpha stocks (market neutral): sum = 0
 *    - Scale so sum(|w|) = 1 over all stocks
 * 3. If all alpha values are NaN or all weights are 0 after demeaning, no scaling is done
 *
 * Requirements: 8.1.1, 8.1.2, 8.1.3, 8.1.5
 *
 * @param alpha - Alpha signal matrix (nDays × nStocks)
 * @returns Matrix of weights with same dimensions as alpha
 */
export function computeWeights(alpha: Matrix): Matrix {
  const result = createMatrix(alpha.nDays, alpha.nStocks);

  // Process each day independently
  for (let t = 0; t < alpha.nDays; t++) {
    // Step 1: Convert alpha to weights, NaN -> 0
    // Track indices of stocks with valid (non-NaN) alpha
    const validIndices: number[] = [];

    for (let i = 0; i < alpha.nStocks; i++) {
      const a = alpha.data[t * alpha.nStocks + i];
      if (isNaN(a)) {
        // NaN alpha -> weight exactly 0
        result.data[t * result.nStocks + i] = 0;
      } else {
        // Valid alpha -> copy to result, track as valid
        result.data[t * result.nStocks + i] = a;
        validIndices.push(i);
      }
    }

    // If no valid alpha values, all weights stay 0
    if (validIndices.length === 0) {
      continue;
    }

    // Step 2: Demean over stocks with valid (non-NaN) alpha
    // Compute mean over valid alpha stocks only
    let sum = 0;
    for (const i of validIndices) {
      sum += result.data[t * result.nStocks + i];
    }
    const mean = sum / validIndices.length;

    // Subtract mean from valid alpha stocks
    for (const i of validIndices) {
      result.data[t * result.nStocks + i] -= mean;
    }

    // Step 3: Scale so sum(|w|) = 1 over all stocks (including zeros from NaN alpha)
    let sumAbs = 0;
    for (let i = 0; i < alpha.nStocks; i++) {
      sumAbs += Math.abs(result.data[t * result.nStocks + i]);
    }

    // Only scale if sum of absolute values is non-zero
    if (sumAbs > 0) {
      for (let i = 0; i < alpha.nStocks; i++) {
        result.data[t * result.nStocks + i] /= sumAbs;
      }
    }
  }

  return result;
}

/**
 * Computes daily PnL using delay-1 portfolio simulation.
 * 
 * Delay-1 means: weights[t] are applied to returns[t+1], simulating
 * realistic trading where positions are established at end of day t
 * and held through day t+1.
 * 
 * For each day t (from 0 to nDays-2):
 *   dailyPnL[t] = sum over stocks i of (weights[t][i] * returns[t+1][i])
 * 
 * NaN returns are skipped in the sum (they contribute 0 to PnL).
 * 
 * Requirements: 8.1.6, 8.1.7
 * 
 * @param weights - Portfolio weights matrix (nDays × nStocks)
 * @param returns - Returns matrix (nDays × nStocks)
 * @returns Object containing daily PnL array and cumulative PnL array
 */
export function computePnL(weights: Matrix, returns: Matrix): {
  dailyPnL: number[];
  cumulativePnL: number[];
} {
  const nDays = weights.nDays;
  const nStocks = weights.nStocks;

  // Verify dimensions match
  if (returns.nDays !== nDays || returns.nStocks !== nStocks) {
    throw new Error('Weights and returns matrices must have same dimensions');
  }

  // PnL array has length nDays - 1 (due to delay-1)
  const dailyPnL: number[] = [];
  const cumulativePnL: number[] = [];
  let cumPnL = 0;

  // For each day t from 0 to nDays-2:
  // Apply weights[t] to returns[t+1]
  for (let t = 0; t < nDays - 1; t++) {
    let pnl = 0;

    // Sum over all stocks: weights[t][i] * returns[t+1][i]
    for (let i = 0; i < nStocks; i++) {
      const w = weights.data[t * nStocks + i];
      const r = returns.data[(t + 1) * nStocks + i];

      // Skip NaN returns (they don't contribute to PnL)
      if (!isNaN(r)) {
        pnl += w * r;
      }
    }

    dailyPnL.push(pnl);
    cumPnL += pnl;
    cumulativePnL.push(cumPnL);
  }

  return { dailyPnL, cumulativePnL };
}

/**
 * Computes annualized Sharpe ratio from daily PnL.
 * 
 * Sharpe = (mean / std) * sqrt(252)
 * 
 * Where:
 * - mean = average daily PnL
 * - std = population standard deviation of daily PnL
 * - 252 = trading days per year (annualization factor)
 * 
 * Special case: if std = 0 (constant PnL), return 0 to avoid division by zero.
 * 
 * Requirements: 8.1.8
 * 
 * @param dailyPnL - Array of daily PnL values
 * @returns Annualized Sharpe ratio
 */
export function computeSharpe(dailyPnL: number[]): number {
  if (dailyPnL.length === 0) {
    return 0;
  }

  // Compute mean
  const mean = dailyPnL.reduce((sum, val) => sum + val, 0) / dailyPnL.length;

  // Compute population standard deviation
  const variance = dailyPnL.reduce((sum, val) => sum + (val - mean) ** 2, 0) / dailyPnL.length;
  const std = Math.sqrt(variance);

  // Handle zero std case (constant PnL)
  if (std === 0) {
    return 0;
  }

  // Annualized Sharpe = (mean / std) * sqrt(252)
  return (mean / std) * Math.sqrt(252);
}

/**
 * Computes annualized return from daily PnL.
 * 
 * Annual return = mean(daily PnL) * 252
 * 
 * Requirements: 8.1.9
 * 
 * @param dailyPnL - Array of daily PnL values
 * @returns Annualized return
 */
export function computeAnnualReturn(dailyPnL: number[]): number {
  if (dailyPnL.length === 0) {
    return 0;
  }

  const mean = dailyPnL.reduce((sum, val) => sum + val, 0) / dailyPnL.length;
  return mean * 252;
}

/**
 * Computes average daily turnover from weight matrix.
 * 
 * Turnover = average over t of sum_i |weights[t][i] - weights[t-1][i]|
 * 
 * This measures how much the portfolio composition changes from day to day.
 * 
 * Requirements: 8.1.10, 8.1.11
 * 
 * @param weights - Portfolio weights matrix (nDays × nStocks)
 * @returns Average daily turnover (>= 0)
 */
export function computeTurnover(weights: Matrix): number {
  if (weights.nDays <= 1) {
    return 0;
  }

  const nDays = weights.nDays;
  const nStocks = weights.nStocks;
  let totalTurnover = 0;

  // For each day t from 1 to nDays-1:
  // Compute sum over stocks of |weights[t][i] - weights[t-1][i]|
  for (let t = 1; t < nDays; t++) {
    let dailyTurnover = 0;

    for (let i = 0; i < nStocks; i++) {
      const w_t = weights.data[t * nStocks + i];
      const w_t_prev = weights.data[(t - 1) * nStocks + i];
      dailyTurnover += Math.abs(w_t - w_t_prev);
    }

    totalTurnover += dailyTurnover;
  }

  // Average over nDays - 1 days
  return totalTurnover / (nDays - 1);
}

/**
 * Computes maximum drawdown from cumulative PnL curve.
 * 
 * Max drawdown = max over t of (peak - cumPnL[t])
 * where peak = max(cumPnL[0..t])
 * 
 * This measures the largest peak-to-trough decline in cumulative PnL.
 * 
 * Requirements: 8.1.12, 8.1.13, 8.1.14
 * 
 * @param cumulativePnL - Array of cumulative PnL values
 * @returns Maximum drawdown (>= 0)
 */
export function computeMaxDrawdown(cumulativePnL: number[]): number {
  if (cumulativePnL.length === 0) {
    return 0;
  }

  let maxDrawdown = 0;
  let peak = 0;

  for (const cumPnL of cumulativePnL) {
    // Update peak if current cumPnL is higher
    if (cumPnL > peak) {
      peak = cumPnL;
    }

    // Compute drawdown from peak
    const drawdown = peak - cumPnL;

    // Update max drawdown if this is larger
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Performs a complete backtest: converts alpha to weights, computes PnL,
 * and calculates all performance metrics.
 * 
 * This integrates all backtest components:
 * 1. Convert alpha matrix to portfolio weights (delay-1, market-neutral, scaled)
 * 2. Compute daily PnL from weights and returns
 * 3. Calculate Sharpe ratio, annual return, turnover, and max drawdown
 * 
 * Requirements: 8.1.1-8.1.16
 * 
 * @param alpha - Alpha signal matrix (nDays × nStocks)
 * @param returns - Returns matrix (nDays × nStocks)
 * @returns BacktestResult containing PnL and all performance metrics
 */
export function backtest(alpha: Matrix, returns: Matrix): BacktestResult {
  // Step 1: Convert alpha to weights
  const weights = computeWeights(alpha);

  // Step 2: Compute daily PnL with delay-1
  const { dailyPnL, cumulativePnL } = computePnL(weights, returns);

  // Step 3: Compute performance metrics
  const sharpe = computeSharpe(dailyPnL);
  const annualReturn = computeAnnualReturn(dailyPnL);
  const turnover = computeTurnover(weights);
  const maxDrawdown = computeMaxDrawdown(cumulativePnL);

  return {
    pnl: dailyPnL,
    cumulativePnl: cumulativePnL,
    sharpe,
    annualReturn,
    turnover,
    maxDrawdown,
  };
}
