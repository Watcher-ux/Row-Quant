/**
 * Integration Tests for End-to-End Workflows
 * 
 * These tests verify complete workflows combining parser, evaluator, graph, and backtest modules.
 * Tests both success paths and error handling across the entire engine.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/engine/parser.js';
import { evaluate, type EvaluationContext } from '../../src/engine/evaluate.js';
import { DependencyGraph } from '../../src/engine/graph.js';
import { computeWeights, computePnL } from '../../src/engine/backtest.js';
import { createMatrix, getElement, setElement, type Matrix } from '../../src/engine/ast.js';

// ============================================================================
// Sample Market Data Helper
// ============================================================================

/**
 * Creates sample market data for integration tests.
 * 10 days × 5 stocks with realistic OHLCV data and sectors.
 */
function createSampleMarketData(): EvaluationContext['data'] {
  const nDays = 10;
  const nStocks = 5;

  // Create open prices - simple upward trend with some variation
  const open = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      setElement(open, t, i, 100 + t * 2 + i * 10 + Math.sin(t + i) * 5);
    }
  }

  // High = open + small amount
  const high = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      setElement(high, t, i, getElement(open, t, i) + 2 + Math.random());
    }
  }

  // Low = open - small amount
  const low = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      setElement(low, t, i, getElement(open, t, i) - 2 - Math.random());
    }
  }

  // Close = open + daily change
  const close = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      const dailyChange = (t % 2 === 0 ? 1 : -0.5) * (i + 1);
      setElement(close, t, i, getElement(open, t, i) + dailyChange);
    }
  }

  // Volume - varies by stock and day
  const volume = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      setElement(volume, t, i, 1000000 + t * 10000 + i * 50000);
    }
  }

  // VWAP = (high + low + close) / 3
  const vwap = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      const avg = (getElement(high, t, i) + getElement(low, t, i) + getElement(close, t, i)) / 3;
      setElement(vwap, t, i, avg);
    }
  }

  // Returns = close[t] / close[t-1] - 1
  const returns = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      if (t === 0) {
        setElement(returns, t, i, 0); // First day return = 0
      } else {
        const prevClose = getElement(close, t - 1, i);
        const currClose = getElement(close, t, i);
        setElement(returns, t, i, currClose / prevClose - 1);
      }
    }
  }

  // Sector labels - 2 sectors: 0 and 1
  const sector = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      setElement(sector, t, i, i < 3 ? 0 : 1); // Stocks 0,1,2 -> sector 0; 3,4 -> sector 1
    }
  }

  return { open, high, low, close, volume, vwap, returns, sector };
}

/**
 * Creates an evaluation context with sample market data and no cells.
 */
function createSampleContext(): EvaluationContext {
  return {
    data: createSampleMarketData(),
    cells: new Map(),
  };
}

// ============================================================================
// Integration Tests: Parse → Evaluate
// ============================================================================

describe('Integration: Parse → Evaluate', () => {
  it('should parse simple expression and evaluate to correct result', () => {
    const source = 'close + open';
    const context = createSampleContext();

    // Parse
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const ast = parseResult.value;

    // Evaluate
    const evalResult = evaluate(ast, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Verify dimensions
    expect(result.nDays).toBe(10);
    expect(result.nStocks).toBe(5);

    // Verify result = close + open for a few elements
    for (let t = 0; t < 3; t++) {
      for (let i = 0; i < 3; i++) {
        const expected = getElement(context.data.close, t, i) + getElement(context.data.open, t, i);
        const actual = getElement(result, t, i);
        expect(actual).toBeCloseTo(expected, 5);
      }
    }
  });

  it('should parse complex expression and evaluate correctly', () => {
    const source = 'rank(ts_delta(close, 5))';
    const context = createSampleContext();

    // Parse
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const ast = parseResult.value;

    // Evaluate
    const evalResult = evaluate(ast, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Verify dimensions
    expect(result.nDays).toBe(10);
    expect(result.nStocks).toBe(5);

    // First 5 days should be NaN (from ts_delta)
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 5; i++) {
        expect(isNaN(getElement(result, t, i))).toBe(true);
      }
    }

    // After day 5, rank should produce values in [0, 1]
    for (let t = 5; t < 10; t++) {
      for (let i = 0; i < 5; i++) {
        const value = getElement(result, t, i);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should parse arithmetic with literals and evaluate correctly', () => {
    const source = '(close - open) * 100';
    const context = createSampleContext();

    // Parse
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    // Evaluate
    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const result = evalResult.value;

    // Verify result = (close - open) * 100
    for (let t = 0; t < 3; t++) {
      for (let i = 0; i < 2; i++) {
        const expected = (getElement(context.data.close, t, i) - getElement(context.data.open, t, i)) * 100;
        const actual = getElement(result, t, i);
        expect(actual).toBeCloseTo(expected, 5);
      }
    }
  });
});

// ============================================================================
// Integration Tests: Parse → Evaluate → Backtest
// ============================================================================

describe('Integration: Parse → Evaluate → Backtest', () => {
  it('should backtest a simple alpha expression and compute metrics', () => {
    const source = 'ts_delta(close, 1)'; // Simple momentum: buy stocks that went up yesterday
    const context = createSampleContext();

    // Parse
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    // Evaluate to get alpha
    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;

    // Compute weights
    const weights = computeWeights(alpha);

    // Verify weight constraints for each day
    for (let t = 0; t < weights.nDays; t++) {
      let sum = 0;
      let sumAbs = 0;
      for (let i = 0; i < weights.nStocks; i++) {
        const w = getElement(weights, t, i);
        sum += w;
        sumAbs += Math.abs(w);
      }

      // Check market neutral (within tolerance)
      expect(Math.abs(sum)).toBeLessThan(1e-10);

      // Check sum|w| = 1 or all zero
      if (sumAbs > 0) {
        expect(sumAbs).toBeCloseTo(1, 10);
      }
    }

    // Compute PnL
    const { dailyPnL, cumulativePnL } = computePnL(weights, context.data.returns);

    // Verify PnL array length
    expect(dailyPnL.length).toBe(9); // nDays - 1 = 10 - 1 = 9

    // Verify cumulative PnL is monotonic relationship with daily PnL
    let cumSum = 0;
    for (let i = 0; i < dailyPnL.length; i++) {
      cumSum += dailyPnL[i];
      expect(cumulativePnL[i]).toBeCloseTo(cumSum, 10);
    }
  });

  it('should handle realistic alpha expression rank(ts_delta(close, 5))', () => {
    const source = 'rank(ts_delta(close, 5))';
    const context = createSampleContext();

    // Parse → Evaluate → Backtest
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;
    const weights = computeWeights(alpha);

    // Verify first 5 days (where alpha is all NaN) have all zero weights
    for (let t = 0; t < 5; t++) {
      for (let i = 0; i < 5; i++) {
        expect(getElement(weights, t, i)).toBe(0);
      }
    }

    // Verify days 5-9 have valid weights (sum=0, sum|w|=1)
    for (let t = 5; t < 10; t++) {
      let sum = 0;
      let sumAbs = 0;
      for (let i = 0; i < 5; i++) {
        const w = getElement(weights, t, i);
        sum += w;
        sumAbs += Math.abs(w);
      }
      expect(Math.abs(sum)).toBeLessThan(1e-10);
      expect(sumAbs).toBeCloseTo(1, 10);
    }

    // Compute PnL
    const { dailyPnL } = computePnL(weights, context.data.returns);
    expect(dailyPnL.length).toBe(9);

    // All daily PnL values should be finite
    for (const pnl of dailyPnL) {
      expect(isFinite(pnl)).toBe(true);
    }
  });
});

// ============================================================================
// Integration Tests: Cell References → Dependency Graph → Evaluation
// ============================================================================

describe('Integration: Cell References → Dependency Graph → Evaluation', () => {
  it('should evaluate cells in correct order based on dependencies', () => {
    const context = createSampleContext();

    // Define cells:
    // A1 = close
    // B1 = ts_delta(A1, 1)
    // C1 = rank(B1)

    const graph = new DependencyGraph();

    // Parse and add A1
    const a1Parse = parse('close');
    expect(a1Parse.ok).toBe(true);
    if (!a1Parse.ok) return;
    graph.addCell({ cell: 'A1', ast: a1Parse.value });

    // Parse and add B1
    const b1Parse = parse('ts_delta(A1, 1)');
    expect(b1Parse.ok).toBe(true);
    if (!b1Parse.ok) return;
    graph.addCell({ cell: 'B1', ast: b1Parse.value });

    // Parse and add C1
    const c1Parse = parse('rank(B1)');
    expect(c1Parse.ok).toBe(true);
    if (!c1Parse.ok) return;
    graph.addCell({ cell: 'C1', ast: c1Parse.value });

    // Get evaluation order
    const orderResult = graph.getEvaluationOrder();
    expect(orderResult.ok).toBe(true);
    if (!orderResult.ok) return;

    const order = orderResult.value;

    // Verify order: A1 should come before B1, B1 before C1
    const a1Index = order.indexOf('A1');
    const b1Index = order.indexOf('B1');
    const c1Index = order.indexOf('C1');

    expect(a1Index).toBeGreaterThanOrEqual(0);
    expect(b1Index).toBeGreaterThanOrEqual(0);
    expect(c1Index).toBeGreaterThanOrEqual(0);

    expect(a1Index).toBeLessThan(b1Index);
    expect(b1Index).toBeLessThan(c1Index);

    // Evaluate cells in order
    for (const cellName of order) {
      const deps = graph.getDependencies(cellName);
      const cellAst = 
        cellName === 'A1' ? a1Parse.value :
        cellName === 'B1' ? b1Parse.value :
        c1Parse.value;

      const evalResult = evaluate(cellAst, context);
      expect(evalResult.ok).toBe(true);
      if (!evalResult.ok) {
        console.error(`Failed to evaluate ${cellName}:`, evalResult.error);
        return;
      }

      // Store result for dependent cells
      context.cells.set(cellName, evalResult.value);
    }

    // Verify final result C1 = rank(ts_delta(close, 1))
    const c1Result = context.cells.get('C1');
    expect(c1Result).toBeDefined();
    if (!c1Result) return;

    // First day should be NaN (from ts_delta)
    for (let i = 0; i < 5; i++) {
      expect(isNaN(getElement(c1Result, 0, i))).toBe(true);
    }

    // Other days should have rank values in [0, 1]
    for (let t = 1; t < 10; t++) {
      for (let i = 0; i < 5; i++) {
        const value = getElement(c1Result, t, i);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should handle complex cell dependency chain', () => {
    const context = createSampleContext();
    const graph = new DependencyGraph();

    // A1 = open
    // A2 = close
    // B1 = A2 - A1
    // B2 = rank(B1)

    const cells = [
      { cell: 'A1', source: 'open' },
      { cell: 'A2', source: 'close' },
      { cell: 'B1', source: 'A2 - A1' },
      { cell: 'B2', source: 'rank(B1)' },
    ];

    // Parse and add all cells
    const asts = new Map<string, any>();
    for (const { cell, source } of cells) {
      const parseResult = parse(source);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;
      
      asts.set(cell, parseResult.value);
      graph.addCell({ cell, ast: parseResult.value });
    }

    // Get evaluation order
    const orderResult = graph.getEvaluationOrder();
    expect(orderResult.ok).toBe(true);
    if (!orderResult.ok) return;

    const order = orderResult.value;

    // Verify A1 and A2 come before B1, and B1 before B2
    const a1Index = order.indexOf('A1');
    const a2Index = order.indexOf('A2');
    const b1Index = order.indexOf('B1');
    const b2Index = order.indexOf('B2');

    expect(a1Index).toBeLessThan(b1Index);
    expect(a2Index).toBeLessThan(b1Index);
    expect(b1Index).toBeLessThan(b2Index);

    // Evaluate all cells in order
    for (const cellName of order) {
      const ast = asts.get(cellName);
      const evalResult = evaluate(ast, context);
      expect(evalResult.ok).toBe(true);
      if (!evalResult.ok) return;

      context.cells.set(cellName, evalResult.value);
    }

    // Verify B2 = rank(close - open)
    const b2Result = context.cells.get('B2');
    expect(b2Result).toBeDefined();
    if (!b2Result) return;

    // All values should be in [0, 1]
    for (let t = 0; t < 10; t++) {
      for (let i = 0; i < 5; i++) {
        const value = getElement(b2Result, t, i);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ============================================================================
// Integration Tests: Error Handling
// ============================================================================

describe('Integration: Error Handling', () => {
  it('should detect cyclic references and return error', () => {
    const graph = new DependencyGraph();

    // Create cycle: A1 -> B1 -> C1 -> A1
    const a1Parse = parse('B1 + 1');
    expect(a1Parse.ok).toBe(true);
    if (!a1Parse.ok) return;
    graph.addCell({ cell: 'A1', ast: a1Parse.value });

    const b1Parse = parse('C1 * 2');
    expect(b1Parse.ok).toBe(true);
    if (!b1Parse.ok) return;
    graph.addCell({ cell: 'B1', ast: b1Parse.value });

    const c1Parse = parse('A1 / 2');
    expect(c1Parse.ok).toBe(true);
    if (!c1Parse.ok) return;
    graph.addCell({ cell: 'C1', ast: c1Parse.value });

    // Get evaluation order - should detect cycle
    const orderResult = graph.getEvaluationOrder();
    expect(orderResult.ok).toBe(false);
    if (orderResult.ok) return;

    // Verify cycle error
    const error = orderResult.error;
    expect(error.message).toContain('Circular dependency');
    expect(error.cycle.length).toBeGreaterThan(0);
  });

  it('should return error for undefined cell reference', () => {
    const context = createSampleContext();
    
    // Parse expression with undefined cell reference
    const parseResult = parse('A1 + close');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    // Try to evaluate without A1 defined
    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(false);
    if (evalResult.ok) return;

    // Verify error
    const error = evalResult.error;
    expect(error.message).toContain('Undefined cell reference');
    expect(error.message).toContain('A1');
  });

  it('should return error for undefined data field', () => {
    const context = createSampleContext();
    
    // Parse expression with undefined field (pretend 'fake_field' parsed)
    // Note: parser won't allow this, but we can test evaluator directly
    const ast = { type: 'DataField' as const, name: 'fake_field' as any };
    
    const evalResult = evaluate(ast, context);
    expect(evalResult.ok).toBe(false);
    if (evalResult.ok) return;

    const error = evalResult.error;
    expect(error.message).toContain('Unknown data field');
  });

  it('should not evaluate when parse error occurs', () => {
    const source = 'close +'; // Incomplete expression
    const context = createSampleContext();

    // Parse should fail
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(false);
    if (parseResult.ok) return;

    // Verify parse error has position information
    const error = parseResult.error;
    expect(error.message).toBeTruthy();
    expect(error.line).toBeGreaterThan(0);
    expect(error.column).toBeGreaterThan(0);

    // Evaluation should not be attempted on parse errors
    // (this is a workflow test - we simply don't call evaluate)
  });

  it('should handle parse errors with invalid operators', () => {
    const source = 'close & open'; // Invalid operator
    
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(false);
    if (parseResult.ok) return;

    const error = parseResult.error;
    expect(error.message).toBeTruthy();
  });

  it('should handle evaluation errors from invalid function arguments', () => {
    const context = createSampleContext();
    
    // Parse expression with wrong number of arguments
    const parseResult = parse('rank(close, open)'); // rank takes 1 arg, not 2
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    // Evaluation should fail
    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(false);
    if (evalResult.ok) return;

    const error = evalResult.error;
    expect(error.message).toContain('expects');
    expect(error.message).toContain('argument');
  });
});

// ============================================================================
// Integration Tests: Realistic Alpha Expressions
// ============================================================================

describe('Integration: Realistic Alpha Expressions', () => {
  it('should evaluate realistic alpha: rank(ts_delta(close, 5))', () => {
    const source = 'rank(ts_delta(close, 5))';
    const context = createSampleContext();

    // Parse → Evaluate → Backtest full pipeline
    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;

    // Backtest
    const weights = computeWeights(alpha);
    const { dailyPnL, cumulativePnL } = computePnL(weights, context.data.returns);

    // Verify results are well-formed
    expect(dailyPnL.length).toBe(9);
    expect(cumulativePnL.length).toBe(9);

    // All PnL values should be finite
    for (let i = 0; i < dailyPnL.length; i++) {
      expect(isFinite(dailyPnL[i])).toBe(true);
      expect(isFinite(cumulativePnL[i])).toBe(true);
    }
  });

  it('should evaluate realistic alpha: zscore(ts_mean(volume, 5))', () => {
    const source = 'zscore(ts_mean(volume, 5))';
    const context = createSampleContext();

    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;

    // First 4 days should be NaN (from ts_mean window requiring d valid values)
    // ts_mean needs at least d=5 values, so first 4 days (0-3) are NaN
    for (let t = 0; t < 4; t++) {
      for (let i = 0; i < 5; i++) {
        expect(isNaN(getElement(alpha, t, i))).toBe(true);
      }
    }

    // After that (t >= 4), zscore should produce reasonable values
    for (let t = 4; t < 10; t++) {
      let hasValid = false;
      for (let i = 0; i < 5; i++) {
        const value = getElement(alpha, t, i);
        if (!isNaN(value)) {
          hasValid = true;
          expect(isFinite(value)).toBe(true);
        }
      }
      expect(hasValid).toBe(true);
    }
  });

  it('should evaluate realistic alpha: scale(close - open)', () => {
    const source = 'scale(close - open)';
    const context = createSampleContext();

    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;

    // For each day, sum of absolute values should be 1 or all zero
    for (let t = 0; t < 10; t++) {
      let sumAbs = 0;
      for (let i = 0; i < 5; i++) {
        sumAbs += Math.abs(getElement(alpha, t, i));
      }

      if (sumAbs > 0) {
        expect(sumAbs).toBeCloseTo(1, 10);
      }
    }
  });

  it('should evaluate realistic alpha: if_else(close > open, 1, -1)', () => {
    const source = 'if_else(close > open, 1, -1)';
    const context = createSampleContext();

    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;

    // All values should be either 1 or -1
    for (let t = 0; t < 10; t++) {
      for (let i = 0; i < 5; i++) {
        const value = getElement(alpha, t, i);
        const closeVal = getElement(context.data.close, t, i);
        const openVal = getElement(context.data.open, t, i);

        if (closeVal > openVal) {
          expect(value).toBe(1);
        } else {
          expect(value).toBe(-1);
        }
      }
    }
  });

  it('should evaluate realistic alpha: group_neutralize(rank(close), sector)', () => {
    const source = 'group_neutralize(rank(close), sector)';
    const context = createSampleContext();

    const parseResult = parse(source);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const evalResult = evaluate(parseResult.value, context);
    expect(evalResult.ok).toBe(true);
    if (!evalResult.ok) return;

    const alpha = evalResult.value;

    // For each day and sector, verify group mean is approximately 0
    for (let t = 0; t < 10; t++) {
      // Sector 0: stocks 0, 1, 2
      let sector0Sum = 0;
      let sector0Count = 0;
      for (let i = 0; i < 3; i++) {
        const value = getElement(alpha, t, i);
        if (!isNaN(value)) {
          sector0Sum += value;
          sector0Count++;
        }
      }
      if (sector0Count > 0) {
        const sector0Mean = sector0Sum / sector0Count;
        expect(Math.abs(sector0Mean)).toBeLessThan(1e-10);
      }

      // Sector 1: stocks 3, 4
      let sector1Sum = 0;
      let sector1Count = 0;
      for (let i = 3; i < 5; i++) {
        const value = getElement(alpha, t, i);
        if (!isNaN(value)) {
          sector1Sum += value;
          sector1Count++;
        }
      }
      if (sector1Count > 0) {
        const sector1Mean = sector1Sum / sector1Count;
        expect(Math.abs(sector1Mean)).toBeLessThan(1e-10);
      }
    }
  });
});
