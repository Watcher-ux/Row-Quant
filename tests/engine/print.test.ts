/**
 * Unit tests for AST print() function
 */

import { describe, it, expect } from 'vitest';
import { print } from '../../src/engine/ast';
import { parse } from '../../src/engine/parser';
import type { ASTNode } from '../../src/engine/ast';

describe('AST print() function', () => {
  describe('Basic nodes', () => {
    it('should print literals', () => {
      const ast: ASTNode = { type: 'Literal', value: 42 };
      expect(print(ast)).toBe('42');
    });

    it('should print data fields', () => {
      const ast: ASTNode = { type: 'DataField', name: 'close' };
      expect(print(ast)).toBe('close');
    });

    it('should print cell references', () => {
      const ast: ASTNode = { type: 'CellRef', cell: 'A1' };
      expect(print(ast)).toBe('A1');
    });
  });

  describe('Unary operators', () => {
    it('should print negation', () => {
      const ast: ASTNode = {
        type: 'UnaryOp',
        op: 'neg',
        operand: { type: 'Literal', value: 5 },
      };
      expect(print(ast)).toBe('-5');
    });

    it('should print abs', () => {
      const ast: ASTNode = {
        type: 'UnaryOp',
        op: 'abs',
        operand: { type: 'DataField', name: 'close' },
      };
      expect(print(ast)).toBe('abs close');
    });

    it('should add parentheses for nested operations', () => {
      const ast: ASTNode = {
        type: 'UnaryOp',
        op: 'abs',
        operand: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'Literal', value: 1 },
          right: { type: 'Literal', value: 2 },
        },
      };
      expect(print(ast)).toBe('abs (1 + 2)');
    });
  });

  describe('Binary operators', () => {
    it('should print addition', () => {
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'Literal', value: 1 },
        right: { type: 'Literal', value: 2 },
      };
      expect(print(ast)).toBe('1 + 2');
    });

    it('should print multiplication', () => {
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'mul',
        left: { type: 'DataField', name: 'close' },
        right: { type: 'Literal', value: 2 },
      };
      expect(print(ast)).toBe('close * 2');
    });

    it('should preserve precedence: a + b * c', () => {
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'DataField', name: 'open' },
        right: {
          type: 'BinaryOp',
          op: 'mul',
          left: { type: 'DataField', name: 'high' },
          right: { type: 'DataField', name: 'low' },
        },
      };
      expect(print(ast)).toBe('open + high * low');
    });

    it('should add parentheses: (a + b) * c', () => {
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'mul',
        left: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'DataField', name: 'open' },
          right: { type: 'DataField', name: 'high' },
        },
        right: { type: 'DataField', name: 'low' },
      };
      expect(print(ast)).toBe('(open + high) * low');
    });

    it('should handle comparison operators', () => {
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'lt',
        left: { type: 'DataField', name: 'close' },
        right: { type: 'Literal', value: 100 },
      };
      expect(print(ast)).toBe('close < 100');
    });
  });

  describe('Function calls', () => {
    it('should print rank', () => {
      const ast: ASTNode = {
        type: 'FunctionCall',
        name: 'rank',
        args: [{ type: 'DataField', name: 'close' }],
      };
      expect(print(ast)).toBe('rank(close)');
    });

    it('should print ts_delta', () => {
      const ast: ASTNode = {
        type: 'FunctionCall',
        name: 'ts_delta',
        args: [
          { type: 'DataField', name: 'close' },
          { type: 'Literal', value: 5 },
        ],
      };
      expect(print(ast)).toBe('ts_delta(close, 5)');
    });

    it('should print if_else', () => {
      const ast: ASTNode = {
        type: 'FunctionCall',
        name: 'if_else',
        args: [
          {
            type: 'BinaryOp',
            op: 'gt',
            left: { type: 'DataField', name: 'close' },
            right: { type: 'DataField', name: 'open' },
          },
          { type: 'Literal', value: 1 },
          { type: 'Literal', value: 0 },
        ],
      };
      expect(print(ast)).toBe('if_else(close > open, 1, 0)');
    });
  });

  describe('Round-trip examples', () => {
    const testExpressions = [
      'close',
      '42',
      'A1',
      '-5',
      'abs close',
      'close + open',
      'close * 2 + open',
      '(close + open) * 2',
      'close < 100',
      'close + open < high * low',
      'rank(close)',
      'ts_delta(close, 5)',
      'rank(ts_delta(close, 5))',
      'if_else(close > open, 1, 0)',
      'scale(rank(close) + rank(volume))',
    ];

    for (const expr of testExpressions) {
      it(`should round-trip: ${expr}`, () => {
        const parseResult = parse(expr);
        expect(parseResult.ok).toBe(true);

        if (parseResult.ok) {
          const printed = print(parseResult.value);
          const reparseResult = parse(printed);

          expect(reparseResult.ok).toBe(true);
          
          if (reparseResult.ok) {
            // The re-printed version should match (may differ in whitespace)
            const reprinted = print(reparseResult.value);
            expect(reprinted).toBe(printed);
          }
        }
      });
    }
  });
});
