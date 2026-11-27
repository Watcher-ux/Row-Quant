/**
 * Property-based tests for parser round-trip behavior
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { ASTNode, DataFieldName, UnaryOperator, BinaryOperator, FunctionName } from '../../src/engine/ast';
import { print } from '../../src/engine/ast';
import { parse } from '../../src/engine/parser';

// ============================================================================
// AST Generators
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
 * Note: max and min are excluded because they are only parseable as function calls,
 * not as infix binary operators.
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
 * Excludes negative numbers, NaN, and Infinity to ensure valid literals.
 */
const arbitraryFinitePositiveNumber = fc.double({ 
  min: 0, 
  max: 1e10,
  noNaN: true,
  noDefaultInfinity: true 
});

/**
 * Recursive AST generator using fc.letrec.
 * Limits depth to maxDepth: 5 to avoid stack overflow.
 */
function arbitraryAST(maxDepth = 5): fc.Arbitrary<ASTNode> {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep equality check for AST nodes.
 * Handles floating-point comparison for Literal nodes.
 */
function astEqual(a: ASTNode, b: ASTNode): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'Literal':
      return b.type === 'Literal' && a.value === b.value;

    case 'DataField':
      return b.type === 'DataField' && a.name === b.name;

    case 'CellRef':
      return b.type === 'CellRef' && a.cell === b.cell;

    case 'UnaryOp':
      return b.type === 'UnaryOp' && 
             a.op === b.op && 
             astEqual(a.operand, b.operand);

    case 'BinaryOp':
      return b.type === 'BinaryOp' && 
             a.op === b.op && 
             astEqual(a.left, b.left) && 
             astEqual(a.right, b.right);

    case 'FunctionCall':
      return b.type === 'FunctionCall' && 
             a.name === b.name && 
             a.args.length === b.args.length &&
             a.args.every((arg, i) => astEqual(arg, b.args[i]));
  }
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Parser Round-Trip Properties', () => {
  it('should satisfy parse(print(ast)) = Ok(ast) for all generated ASTs', () => {
    fc.assert(
      fc.property(arbitraryAST(), (ast) => {
        // Print the AST to a string
        const printed = print(ast);

        // Parse the string back to an AST
        const parseResult = parse(printed);

        // The parse should succeed
        if (!parseResult.ok) {
          console.error('Parse failed for:', printed);
          console.error('Original AST:', JSON.stringify(ast, null, 2));
          console.error('Error:', parseResult.error);
        }
        expect(parseResult.ok).toBe(true);

        if (!parseResult.ok) return false;

        // The parsed AST should equal the original AST
        const parsed = parseResult.value;
        const equal = astEqual(ast, parsed);

        if (!equal) {
          console.error('AST mismatch!');
          console.error('Original:', JSON.stringify(ast, null, 2));
          console.error('Printed:', printed);
          console.error('Parsed:', JSON.stringify(parsed, null, 2));
        }

        expect(equal).toBe(true);
        return equal;
      }),
      { numRuns: 1000 }
    );
  });

  it('should handle deeply nested expressions', () => {
    fc.assert(
      fc.property(arbitraryAST(5), (ast) => {
        const printed = print(ast);
        const parseResult = parse(printed);

        expect(parseResult.ok).toBe(true);

        if (parseResult.ok) {
          expect(astEqual(ast, parseResult.value)).toBe(true);
        }

        return true;
      }),
      { numRuns: 500 }
    );
  });

  it('should preserve operator precedence', () => {
    // Test specific precedence-sensitive cases
    const testCases: ASTNode[] = [
      // a + b * c should parse as a + (b * c)
      {
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'DataField', name: 'close' },
        right: {
          type: 'BinaryOp',
          op: 'mul',
          left: { type: 'DataField', name: 'open' },
          right: { type: 'DataField', name: 'high' },
        },
      },
      // (a + b) * c should include parens
      {
        type: 'BinaryOp',
        op: 'mul',
        left: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'DataField', name: 'close' },
          right: { type: 'DataField', name: 'open' },
        },
        right: { type: 'DataField', name: 'high' },
      },
      // a < b + c should parse as a < (b + c)
      {
        type: 'BinaryOp',
        op: 'lt',
        left: { type: 'DataField', name: 'close' },
        right: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'DataField', name: 'open' },
          right: { type: 'DataField', name: 'high' },
        },
      },
    ];

    for (const ast of testCases) {
      const printed = print(ast);
      const parseResult = parse(printed);

      expect(parseResult.ok).toBe(true);

      if (parseResult.ok) {
        expect(astEqual(ast, parseResult.value)).toBe(true);
      }
    }
  });

  it('should handle all unary operators correctly', () => {
    fc.assert(
      fc.property(
        arbitraryUnaryOp,
        arbitraryFinitePositiveNumber,
        (op, value) => {
          const ast: ASTNode = {
            type: 'UnaryOp',
            op,
            operand: { type: 'Literal', value },
          };

          const printed = print(ast);
          const parseResult = parse(printed);

          expect(parseResult.ok).toBe(true);

          if (parseResult.ok) {
            expect(astEqual(ast, parseResult.value)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle all binary operators correctly', () => {
    fc.assert(
      fc.property(
        arbitraryBinaryOp,
        arbitraryFinitePositiveNumber,
        arbitraryFinitePositiveNumber,
        (op, leftValue, rightValue) => {
          const ast: ASTNode = {
            type: 'BinaryOp',
            op,
            left: { type: 'Literal', value: leftValue },
            right: { type: 'Literal', value: rightValue },
          };

          const printed = print(ast);
          const parseResult = parse(printed);

          expect(parseResult.ok).toBe(true);

          if (parseResult.ok) {
            expect(astEqual(ast, parseResult.value)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle function calls with various argument counts', () => {
    fc.assert(
      fc.property(
        arbitraryFunctionName,
        fc.array(arbitraryFinitePositiveNumber, { minLength: 1, maxLength: 3 }),
        (name, values) => {
          const ast: ASTNode = {
            type: 'FunctionCall',
            name,
            args: values.map(value => ({ type: 'Literal', value })),
          };

          const printed = print(ast);
          const parseResult = parse(printed);

          expect(parseResult.ok).toBe(true);

          if (parseResult.ok) {
            expect(astEqual(ast, parseResult.value)).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 200 }
    );
  });
});
