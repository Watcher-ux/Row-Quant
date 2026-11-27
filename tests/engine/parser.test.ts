/**
 * Unit tests for the recursive-descent parser
 */

import { describe, it, expect } from 'vitest';
import { parse, tokenize, type Token, type ParseError, type Result } from '../../src/engine/parser';
import type { ASTNode } from '../../src/engine/ast';

describe('Parser - Valid Expressions', () => {
  describe('Literals and Data Fields', () => {
    it('should parse a number literal', () => {
      const result = parse('42');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'Literal', value: 42 });
      }
    });

    it('should parse a decimal number', () => {
      const result = parse('3.14');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'Literal', value: 3.14 });
      }
    });

    it('should parse a number with exponent notation', () => {
      const result = parse('1e-5');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'Literal', value: 1e-5 });
      }
    });

    it('should parse a data field', () => {
      const result = parse('close');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'DataField', name: 'close' });
      }
    });

    it('should parse all valid data fields', () => {
      const dataFields = ['open', 'high', 'low', 'close', 'volume', 'vwap', 'returns', 'sector'];
      
      for (const field of dataFields) {
        const result = parse(field);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({ type: 'DataField', name: field });
        }
      }
    });
  });

  describe('Cell References', () => {
    it('should parse a simple cell reference', () => {
      const result = parse('A1');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'CellRef', cell: 'A1' });
      }
    });

    it('should parse cell references with multiple letters', () => {
      const result = parse('AA5');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'CellRef', cell: 'AA5' });
      }
    });

    it('should parse cell references with multiple digits', () => {
      const result = parse('B12');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'CellRef', cell: 'B12' });
      }
    });

    it('should parse Z99 cell reference', () => {
      const result = parse('Z99');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'CellRef', cell: 'Z99' });
      }
    });
  });

  describe('Binary Operations', () => {
    it('should parse addition', () => {
      const result = parse('1 + 2');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'Literal', value: 1 },
          right: { type: 'Literal', value: 2 },
        });
      }
    });

    it('should parse subtraction', () => {
      const result = parse('5 - 3');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'BinaryOp',
          op: 'sub',
          left: { type: 'Literal', value: 5 },
          right: { type: 'Literal', value: 3 },
        });
      }
    });

    it('should parse multiplication', () => {
      const result = parse('4 * 5');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'BinaryOp',
          op: 'mul',
          left: { type: 'Literal', value: 4 },
          right: { type: 'Literal', value: 5 },
        });
      }
    });

    it('should parse division', () => {
      const result = parse('10 / 2');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'BinaryOp',
          op: 'div',
          left: { type: 'Literal', value: 10 },
          right: { type: 'Literal', value: 2 },
        });
      }
    });

    it('should parse comparison operators', () => {
      const comparisons = [
        { input: '1 < 2', op: 'lt' },
        { input: '1 > 2', op: 'gt' },
        { input: '1 <= 2', op: 'lte' },
        { input: '1 >= 2', op: 'gte' },
        { input: '1 == 2', op: 'eq' },
      ];
      
      for (const { input, op } of comparisons) {
        const result = parse(input);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual({
            type: 'BinaryOp',
            op,
            left: { type: 'Literal', value: 1 },
            right: { type: 'Literal', value: 2 },
          });
        }
      }
    });
  });

  describe('Unary Operations', () => {
    it('should parse unary negation', () => {
      const result = parse('-5');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'UnaryOp',
          op: 'neg',
          operand: { type: 'Literal', value: 5 },
        });
      }
    });

    it('should parse abs function', () => {
      const result = parse('abs -5');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'UnaryOp',
          op: 'abs',
          operand: {
            type: 'UnaryOp',
            op: 'neg',
            operand: { type: 'Literal', value: 5 },
          },
        });
      }
    });

    it('should parse sign function', () => {
      const result = parse('sign close');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'UnaryOp',
          op: 'sign',
          operand: { type: 'DataField', name: 'close' },
        });
      }
    });

    it('should parse log function', () => {
      const result = parse('log 10');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'UnaryOp',
          op: 'log',
          operand: { type: 'Literal', value: 10 },
        });
      }
    });

    it('should parse sqrt function', () => {
      const result = parse('sqrt 16');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'UnaryOp',
          op: 'sqrt',
          operand: { type: 'Literal', value: 16 },
        });
      }
    });

    it('should parse nested unary operations', () => {
      const result = parse('-abs -5');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'UnaryOp',
          op: 'neg',
          operand: {
            type: 'UnaryOp',
            op: 'abs',
            operand: {
              type: 'UnaryOp',
              op: 'neg',
              operand: { type: 'Literal', value: 5 },
            },
          },
        });
      }
    });
  });

  describe('Function Calls', () => {
    it('should parse function call with one argument', () => {
      const result = parse('rank(close)');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'FunctionCall',
          name: 'rank',
          args: [{ type: 'DataField', name: 'close' }],
        });
      }
    });

    it('should parse function call with multiple arguments', () => {
      const result = parse('ts_delta(close, 5)');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'FunctionCall',
          name: 'ts_delta',
          args: [
            { type: 'DataField', name: 'close' },
            { type: 'Literal', value: 5 },
          ],
        });
      }
    });

    it('should parse function call with no arguments', () => {
      const result = parse('rank()');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'FunctionCall',
          name: 'rank',
          args: [],
        });
      }
    });

    it('should parse nested function calls', () => {
      const result = parse('rank(ts_delta(close, 5))');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'FunctionCall',
          name: 'rank',
          args: [
            {
              type: 'FunctionCall',
              name: 'ts_delta',
              args: [
                { type: 'DataField', name: 'close' },
                { type: 'Literal', value: 5 },
              ],
            },
          ],
        });
      }
    });

    it('should parse if_else with three arguments', () => {
      const result = parse('if_else(close > 100, 1, 0)');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({
          type: 'FunctionCall',
          name: 'if_else',
          args: [
            {
              type: 'BinaryOp',
              op: 'gt',
              left: { type: 'DataField', name: 'close' },
              right: { type: 'Literal', value: 100 },
            },
            { type: 'Literal', value: 1 },
            { type: 'Literal', value: 0 },
          ],
        });
      }
    });
  });

  describe('Parentheses', () => {
    it('should parse parenthesized expression', () => {
      const result = parse('(42)');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'Literal', value: 42 });
      }
    });

    it('should parse nested parentheses', () => {
      const result = parse('((5))');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ type: 'Literal', value: 5 });
      }
    });
  });
});

describe('Parser - Operator Precedence', () => {
  it('should respect multiplication over addition', () => {
    const result = parse('1 + 2 * 3');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'Literal', value: 1 },
        right: {
          type: 'BinaryOp',
          op: 'mul',
          left: { type: 'Literal', value: 2 },
          right: { type: 'Literal', value: 3 },
        },
      });
    }
  });

  it('should respect division over subtraction', () => {
    const result = parse('10 - 6 / 2');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'sub',
        left: { type: 'Literal', value: 10 },
        right: {
          type: 'BinaryOp',
          op: 'div',
          left: { type: 'Literal', value: 6 },
          right: { type: 'Literal', value: 2 },
        },
      });
    }
  });

  it('should respect unary over multiplication', () => {
    const result = parse('-2 * 3');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'mul',
        left: {
          type: 'UnaryOp',
          op: 'neg',
          operand: { type: 'Literal', value: 2 },
        },
        right: { type: 'Literal', value: 3 },
      });
    }
  });

  it('should respect parentheses over all operators', () => {
    const result = parse('(1 + 2) * 3');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'mul',
        left: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'Literal', value: 1 },
          right: { type: 'Literal', value: 2 },
        },
        right: { type: 'Literal', value: 3 },
      });
    }
  });

  it('should respect comparison below add/sub', () => {
    const result = parse('1 + 2 < 5');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'lt',
        left: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'Literal', value: 1 },
          right: { type: 'Literal', value: 2 },
        },
        right: { type: 'Literal', value: 5 },
      });
    }
  });

  it('should respect comparison below mul/div', () => {
    const result = parse('2 * 3 >= 5');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'gte',
        left: {
          type: 'BinaryOp',
          op: 'mul',
          left: { type: 'Literal', value: 2 },
          right: { type: 'Literal', value: 3 },
        },
        right: { type: 'Literal', value: 5 },
      });
    }
  });

  it('should handle left-to-right associativity for same precedence', () => {
    const result = parse('1 + 2 + 3');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'add',
        left: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'Literal', value: 1 },
          right: { type: 'Literal', value: 2 },
        },
        right: { type: 'Literal', value: 3 },
      });
    }
  });

  it('should handle complex precedence chains', () => {
    const result = parse('1 + 2 * 3 - 4 / 5');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'sub',
        left: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'Literal', value: 1 },
          right: {
            type: 'BinaryOp',
            op: 'mul',
            left: { type: 'Literal', value: 2 },
            right: { type: 'Literal', value: 3 },
          },
        },
        right: {
          type: 'BinaryOp',
          op: 'div',
          left: { type: 'Literal', value: 4 },
          right: { type: 'Literal', value: 5 },
        },
      });
    }
  });
});

describe('Parser - Complex Valid Expressions', () => {
  it('should parse a realistic alpha expression', () => {
    const result = parse('rank(ts_delta(close, 5))');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.type).toBe('FunctionCall');
    }
  });

  it('should parse cell reference in arithmetic', () => {
    const result = parse('A1 * B2');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'mul',
        left: { type: 'CellRef', cell: 'A1' },
        right: { type: 'CellRef', cell: 'B2' },
      });
    }
  });

  it('should parse deeply nested expression', () => {
    const result = parse('rank(ts_delta(close, 5) / ts_std_dev(close, 20))');
    
    expect(result.ok).toBe(true);
  });

  it('should parse expression with multiple comparisons', () => {
    const result = parse('close > open');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'gt',
        left: { type: 'DataField', name: 'close' },
        right: { type: 'DataField', name: 'open' },
      });
    }
  });

  it('should handle whitespace gracefully', () => {
    const result = parse('  1   +   2  ');
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'Literal', value: 1 },
        right: { type: 'Literal', value: 2 },
      });
    }
  });
});

describe('Parser - Invalid Expressions', () => {
  it('should report error for unexpected token at start', () => {
    const result = parse(')');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Unexpected token ')'");
      expect(result.error.line).toBe(1);
      expect(result.error.column).toBe(1);
    }
  });

  it('should report error for unexpected token after expression', () => {
    const result = parse('1 2');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Unexpected token '2'");
    }
  });

  it('should report error for missing closing parenthesis', () => {
    const result = parse('(1 + 2');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Expected ')'");
    }
  });

  it('should report error for missing opening parenthesis', () => {
    const result = parse('1 + 2)');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Unexpected token ')'");
    }
  });

  it('should report error for missing argument in function call', () => {
    const result = parse('rank(');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBeDefined();
      expect(result.error.line).toBeGreaterThanOrEqual(1);
    }
  });

  it('should report error for invalid character', () => {
    const result = parse('1 @ 2');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Unexpected character '@'");
    }
  });

  it('should report error for single equals sign', () => {
    const result = parse('1 = 2');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Did you mean '=='?");
    }
  });

  it('should report error for incomplete expression', () => {
    const result = parse('1 +');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBeDefined();
    }
  });

  it('should report error for empty string', () => {
    const result = parse('');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBeDefined();
    }
  });

  it('should report error for operator without operands', () => {
    const result = parse('*');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Unexpected token '*'");
    }
  });

  it('should report position information for errors', () => {
    const result = parse('1 + (2 *');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.position).toBeGreaterThanOrEqual(0);
      expect(result.error.line).toBeGreaterThanOrEqual(1);
      expect(result.error.column).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Tokenizer - Number Literals', () => {
  it('should tokenize integers', () => {
    const tokens = tokenize('42');
    
    expect(tokens).toHaveLength(2); // NUMBER + EOF
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].lexeme).toBe('42');
  });

  it('should tokenize decimals', () => {
    const tokens = tokenize('3.14');
    
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].lexeme).toBe('3.14');
  });

  it('should tokenize exponent notation with lowercase e', () => {
    const tokens = tokenize('1e-5');
    
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].lexeme).toBe('1e-5');
  });

  it('should tokenize exponent notation with uppercase E', () => {
    const tokens = tokenize('1E+21');
    
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].lexeme).toBe('1E+21');
  });

  it('should tokenize exponent without sign', () => {
    const tokens = tokenize('1e10');
    
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].lexeme).toBe('1e10');
  });

  it('should tokenize decimal with exponent', () => {
    const tokens = tokenize('2.5e-3');
    
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe('NUMBER');
    expect(tokens[0].lexeme).toBe('2.5e-3');
  });
});

describe('Tokenizer - Position Tracking', () => {
  it('should track line and column for single token', () => {
    const tokens = tokenize('42');
    
    expect(tokens[0].line).toBe(1);
    expect(tokens[0].column).toBe(1);
  });

  it('should track column positions for multiple tokens', () => {
    const tokens = tokenize('1 + 2');
    
    expect(tokens[0].column).toBe(1);
    expect(tokens[1].column).toBe(3);
    expect(tokens[2].column).toBe(5);
  });

  it('should track line numbers across newlines', () => {
    const tokens = tokenize('1\n+\n2');
    
    expect(tokens[0].line).toBe(1);
    expect(tokens[1].line).toBe(2);
    expect(tokens[2].line).toBe(3);
  });
});
