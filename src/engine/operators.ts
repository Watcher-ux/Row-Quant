/**
 * Matrix Operators for Row-Quant Formula Engine
 *
 * This module implements all matrix operations including cross-sectional, time-series,
 * and element-wise operators with correct NaN handling.
 */

import { Matrix, createMatrix } from './ast.js';

// ============================================================================
// Time-Series Operators (per stock, across days)
// ============================================================================

/**
 * ts_delay: Shift values back by d days (delay).
 * 
 * For each stock independently:
 * - First d rows are NaN
 * - For t >= d: result[t][i] = x[t-d][i]
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * - d < x.nDays
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - First d rows are all NaN
 * - For t >= d: result[t][i] = x[t-d][i]
 * - Property: shift invariance - result[t] = x[t-d] for t >= d
 * 
 * @param x - Input matrix
 * @param d - Delay period (number of days to shift back)
 * @returns Matrix with delayed values
 */
export function ts_delay(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    // First d days are NaN (already initialized by createMatrix)
    // No action needed for first d rows
    
    // Remaining days: shift back by d
    for (let t = d; t < x.nDays; t++) {
      const value = x.data[(t - d) * x.nStocks + i];
      result.data[t * x.nStocks + i] = value;
    }
  }
  
  return result;
}

/**
 * ts_delta: Compute difference between current value and value d days ago.
 * 
 * For each stock independently:
 * - First d rows are NaN
 * - For t >= d: result[t][i] = x[t][i] - x[t-d][i]
 * - NaN propagates: if either x[t] or x[t-d] is NaN, result is NaN
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - First d rows are all NaN
 * - For t >= d: result[t][i] = x[t][i] - x[t-d][i]
 * - NaN in either operand produces NaN
 * 
 * @param x - Input matrix
 * @param d - Lookback period
 * @returns Matrix with delta values
 */
export function ts_delta(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    // First d days are NaN (already initialized by createMatrix)
    // No action needed for first d rows
    
    // Remaining days: compute delta
    for (let t = d; t < x.nDays; t++) {
      const current = x.data[t * x.nStocks + i];
      const past = x.data[(t - d) * x.nStocks + i];
      
      // Subtraction handles NaN propagation automatically
      result.data[t * x.nStocks + i] = current - past;
    }
  }
  
  return result;
}

/**
 * ts_mean: Compute rolling window mean over last d days.
 * 
 * For each stock independently:
 * - Window [t-d+1, t] must have at least d valid (non-NaN) values
 * - If window has fewer than d valid values, result is NaN
 * - Only non-NaN values are included in the mean calculation
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - result[t][i] = mean of valid values in window [t-d+1, t], or NaN if < d valid values
 * - NaN values in input are ignored (not counted)
 * 
 * @param x - Input matrix
 * @param d - Window size
 * @returns Matrix with rolling mean values
 */
export function ts_mean(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    for (let t = 0; t < x.nDays; t++) {
      // Collect values in window [t-d+1, t]
      let sum = 0;
      let count = 0;
      
      for (let k = t - d + 1; k <= t; k++) {
        if (k >= 0) {
          const value = x.data[k * x.nStocks + i];
          if (!isNaN(value)) {
            sum += value;
            count++;
          }
        }
      }
      
      // Need at least d valid values
      if (count < d) {
        result.data[t * x.nStocks + i] = NaN;
      } else {
        result.data[t * x.nStocks + i] = sum / count;
      }
    }
  }
  
  return result;
}

/**
 * ts_sum: Compute rolling window sum over last d days.
 * 
 * For each stock independently:
 * - Window [t-d+1, t] must have at least d valid (non-NaN) values
 * - If window has fewer than d valid values, result is NaN
 * - Only non-NaN values are included in the sum calculation
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - result[t][i] = sum of valid values in window [t-d+1, t], or NaN if < d valid values
 * - NaN values in input are ignored (not counted)
 * 
 * @param x - Input matrix
 * @param d - Window size
 * @returns Matrix with rolling sum values
 */
export function ts_sum(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    for (let t = 0; t < x.nDays; t++) {
      // Collect values in window [t-d+1, t]
      let sum = 0;
      let count = 0;
      
      for (let k = t - d + 1; k <= t; k++) {
        if (k >= 0) {
          const value = x.data[k * x.nStocks + i];
          if (!isNaN(value)) {
            sum += value;
            count++;
          }
        }
      }
      
      // Need at least d valid values
      if (count < d) {
        result.data[t * x.nStocks + i] = NaN;
      } else {
        result.data[t * x.nStocks + i] = sum;
      }
    }
  }
  
  return result;
}

/**
 * ts_std_dev: Compute rolling window population standard deviation over last d days.
 * 
 * For each stock independently:
 * - Window [t-d+1, t] must have at least d valid (non-NaN) values
 * - If window has fewer than d valid values, result is NaN
 * - Only non-NaN values are included in the calculation
 * - Uses population standard deviation formula: sqrt(E[(X - mean)^2])
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - result[t][i] = population std dev of valid values in window [t-d+1, t], or NaN if < d valid values
 * - NaN values in input are ignored (not counted)
 * 
 * @param x - Input matrix
 * @param d - Window size
 * @returns Matrix with rolling standard deviation values
 */
export function ts_std_dev(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    for (let t = 0; t < x.nDays; t++) {
      // Collect values in window [t-d+1, t]
      const values: number[] = [];
      
      for (let k = t - d + 1; k <= t; k++) {
        if (k >= 0) {
          const value = x.data[k * x.nStocks + i];
          if (!isNaN(value)) {
            values.push(value);
          }
        }
      }
      
      // Need at least d valid values
      if (values.length < d) {
        result.data[t * x.nStocks + i] = NaN;
        continue;
      }
      
      // Compute mean
      let sum = 0;
      for (const v of values) {
        sum += v;
      }
      const mean = sum / values.length;
      
      // Compute population standard deviation
      let sumSquaredDiff = 0;
      for (const v of values) {
        const diff = v - mean;
        sumSquaredDiff += diff * diff;
      }
      const std = Math.sqrt(sumSquaredDiff / values.length);
      
      result.data[t * x.nStocks + i] = std;
    }
  }
  
  return result;
}

/**
 * ts_rank: Compute rank of current value within rolling window.
 * 
 * For each stock independently:
 * - Window [t-d+1, t] must have at least d valid (non-NaN) values
 * - If window has fewer than d valid values, result is NaN
 * - Returns the percentile rank of x[t] within the window in [0, 1]
 * - Tied values receive average rank
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - result[t][i] = rank of x[t][i] within window [t-d+1, t], or NaN if < d valid values
 * - All non-NaN outputs are in [0, 1]
 * - NaN values in window are ignored (not counted)
 * 
 * @param x - Input matrix
 * @param d - Window size
 * @returns Matrix with rolling rank values in [0, 1] or NaN
 */
export function ts_rank(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    for (let t = 0; t < x.nDays; t++) {
      // Collect values in window [t-d+1, t]
      const values: number[] = [];
      
      for (let k = t - d + 1; k <= t; k++) {
        if (k >= 0) {
          const value = x.data[k * x.nStocks + i];
          if (!isNaN(value)) {
            values.push(value);
          }
        }
      }
      
      // Need at least d valid values
      if (values.length < d) {
        result.data[t * x.nStocks + i] = NaN;
        continue;
      }
      
      // Handle single value case
      if (values.length === 1) {
        result.data[t * x.nStocks + i] = 0.5;
        continue;
      }
      
      // Get the current value (last in window)
      const currentValue = values[values.length - 1];
      
      // Sort values to determine rank
      const sorted = [...values].sort((a, b) => a - b);
      
      // Find the rank of currentValue
      // Count how many values are strictly less than currentValue
      let countLess = 0;
      let countEqual = 0;
      
      for (const v of sorted) {
        if (v < currentValue) {
          countLess++;
        } else if (v === currentValue) {
          countEqual++;
        }
      }
      
      // Average rank for ties: (first_rank + last_rank) / 2 / (n - 1)
      // first_rank is countLess, last_rank is countLess + countEqual - 1
      const avgRank = (countLess + (countLess + countEqual - 1)) / 2;
      const normalizedRank = avgRank / (values.length - 1);
      
      result.data[t * x.nStocks + i] = normalizedRank;
    }
  }
  
  return result;
}

// ============================================================================
// Element-Wise Arithmetic Operators
// ============================================================================

/**
 * Element-wise addition: result[t][i] = x[t][i] + y[t][i]
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function add(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    result.data[idx] = x.data[idx] + y.data[idx];
  }

  return result;
}

/**
 * Element-wise subtraction: result[t][i] = x[t][i] - y[t][i]
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function sub(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    result.data[idx] = x.data[idx] - y.data[idx];
  }

  return result;
}

/**
 * Element-wise multiplication: result[t][i] = x[t][i] * y[t][i]
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function mul(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    result.data[idx] = x.data[idx] * y.data[idx];
  }

  return result;
}

/**
 * Element-wise division: result[t][i] = x[t][i] / y[t][i]
 * Division by zero returns NaN
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function div(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const divisor = y.data[idx];
    // Division by zero returns NaN (per spec)
    if (divisor === 0) {
      result.data[idx] = NaN;
    } else {
      result.data[idx] = x.data[idx] / divisor;
    }
  }

  return result;
}

// ============================================================================
// Unary Operators
// ============================================================================

/**
 * Unary negation: result[t][i] = -x[t][i]
 * NaN propagates: if input is NaN, result is NaN
 */
export function neg(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    result.data[idx] = -x.data[idx];
  }

  return result;
}

/**
 * Absolute value: result[t][i] = |x[t][i]|
 * NaN propagates: if input is NaN, result is NaN
 */
export function abs_op(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    result.data[idx] = Math.abs(x.data[idx]);
  }

  return result;
}

/**
 * Sign function: result[t][i] = 1 if x[t][i] > 0, -1 if x[t][i] < 0, 0 if x[t][i] = 0
 * NaN propagates: if input is NaN, result is NaN
 */
export function sign_op(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const val = x.data[idx];
    if (Number.isNaN(val)) {
      result.data[idx] = NaN;
    } else if (val > 0) {
      result.data[idx] = 1;
    } else if (val < 0) {
      result.data[idx] = -1;
    } else {
      result.data[idx] = 0;
    }
  }

  return result;
}

/**
 * Natural logarithm: result[t][i] = ln(x[t][i])
 * log(x) where x <= 0 returns NaN
 * NaN propagates: if input is NaN, result is NaN
 */
export function log_op(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const val = x.data[idx];
    // log of non-positive value returns NaN (per spec)
    if (val <= 0) {
      result.data[idx] = NaN;
    } else {
      result.data[idx] = Math.log(val);
    }
  }

  return result;
}

/**
 * Square root: result[t][i] = sqrt(x[t][i])
 * sqrt(x) where x < 0 returns NaN
 * NaN propagates: if input is NaN, result is NaN
 */
export function sqrt_op(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    result.data[idx] = Math.sqrt(x.data[idx]);
  }

  return result;
}

// ============================================================================
// Comparison Operators
// ============================================================================

/**
 * Less than: result[t][i] = 1 if x[t][i] < y[t][i], else 0
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function lt(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : (a < b ? 1 : 0);
  }

  return result;
}

/**
 * Greater than: result[t][i] = 1 if x[t][i] > y[t][i], else 0
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function gt(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : (a > b ? 1 : 0);
  }

  return result;
}

/**
 * Less than or equal: result[t][i] = 1 if x[t][i] <= y[t][i], else 0
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function lte(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : (a <= b ? 1 : 0);
  }

  return result;
}

/**
 * Greater than or equal: result[t][i] = 1 if x[t][i] >= y[t][i], else 0
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function gte(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : (a >= b ? 1 : 0);
  }

  return result;
}

/**
 * Equal: result[t][i] = 1 if x[t][i] == y[t][i], else 0
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function eq(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : (a === b ? 1 : 0);
  }

  return result;
}

// ============================================================================
// Min/Max Operators
// ============================================================================

/**
 * Element-wise maximum: result[t][i] = max(x[t][i], y[t][i])
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function max_op(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : Math.max(a, b);
  }

  return result;
}

/**
 * Element-wise minimum: result[t][i] = min(x[t][i], y[t][i])
 * NaN propagates: if either operand is NaN, result is NaN
 */
export function min_op(x: Matrix, y: Matrix): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);
  const len = x.data.length;

  for (let idx = 0; idx < len; idx++) {
    const a = x.data[idx];
    const b = y.data[idx];
    result.data[idx] = (Number.isNaN(a) || Number.isNaN(b)) ? NaN : Math.min(a, b);
  }

  return result;
}

// ============================================================================
// Conditional Operator
// ============================================================================

/**
 * Conditional operator: result[t][i] = a[t][i] if cond[t][i] != 0, else b[t][i]
 * 
 * NaN propagation rules (special case):
 * - If cond[t][i] is NaN, result is NaN
 * - If cond[t][i] != 0 and a[t][i] is NaN, result is NaN
 * - If cond[t][i] == 0 and b[t][i] is NaN, result is NaN
 * - NaN from the unselected branch does NOT propagate
 */
export function if_else(cond: Matrix, a: Matrix, b: Matrix): Matrix {
  if (cond.nDays !== a.nDays || cond.nStocks !== a.nStocks ||
      a.nDays !== b.nDays || a.nStocks !== b.nStocks) {
    throw new Error(`Matrix dimensions must match: cond(${cond.nDays}×${cond.nStocks}), a(${a.nDays}×${a.nStocks}), b(${b.nDays}×${b.nStocks})`);
  }

  const result = createMatrix(cond.nDays, cond.nStocks);
  const len = cond.data.length;

  for (let idx = 0; idx < len; idx++) {
    const c = cond.data[idx];
    
    if (Number.isNaN(c)) {
      // NaN condition -> NaN result
      result.data[idx] = NaN;
    } else if (c !== 0) {
      // Condition is true (non-zero) -> select a
      result.data[idx] = a.data[idx];
    } else {
      // Condition is false (zero) -> select b
      result.data[idx] = b.data[idx];
    }
  }

  return result;
}

// ============================================================================
// Scalar Broadcasting
// ============================================================================

/**
 * Creates a matrix with all elements set to the given scalar value.
 * Used for broadcasting scalar literals to matrix dimensions.
 * 
 * @param value - The scalar value to broadcast
 * @param nDays - Number of days (rows)
 * @param nStocks - Number of stocks (columns)
 * @returns A matrix with all elements set to value
 */
export function scalar_to_matrix(value: number, nDays: number, nStocks: number): Matrix {
  const result = createMatrix(nDays, nStocks);
  
  if (Number.isNaN(value)) {
    // Already initialized to NaN by createMatrix
    return result;
  }
  
  result.data.fill(value);
  return result;
}


// ============================================================================
// Cross-Sectional Operators (per day, across stocks)
// ============================================================================

/**
 * Computes percentile rank across stocks for each day independently.
 * 
 * - Output values are in [0, 1] or NaN
 * - NaN inputs produce NaN outputs at the same positions
 * - Tied values receive the average rank
 * - A single valid value in a row receives 0.5
 * - Monotonic: if x[t][i] < x[t][j], then rank(x)[t][i] <= rank(x)[t][j]
 * 
 * @param x - Input matrix
 * @returns Matrix with ranks in [0, 1] or NaN
 */
export function rank(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);

  // Process each day independently
  for (let t = 0; t < x.nDays; t++) {
    const offset = t * x.nStocks;
    
    // Collect non-NaN values with their indices
    const row: Array<{ value: number; index: number }> = [];
    
    for (let i = 0; i < x.nStocks; i++) {
      const value = x.data[offset + i];
      if (!isNaN(value)) {
        row.push({ value, index: i });
      }
    }

    // Handle edge cases
    if (row.length === 0) {
      // All NaN: output all NaN (already initialized to NaN)
      continue;
    }

    if (row.length === 1) {
      // Single valid value: gets 0.5
      result.data[offset + row[0].index] = 0.5;
      continue;
    }

    // Sort by value (ascending)
    row.sort((a, b) => a.value - b.value);

    // Assign ranks with tie handling (average rank for ties)
    let i = 0;
    while (i < row.length) {
      let j = i;
      // Find all tied values
      while (j < row.length && row[j].value === row[i].value) {
        j++;
      }

      // Average rank for ties: (i + (j-1)) / 2 / (n-1)
      // This normalizes to [0, 1] where 0 is lowest and 1 is highest
      const avgRank = ((i + j - 1) / 2) / (row.length - 1);

      // Assign to all tied elements
      for (let k = i; k < j; k++) {
        result.data[offset + row[k].index] = avgRank;
      }

      i = j;
    }

    // NaN positions are already NaN (from initialization)
  }

  return result;
}

/**
 * Computes z-score (standardized value) across stocks for each day independently.
 * 
 * - Formula: (x - mean) / std
 * - NaN inputs produce NaN outputs at the same positions
 * - NaN values are ignored in mean and std calculations
 * - All-equal rows return all 0 (std = 0)
 * - All-NaN rows return all NaN
 * 
 * @param x - Input matrix
 * @returns Matrix with z-scores
 */
export function zscore(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);

  // Process each day independently
  for (let t = 0; t < x.nDays; t++) {
    const offset = t * x.nStocks;

    // Collect non-NaN values
    const validValues: number[] = [];
    for (let i = 0; i < x.nStocks; i++) {
      const value = x.data[offset + i];
      if (!isNaN(value)) {
        validValues.push(value);
      }
    }

    // Handle edge cases
    if (validValues.length === 0) {
      // All NaN: output all NaN (already initialized to NaN)
      continue;
    }

    // Compute mean
    let sum = 0;
    for (const value of validValues) {
      sum += value;
    }
    const mean = sum / validValues.length;

    // Compute standard deviation (population std)
    let sumSquaredDiff = 0;
    for (const value of validValues) {
      const diff = value - mean;
      sumSquaredDiff += diff * diff;
    }
    const std = Math.sqrt(sumSquaredDiff / validValues.length);

    // Apply z-score transformation
    if (std === 0) {
      // All values are equal: return 0 for all valid values
      for (let i = 0; i < x.nStocks; i++) {
        const value = x.data[offset + i];
        if (!isNaN(value)) {
          result.data[offset + i] = 0;
        }
      }
    } else {
      // Normal case: (x - mean) / std
      for (let i = 0; i < x.nStocks; i++) {
        const value = x.data[offset + i];
        if (!isNaN(value)) {
          result.data[offset + i] = (value - mean) / std;
        }
      }
    }

    // NaN positions are already NaN (from initialization)
  }

  return result;
}

/**
 * Normalizes each day so sum(|values|) = 1 or all zero.
 * 
 * Algorithm:
 * 1. Collect valid (non-NaN) values
 * 2. Compute mean of valid values
 * 3. Demean: subtract mean from each valid value
 * 4. Compute sum of absolute values
 * 5. Scale: divide by sum(|values|) if sum > 0
 * 
 * Edge cases:
 * - All NaN: output all NaN
 * - All zero after demeaning: output all zero
 * - Mixed NaN: NaN positions preserved
 * 
 * @param x - Input matrix
 * @returns Matrix with scaled values
 */
export function scale(x: Matrix): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);

  // Process each day independently
  for (let t = 0; t < x.nDays; t++) {
    const offset = t * x.nStocks;

    // Collect non-NaN values and their indices
    const validIndices: number[] = [];
    const validValues: number[] = [];
    
    for (let i = 0; i < x.nStocks; i++) {
      const value = x.data[offset + i];
      if (!isNaN(value)) {
        validIndices.push(i);
        validValues.push(value);
      }
    }

    // Handle edge case: all NaN
    if (validValues.length === 0) {
      // Output all NaN (already initialized to NaN)
      continue;
    }

    // Step 1: Demean (compute mean and subtract from each value)
    let sum = 0;
    for (const value of validValues) {
      sum += value;
    }
    const mean = sum / validValues.length;

    const demeaned: number[] = [];
    for (const value of validValues) {
      demeaned.push(value - mean);
    }

    // Step 2: Compute sum of absolute values
    let sumAbs = 0;
    for (const value of demeaned) {
      sumAbs += Math.abs(value);
    }

    // Step 3: Scale by sum(|values|)
    if (sumAbs === 0) {
      // All values are equal (all became 0 after demeaning)
      // Output all zeros for valid positions
      for (const i of validIndices) {
        result.data[offset + i] = 0;
      }
    } else {
      // Normal case: scale so sum(|values|) = 1
      for (let j = 0; j < validIndices.length; j++) {
        const i = validIndices[j];
        result.data[offset + i] = demeaned[j] / sumAbs;
      }
    }

    // NaN positions are already NaN (from initialization)
  }

  return result;
}

/**
 * Subtracts the group mean from each stock in that group.
 * 
 * Algorithm:
 * 1. For each group (sector), collect valid (non-NaN) values
 * 2. Compute group mean
 * 3. Subtract group mean from each stock in that group
 * 
 * Edge cases:
 * - All NaN in a group: output all NaN for that group
 * - Single stock in a group: output 0 (value - mean = value - value = 0)
 * - Mixed NaN: NaN positions preserved
 * 
 * @param x - Input matrix (values to neutralize)
 * @param groups - Matrix with group labels (typically sector)
 * @returns Matrix with group-neutralized values
 */
export function group_neutralize(x: Matrix, groups: Matrix): Matrix {
  if (x.nDays !== groups.nDays || x.nStocks !== groups.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs groups(${groups.nDays}×${groups.nStocks})`);
  }

  const result = createMatrix(x.nDays, x.nStocks);

  // Process each day independently
  for (let t = 0; t < x.nDays; t++) {
    const offset = t * x.nStocks;

    // Build map of group -> stocks in that group with valid values
    const groupMap = new Map<number, Array<{ index: number; value: number }>>();

    for (let i = 0; i < x.nStocks; i++) {
      const value = x.data[offset + i];
      const group = groups.data[offset + i];

      // Skip if either value or group is NaN
      if (!isNaN(value) && !isNaN(group)) {
        if (!groupMap.has(group)) {
          groupMap.set(group, []);
        }
        groupMap.get(group)!.push({ index: i, value });
      }
    }

    // For each group, compute mean and subtract from each stock
    for (const [_group, stocks] of groupMap) {
      if (stocks.length === 0) {
        continue;
      }

      // Compute group mean
      let groupSum = 0;
      for (const stock of stocks) {
        groupSum += stock.value;
      }
      const groupMean = groupSum / stocks.length;

      // Subtract group mean from each stock in the group
      for (const stock of stocks) {
        result.data[offset + stock.index] = stock.value - groupMean;
      }
    }

    // NaN positions are already NaN (from initialization)
  }

  return result;
}

/**
 * ts_decay_linear: Compute weighted mean with linear decay weights.
 * 
 * For each stock independently:
 * - Window [t-d+1, t] must have at least d valid (non-NaN) values
 * - If window has fewer than d valid values, result is NaN
 * - Weights: d, d-1, d-2, ..., 1 (newest value gets heaviest weight d)
 * - Formula: (d*x[t] + (d-1)*x[t-1] + ... + 1*x[t-d+1]) / (d + d-1 + ... + 1)
 * 
 * Preconditions:
 * - x is a valid Matrix
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - result[t][i] = weighted mean with linear decay, or NaN if < d valid values
 * - Newest value x[t] receives heaviest weight (d)
 * - Oldest value x[t-d+1] receives lightest weight (1)
 * 
 * @param x - Input matrix
 * @param d - Window size
 * @returns Matrix with linearly decayed weighted mean values
 */
export function ts_decay_linear(x: Matrix, d: number): Matrix {
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    for (let t = 0; t < x.nDays; t++) {
      // Collect values in window [t-d+1, t]
      const values: number[] = [];
      
      for (let k = t - d + 1; k <= t; k++) {
        if (k >= 0) {
          const value = x.data[k * x.nStocks + i];
          if (!isNaN(value)) {
            values.push(value);
          }
        }
      }
      
      // Need at least d valid values
      if (values.length < d) {
        result.data[t * x.nStocks + i] = NaN;
        continue;
      }
      
      // Apply linear decay weights: d, d-1, ..., 1
      // The newest value (values[values.length - 1]) gets weight d
      // The oldest value (values[0]) gets weight 1
      let weightedSum = 0;
      let weightSum = 0;
      
      for (let j = 0; j < values.length; j++) {
        // Weight for position j: (j + 1) since oldest is 1, newest is d
        const weight = j + 1;
        weightedSum += weight * values[j];
        weightSum += weight;
      }
      
      result.data[t * x.nStocks + i] = weightedSum / weightSum;
    }
  }
  
  return result;
}

/**
 * ts_corr: Compute Pearson correlation coefficient over rolling window.
 * 
 * For each stock independently:
 * - Window [t-d+1, t] must have at least d valid (non-NaN) pairs
 * - If window has fewer than d valid pairs, result is NaN
 * - Returns Pearson correlation coefficient in [-1, 1] or NaN
 * - Output is clamped to [-1, 1] to handle floating-point rounding
 * - If either series has zero variance in window, result is NaN
 * 
 * Preconditions:
 * - x and y are valid Matrices with same dimensions
 * - d >= 1 (integer)
 * 
 * Postconditions:
 * - Returns Matrix with same dimensions as x
 * - result[t][i] = Pearson correlation of x and y over window, or NaN
 * - All non-NaN outputs are in [-1, 1] (clamped)
 * - NaN if window has fewer than d valid pairs
 * - NaN if either series has zero variance
 * 
 * @param x - First input matrix
 * @param y - Second input matrix
 * @param d - Window size
 * @returns Matrix with correlation values in [-1, 1] or NaN
 */
export function ts_corr(x: Matrix, y: Matrix, d: number): Matrix {
  if (x.nDays !== y.nDays || x.nStocks !== y.nStocks) {
    throw new Error(`Matrix dimensions must match: x(${x.nDays}×${x.nStocks}) vs y(${y.nDays}×${y.nStocks})`);
  }
  
  const result = createMatrix(x.nDays, x.nStocks);
  
  // Process each stock independently
  for (let i = 0; i < x.nStocks; i++) {
    for (let t = 0; t < x.nDays; t++) {
      // Collect window values - only pairs where both x and y are valid
      const xWindow: number[] = [];
      const yWindow: number[] = [];
      
      for (let k = t - d + 1; k <= t; k++) {
        if (k >= 0) {
          const xVal = x.data[k * x.nStocks + i];
          const yVal = y.data[k * y.nStocks + i];
          if (!isNaN(xVal) && !isNaN(yVal)) {
            xWindow.push(xVal);
            yWindow.push(yVal);
          }
        }
      }
      
      // Need at least d valid pairs
      if (xWindow.length < d) {
        result.data[t * x.nStocks + i] = NaN;
        continue;
      }
      
      // Compute Pearson correlation
      const n = xWindow.length;
      
      // Compute means
      let sumX = 0;
      let sumY = 0;
      for (let j = 0; j < n; j++) {
        sumX += xWindow[j];
        sumY += yWindow[j];
      }
      const meanX = sumX / n;
      const meanY = sumY / n;
      
      // Compute covariance and variances
      let sumXY = 0;
      let sumX2 = 0;
      let sumY2 = 0;
      
      for (let j = 0; j < n; j++) {
        const dx = xWindow[j] - meanX;
        const dy = yWindow[j] - meanY;
        sumXY += dx * dy;
        sumX2 += dx * dx;
        sumY2 += dy * dy;
      }
      
      // Compute correlation
      const denominator = Math.sqrt(sumX2 * sumY2);
      
      if (denominator === 0) {
        // Zero variance in one or both series
        result.data[t * x.nStocks + i] = NaN;
      } else {
        const corr = sumXY / denominator;
        // Clamp to [-1, 1] to handle floating-point rounding
        result.data[t * x.nStocks + i] = Math.max(-1, Math.min(1, corr));
      }
    }
  }
  
  return result;
}
