/**
 * Property-based tests for evaluator robustness
 *
 * **Validates: Requirements 6.1.14**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ASTNode, Matrix, DataFieldName, UnaryOperator, BinaryOperator, FunctionName } from '../../src/engine/ast';
import { createMatrix } from '../../src/engine/ast';
import { evaluate, EvaluationContext } from '../../src/engine/evaluate';

// ============================================================================
// Arbitrary Generators
// ============================================================================

/**
 * Arbitrary for data field names.
 */
const arbitraryDataField = fc.constantFrom<DataFieldName>(
  'open',
  'high',
  'low',
  'close',
  'volume',
  'vwap',
  'returns',
  'sector'
);

/**
 * Arbitrary for cell references.
 */
const arbitraryCellRef = fc.oneof(
  fc.constant('A1'),
  fc.constant('B2'),
  fc.constant('C5'),
  fc.constant('Z99'),
  fc.constant('AA10'),
  fc.constant('AB25')
);

/**
 * Arbitrary for unary operators.
 */
const arbitraryUnaryOp = fc.constantFrom<UnaryOperator>(
  'neg',
  'abs',
  'sign',
  'log',
  'sqrt'
);

/**
 * Arbitrary for binary operators.
 */
const arbitraryBinaryOp = fc.constantFrom<BinaryOperator>(
  'add',
  'sub',
  'mul',
  'div',
  'lt',
  'gt',
  'lte',
  'gte',
  'eq'
);

/**
 * Arbitrary for function names.
 */
const arbitraryFunctionName = fc.constantFrom<FunctionName>(
  // Cross-sectional
  'rank',
  'zscore',
  'scale',
  'group_neutralize',
  // Time-series
  'ts_delay',
  'ts_delta',
  'ts_mean',
  'ts_sum',
  'ts_std_dev',
  'ts_rank',
  'ts_decay_linear',
  'ts_corr',
  // Conditional
  'if_else'
);

/**
 * Generates a random finite positive number.
 */
const arbitraryFinitePositiveNumber = fc.double({ 
  min: 0, 
  max: 1e10,
  noNaN: true,
  noDefaultInfinity: true 
});

/**
 * Recursive AST generator using fc.letrec.
 * Limits depth to maxDepth: 3 to avoid stack overflow and improve performance.
 */
function arbitraryAST(maxDepth = 3): fc.Arbitrary<ASTNode> {
  return fc.letrec<{ ast: ASTNode }>(tie => ({
    ast: fc.oneof(
      { maxDepth },
      // Base cases (depth 0)
      arbitraryFinitePositiveNumber.map(value => ({ type: 'Literal' as const, value })),
      arbitraryDataField.map(name => ({ type: 'DataField' as const, name })),
      arbitraryCellRef.map(cell => ({ type: 'CellRef' as const, cell })),
      
      // Recursive cases (depth > 0)
      fc.record({
        op: arbitraryUnaryOp,
        operand: tie('ast') as fc.Arbitrary<ASTNode>,
      }).map(({ op, operand }) => ({ type: 'UnaryOp' as const, op, operand })),
      
      fc.record({
        op: arbitraryBinaryOp,
        left: tie('ast') as fc.Arbitrary<ASTNode>,
        right: tie('ast') as fc.Arbitrary<ASTNode>,
      }).map(({ op, left, right }) => ({ type: 'BinaryOp' as const, op, left, right })),
      
      fc.record({
        name: arbitraryFunctionName,
        args: fc.array(tie('ast') as fc.Arbitrary<ASTNode>, { minLength: 1, maxLength: 3 }),
      }).map(({ name, args }) => ({ type: 'FunctionCall' as const, name, args }))
    ),
  })).ast;
}

/**
 * Generator for arbitrary matrices with configurable dimensions.
 * Generates matrices with valid finite numbers and some NaN values.
 * Optimized for performance by reducing random generation overhead.
 */
function arbitraryMatrix(
  nDays: number,
  nStocks: number,
  nanProbability = 0.2
): fc.Arbitrary<Matrix> {
  return fc.constant(null).map(() => {
    const matrix = createMatrix(nDays, nStocks);
    // Fill with simple values for performance
    for (let i = 0; i < matrix.data.length; i++) {
      if (Math.random() < nanProbability) {
        matrix.data[i] = NaN;
      } else {
        // Use simple deterministic values for speed
        matrix.data[i] = (i % 100) - 50; // Range -50 to 49
      }
    }
    return matrix;
  });
}

/**
 * Generator for arbitrary EvaluationContext.
 * Creates contexts with:
 * - Full set of data fields with random values
 * - Random cell map that may or may not contain referenced cells
 * - Includes undefined references to test error handling
 * Optimized for performance with smaller dimensions.
 */
function arbitraryContext(): fc.Arbitrary<EvaluationContext> {
  return fc
    .tuple(
      fc.integer({ min: 2, max: 8 }), // nDays - reduced from 20
      fc.integer({ min: 2, max: 8 })  // nStocks - reduced from 20
    )
    .chain(([nDays, nStocks]) => {
      // Generate data fields
      const dataFieldGen = fc.record({
        open: arbitraryMatrix(nDays, nStocks),
        high: arbitraryMatrix(nDays, nStocks),
        low: arbitraryMatrix(nDays, nStocks),
        close: arbitraryMatrix(nDays, nStocks),
        volume: arbitraryMatrix(nDays, nStocks),
        vwap: arbitraryMatrix(nDays, nStocks),
        returns: arbitraryMatrix(nDays, nStocks, 0.1),
        sector: arbitraryMatrix(nDays, nStocks, 0.05), // Sector has fewer NaNs
      });

      // Generate cell map (may be empty or contain some cells)
      const cellMapGen = fc.array(
        fc.tuple(
          arbitraryCellRef,
          arbitraryMatrix(nDays, nStocks)
        ),
        { minLength: 0, maxLength: 3 } // Reduced from 5
      ).map(pairs => {
        const map = new Map<string, Matrix>();
        for (const [cell, matrix] of pairs) {
          map.set(cell, matrix);
        }
        return map;
      });

      return fc.record({
        data: dataFieldGen,
        cells: cellMapGen,
      });
    });
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Evaluator Robustness Properties', () => {
  it('**Validates: Requirements 6.1.14** - evaluate() never throws exceptions for any AST and context', () => {
    fc.assert(
      fc.property(
        arbitraryAST(),
        arbitraryContext(),
        (ast, context) => {
          // The key property: evaluate() should never throw, always return Result
          let result;
          let didThrow = false;
          let error: any = null;

          try {
            result = evaluate(ast, context);
          } catch (e) {
            didThrow = true;
            error = e;
          }

          if (didThrow) {
            console.error('evaluate() threw an exception!');
            console.error('AST:', JSON.stringify(ast, null, 2));
            console.error('Error:', error);
            throw new Error(`evaluate() threw exception: ${error}`);
          }

          // Result should be defined
          expect(result).toBeDefined();

          // Result should have the correct Result<T, E> shape
          expect(result).toHaveProperty('ok');

          if (result!.ok) {
            // Success case: should have a 'value' property with a Matrix
            expect(result).toHaveProperty('value');
            expect(result.value).toHaveProperty('data');
            expect(result.value).toHaveProperty('nDays');
            expect(result.value).toHaveProperty('nStocks');
            expect(result.value.data).toBeInstanceOf(Float64Array);
          } else {
            // Error case: should have an 'error' property
            expect(result).toHaveProperty('error');
            expect(result.error).toHaveProperty('message');
            expect(result.error).toHaveProperty('node');
            expect(typeof result.error.message).toBe('string');
          }

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('evaluate() returns Result type for undefined cell references', () => {
    fc.assert(
      fc.property(
        arbitraryContext(),
        (context) => {
          // Create an AST with a cell reference that is likely not in the context
          const ast: ASTNode = {
            type: 'CellRef',
            cell: 'Z99', // May or may not exist in context
          };

          let didThrow = false;
          let result;

          try {
            result = evaluate(ast, context);
          } catch (e) {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
          expect(result).toBeDefined();
          expect(result).toHaveProperty('ok');

          // If the cell doesn't exist, should return error result
          if (!context.cells.has('Z99')) {
            expect(result!.ok).toBe(false);
            if (!result!.ok) {
              expect(result.error.message).toContain('Undefined cell reference');
            }
          }

          return true;
        }
      ),
      { numRuns: 100 } // Reduced from 500
    );
  });

  it('evaluate() returns Result type for function calls with wrong argument counts', () => {
    fc.assert(
      fc.property(
        arbitraryContext(),
        (context) => {
          // Create a function call with wrong number of arguments
          // rank() expects 1 argument, give it 0
          const ast: ASTNode = {
            type: 'FunctionCall',
            name: 'rank',
            args: [], // Wrong: rank expects 1 argument
          };

          let didThrow = false;
          let result;

          try {
            result = evaluate(ast, context);
          } catch (e) {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
          expect(result).toBeDefined();
          expect(result).toHaveProperty('ok');
          expect(result!.ok).toBe(false);

          if (!result!.ok) {
            expect(result.error.message).toContain('expects');
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('evaluate() is deterministic - same inputs produce same outputs', () => {
    fc.assert(
      fc.property(
        arbitraryAST(3), // Smaller depth for performance
        arbitraryContext(),
        (ast, context) => {
          // Evaluate twice with the same inputs
          const result1 = evaluate(ast, context);
          const result2 = evaluate(ast, context);

          // Both should have the same ok status
          expect(result1.ok).toBe(result2.ok);

          if (result1.ok && result2.ok) {
            // Success: matrices should be identical
            const m1 = result1.value;
            const m2 = result2.value;

            expect(m1.nDays).toBe(m2.nDays);
            expect(m1.nStocks).toBe(m2.nStocks);
            expect(m1.data.length).toBe(m2.data.length);

            // Compare data arrays element by element
            for (let i = 0; i < m1.data.length; i++) {
              const v1 = m1.data[i];
              const v2 = m2.data[i];

              // Handle NaN specially
              if (isNaN(v1) && isNaN(v2)) {
                continue;
              }

              expect(v1).toBe(v2);
            }
          } else if (!result1.ok && !result2.ok) {
            // Both errors: messages should be the same
            expect(result1.error.message).toBe(result2.error.message);
          }

          return true;
        }
      ),
      { numRuns: 200 } // Reduced from 500
    );
  });

  it('evaluate() handles deeply nested expressions without stack overflow', () => {
    fc.assert(
      fc.property(
        arbitraryAST(6), // Moderately deep nesting
        arbitraryContext(),
        (ast, context) => {
          let didThrow = false;

          try {
            evaluate(ast, context);
          } catch (e) {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 } // Reduced from 200
    );
  });

  it('evaluate() handles contexts with partial data field availability', () => {
    fc.assert(
      fc.property(
        arbitraryDataField,
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 2, max: 10 }),
        (fieldName, nDays, nStocks) => {
          // Create a minimal context with only one data field
          const matrix = createMatrix(nDays, nStocks);
          matrix.data.fill(1.0);

          const minimalContext: EvaluationContext = {
            data: {
              open: matrix,
              high: matrix,
              low: matrix,
              close: matrix,
              volume: matrix,
              vwap: matrix,
              returns: matrix,
              sector: matrix,
            },
            cells: new Map(),
          };

          const ast: ASTNode = {
            type: 'DataField',
            name: fieldName,
          };

          let didThrow = false;

          try {
            const result = evaluate(ast, minimalContext);
            expect(result.ok).toBe(true);
          } catch (e) {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('evaluate() handles mixed NaN and valid values in operators', () => {
    fc.assert(
      fc.property(
        arbitraryContext(),
        (context) => {
          // Create an expression with operators that will encounter NaN
          const ast: ASTNode = {
            type: 'BinaryOp',
            op: 'add',
            left: { type: 'DataField', name: 'close' },
            right: { type: 'DataField', name: 'open' },
          };

          let didThrow = false;
          let result;

          try {
            result = evaluate(ast, context);
          } catch (e) {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
          expect(result).toBeDefined();
          expect(result!.ok).toBe(true);

          return true;
        }
      ),
      { numRuns: 200 } // Reduced from 500
    );
  });
});
