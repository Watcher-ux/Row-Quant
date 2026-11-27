/**
 * Unit tests for the evaluator.
 *
 * Tests evaluate() with all AST node types, error cases, and operator dispatch.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, type EvaluationContext } from '../../src/engine/evaluate.js';
import type { ASTNode, Matrix } from '../../src/engine/ast.js';
import { createMatrix } from '../../src/engine/ast.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a simple test context with minimal data.
 */
function createTestContext(): EvaluationContext {
  const nDays = 5;
  const nStocks = 3;

  // Create test matrices with simple values
  const close = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      close.data[t * nStocks + i] = 100 + t * 10 + i;
    }
  }

  const open = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      open.data[t * nStocks + i] = 99 + t * 10 + i;
    }
  }

  const volume = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      volume.data[t * nStocks + i] = 1000000 + t * 100000;
    }
  }

  const returns = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    for (let i = 0; i < nStocks; i++) {
      returns.data[t * nStocks + i] = 0.01 * (t + 1);
    }
  }

  const sector = createMatrix(nDays, nStocks);
  for (let t = 0; t < nDays; t++) {
    sector.data[t * nStocks + 0] = 1; // Tech
    sector.data[t * nStocks + 1] = 2; // Finance
    sector.data[t * nStocks + 2] = 1; // Tech
  }

  return {
    data: {
      open,
      high: open, // Simplified
      low: open, // Simplified
      close,
      volume,
      vwap: close, // Simplified
      returns,
      sector,
    },
    cells: new Map(),
  };
}

/**
 * Checks if a matrix has all elements equal to a value.
 */
function allElementsEqual(matrix: Matrix, value: number): boolean {
  for (let i = 0; i < matrix.data.length; i++) {
    if (Number.isNaN(value)) {
      if (!Number.isNaN(matrix.data[i])) return false;
    } else {
      if (matrix.data[i] !== value) return false;
    }
  }
  return true;
}

// ============================================================================
// Literal Node Tests
// ============================================================================

describe('evaluate - Literal nodes', () => {
  it('should broadcast scalar 42 to matrix', () => {
    const context = createTestContext();
    const ast: ASTNode = { type: 'Literal', value: 42 };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nDays).toBe(5);
      expect(result.value.nStocks).toBe(3);
      expect(allElementsEqual(result.value, 42)).toBe(true);
    }
  });

  it('should broadcast scalar 0 to matrix', () => {
    const context = createTestContext();
    const ast: ASTNode = { type: 'Literal', value: 0 };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 0)).toBe(true);
    }
  });

  it('should broadcast negative scalar to matrix', () => {
    const context = createTestContext();
    const ast: ASTNode = { type: 'Literal', value: -3.14 };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, -3.14)).toBe(true);
    }
  });

  it('should broadcast NaN to matrix', () => {
    const context = createTestContext();
    const ast: ASTNode = { type: 'Literal', value: NaN };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, NaN)).toBe(true);
    }
  });
});

// ============================================================================
// DataField Node Tests
// ============================================================================

describe('evaluate - DataField nodes', () => {
  it('should resolve close field', () => {
    const context = createTestContext();
    const ast: ASTNode = { type: 'DataField', name: 'close' };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(context.data.close);
    }
  });

  it('should resolve all data fields', () => {
    const context = createTestContext();
    const fields: Array<'open' | 'high' | 'low' | 'close' | 'volume' | 'vwap' | 'returns' | 'sector'> = [
      'open',
      'high',
      'low',
      'close',
      'volume',
      'vwap',
      'returns',
      'sector',
    ];

    for (const field of fields) {
      const ast: ASTNode = { type: 'DataField', name: field };
      const result = evaluate(ast, context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(context.data[field]);
      }
    }
  });

  it('should return error for undefined field (simulated)', () => {
    const context = createTestContext();
    // Remove a field to simulate undefined
    const modifiedContext = { ...context, data: { ...context.data, close: undefined as any } };
    const ast: ASTNode = { type: 'DataField', name: 'close' };

    const result = evaluate(ast, modifiedContext);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Unknown data field');
      expect(result.error.message).toContain('close');
    }
  });
});

// ============================================================================
// CellRef Node Tests
// ============================================================================

describe('evaluate - CellRef nodes', () => {
  it('should resolve defined cell reference', () => {
    const context = createTestContext();
    const cellMatrix = createMatrix(5, 3);
    cellMatrix.data.fill(99);
    context.cells.set('A1', cellMatrix);

    const ast: ASTNode = { type: 'CellRef', cell: 'A1' };
    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(cellMatrix);
    }
  });

  it('should resolve multiple cell references', () => {
    const context = createTestContext();
    
    const a1 = createMatrix(5, 3);
    a1.data.fill(10);
    context.cells.set('A1', a1);

    const b2 = createMatrix(5, 3);
    b2.data.fill(20);
    context.cells.set('B2', b2);

    const astA1: ASTNode = { type: 'CellRef', cell: 'A1' };
    const resultA1 = evaluate(astA1, context);

    expect(resultA1.ok).toBe(true);
    if (resultA1.ok) {
      expect(resultA1.value).toBe(a1);
    }

    const astB2: ASTNode = { type: 'CellRef', cell: 'B2' };
    const resultB2 = evaluate(astB2, context);

    expect(resultB2.ok).toBe(true);
    if (resultB2.ok) {
      expect(resultB2.value).toBe(b2);
    }
  });

  it('should return error for undefined cell reference', () => {
    const context = createTestContext();
    const ast: ASTNode = { type: 'CellRef', cell: 'Z99' };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Undefined cell reference');
      expect(result.error.message).toContain('Z99');
    }
  });
});

// ============================================================================
// UnaryOp Node Tests
// ============================================================================

describe('evaluate - UnaryOp nodes', () => {
  it('should evaluate negation', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'neg',
      operand: { type: 'Literal', value: 42 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, -42)).toBe(true);
    }
  });

  it('should evaluate abs', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'abs',
      operand: { type: 'Literal', value: -5 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 5)).toBe(true);
    }
  });

  it('should evaluate sign', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'sign',
      operand: { type: 'Literal', value: 42 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 1)).toBe(true);
    }
  });

  it('should evaluate log', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'log',
      operand: { type: 'Literal', value: Math.E },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // log(e) ≈ 1
      expect(Math.abs(result.value.data[0] - 1)).toBeLessThan(1e-10);
    }
  });

  it('should evaluate sqrt', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'sqrt',
      operand: { type: 'Literal', value: 9 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 3)).toBe(true);
    }
  });

  it('should propagate error from operand', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'neg',
      operand: { type: 'CellRef', cell: 'UNDEFINED' },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Undefined cell reference');
    }
  });
});

// ============================================================================
// BinaryOp Node Tests
// ============================================================================

describe('evaluate - BinaryOp nodes', () => {
  it('should evaluate addition', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'Literal', value: 10 },
      right: { type: 'Literal', value: 32 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 42)).toBe(true);
    }
  });

  it('should evaluate subtraction', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'sub',
      left: { type: 'Literal', value: 50 },
      right: { type: 'Literal', value: 8 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 42)).toBe(true);
    }
  });

  it('should evaluate multiplication', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'mul',
      left: { type: 'Literal', value: 6 },
      right: { type: 'Literal', value: 7 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 42)).toBe(true);
    }
  });

  it('should evaluate division', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'div',
      left: { type: 'Literal', value: 84 },
      right: { type: 'Literal', value: 2 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 42)).toBe(true);
    }
  });

  it('should evaluate comparison operators', () => {
    const context = createTestContext();

    const tests: Array<{ op: 'lt' | 'gt' | 'lte' | 'gte' | 'eq'; left: number; right: number; expected: number }> = [
      { op: 'lt', left: 1, right: 2, expected: 1 },
      { op: 'lt', left: 2, right: 1, expected: 0 },
      { op: 'gt', left: 2, right: 1, expected: 1 },
      { op: 'gt', left: 1, right: 2, expected: 0 },
      { op: 'lte', left: 1, right: 1, expected: 1 },
      { op: 'gte', left: 1, right: 1, expected: 1 },
      { op: 'eq', left: 5, right: 5, expected: 1 },
      { op: 'eq', left: 5, right: 6, expected: 0 },
    ];

    for (const test of tests) {
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: test.op,
        left: { type: 'Literal', value: test.left },
        right: { type: 'Literal', value: test.right },
      };

      const result = evaluate(ast, context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(allElementsEqual(result.value, test.expected)).toBe(true);
      }
    }
  });

  it('should evaluate max and min', () => {
    const context = createTestContext();

    const maxAst: ASTNode = {
      type: 'BinaryOp',
      op: 'max',
      left: { type: 'Literal', value: 10 },
      right: { type: 'Literal', value: 20 },
    };

    const maxResult = evaluate(maxAst, context);
    expect(maxResult.ok).toBe(true);
    if (maxResult.ok) {
      expect(allElementsEqual(maxResult.value, 20)).toBe(true);
    }

    const minAst: ASTNode = {
      type: 'BinaryOp',
      op: 'min',
      left: { type: 'Literal', value: 10 },
      right: { type: 'Literal', value: 20 },
    };

    const minResult = evaluate(minAst, context);
    expect(minResult.ok).toBe(true);
    if (minResult.ok) {
      expect(allElementsEqual(minResult.value, 10)).toBe(true);
    }
  });

  it('should propagate error from left operand', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'CellRef', cell: 'UNDEFINED' },
      right: { type: 'Literal', value: 1 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Undefined cell reference');
    }
  });

  it('should propagate error from right operand', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'Literal', value: 1 },
      right: { type: 'CellRef', cell: 'UNDEFINED' },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Undefined cell reference');
    }
  });
});

// ============================================================================
// FunctionCall Node Tests
// ============================================================================

describe('evaluate - FunctionCall nodes', () => {
  it('should evaluate rank function', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'rank',
      args: [{ type: 'DataField', name: 'close' }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // rank should produce values in [0, 1] or NaN
      for (let i = 0; i < result.value.data.length; i++) {
        const val = result.value.data[i];
        if (!Number.isNaN(val)) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('should evaluate ts_delay function', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'ts_delay',
      args: [{ type: 'DataField', name: 'close' }, { type: 'Literal', value: 1 }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // First row should be NaN (delay 1)
      for (let i = 0; i < 3; i++) {
        expect(Number.isNaN(result.value.data[i])).toBe(true);
      }
      // Second row should equal first row of close
      for (let i = 0; i < 3; i++) {
        expect(result.value.data[3 + i]).toBe(context.data.close.data[i]);
      }
    }
  });

  it('should evaluate ts_corr function', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'ts_corr',
      args: [
        { type: 'DataField', name: 'close' },
        { type: 'DataField', name: 'volume' },
        { type: 'Literal', value: 3 },
      ],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // ts_corr should produce values in [-1, 1] or NaN
      for (let i = 0; i < result.value.data.length; i++) {
        const val = result.value.data[i];
        if (!Number.isNaN(val)) {
          expect(val).toBeGreaterThanOrEqual(-1);
          expect(val).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('should evaluate if_else function', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'if_else',
      args: [
        { type: 'Literal', value: 1 }, // condition (non-zero = true)
        { type: 'Literal', value: 42 }, // then branch
        { type: 'Literal', value: 99 }, // else branch
      ],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(allElementsEqual(result.value, 42)).toBe(true);
    }
  });

  it('should return error for wrong argument count', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'rank',
      args: [{ type: 'Literal', value: 1 }, { type: 'Literal', value: 2 }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('expects 1 argument');
      expect(result.error.message).toContain('got 2');
    }
  });

  it('should return error for missing arguments', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'ts_delay',
      args: [{ type: 'Literal', value: 1 }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('expects 2 argument');
      expect(result.error.message).toContain('got 1');
    }
  });

  it('should propagate error from function arguments', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'rank',
      args: [{ type: 'CellRef', cell: 'UNDEFINED' }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Undefined cell reference');
    }
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('evaluate - Error handling', () => {
  it('should handle dimension mismatch errors from operators', () => {
    const context = createTestContext();

    // Create a cell with wrong dimensions
    const wrongMatrix = createMatrix(2, 2);
    context.cells.set('WRONG', wrongMatrix);

    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'DataField', name: 'close' },
      right: { type: 'CellRef', cell: 'WRONG' },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('dimensions must match');
    }
  });

  it('should handle invalid window parameters', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'ts_delay',
      args: [{ type: 'DataField', name: 'close' }, { type: 'Literal', value: -1 }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('positive integer parameter');
    }
  });

  it('should handle NaN window parameters', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'ts_delay',
      args: [{ type: 'DataField', name: 'close' }, { type: 'Literal', value: NaN }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('numeric parameter');
    }
  });

  it('should handle non-integer window parameters', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'ts_delay',
      args: [{ type: 'DataField', name: 'close' }, { type: 'Literal', value: 2.5 }],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('positive integer parameter');
    }
  });
});

// ============================================================================
// Complex Expression Tests
// ============================================================================

describe('evaluate - Complex expressions', () => {
  it('should evaluate nested expression: rank(ts_delta(close, 5))', () => {
    const context = createTestContext();
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'rank',
      args: [
        {
          type: 'FunctionCall',
          name: 'ts_delta',
          args: [{ type: 'DataField', name: 'close' }, { type: 'Literal', value: 2 }],
        },
      ],
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nDays).toBe(5);
      expect(result.value.nStocks).toBe(3);
    }
  });

  it('should evaluate expression with cell reference: A1 + close', () => {
    const context = createTestContext();
    
    const a1 = createMatrix(5, 3);
    a1.data.fill(10);
    context.cells.set('A1', a1);

    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'CellRef', cell: 'A1' },
      right: { type: 'DataField', name: 'close' },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Verify that result = A1 + close
      for (let i = 0; i < result.value.data.length; i++) {
        expect(result.value.data[i]).toBe(a1.data[i] + context.data.close.data[i]);
      }
    }
  });

  it('should evaluate chained operations: (A1 + B1) * 2', () => {
    const context = createTestContext();
    
    const a1 = createMatrix(5, 3);
    a1.data.fill(10);
    context.cells.set('A1', a1);

    const b1 = createMatrix(5, 3);
    b1.data.fill(5);
    context.cells.set('B1', b1);

    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'mul',
      left: {
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'CellRef', cell: 'A1' },
        right: { type: 'CellRef', cell: 'B1' },
      },
      right: { type: 'Literal', value: 2 },
    };

    const result = evaluate(ast, context);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // (10 + 5) * 2 = 30
      expect(allElementsEqual(result.value, 30)).toBe(true);
    }
  });
});
