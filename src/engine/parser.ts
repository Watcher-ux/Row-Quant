/**
 * Parser for Row-Quant Formula Engine
 *
 * This module implements a hand-written recursive-descent parser that transforms
 * WorldQuant BRAIN-style expression strings into strongly-typed AST nodes.
 */

// ============================================================================
// Token Type Definitions
// ============================================================================

/**
 * TokenType represents all lexical token types recognized by the tokenizer.
 */
export type TokenType =
  | 'NUMBER'      // 42, 3.14, 1e-5, 1E+21
  | 'IDENTIFIER'  // close, rank, A1
  | 'PLUS'        // +
  | 'MINUS'       // -
  | 'STAR'        // *
  | 'SLASH'       // /
  | 'LT'          // <
  | 'GT'          // >
  | 'LTE'         // <=
  | 'GTE'         // >=
  | 'EQ'          // ==
  | 'LPAREN'      // (
  | 'RPAREN'      // )
  | 'COMMA'       // ,
  | 'EOF';        // End of file

/**
 * Token represents a lexical unit with its type, value, and position in source.
 */
export interface Token {
  type: TokenType;
  lexeme: string;      // Raw text from source
  line: number;        // Line number (1-indexed)
  column: number;      // Column number (1-indexed)
}

// ============================================================================
// Tokenizer
// ============================================================================

/**
 * Tokenizes a source expression string into a sequence of tokens.
 *
 * @param source - The expression string to tokenize
 * @returns Array of tokens including EOF token at the end
 * @throws Error if an invalid character is encountered
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  let line = 1;
  let column = 1;

  /**
   * Returns the character at the current position without consuming it.
   */
  function peek(): string {
    if (position >= source.length) return '\0';
    return source[position];
  }

  /**
   * Returns the character at position + offset without consuming it.
   */
  function peekNext(offset = 1): string {
    const pos = position + offset;
    if (pos >= source.length) return '\0';
    return source[pos];
  }

  /**
   * Consumes and returns the current character, advancing position.
   */
  function advance(): string {
    const char = source[position];
    position++;
    column++;
    return char;
  }

  /**
   * Adds a token to the tokens array.
   */
  function addToken(type: TokenType, lexeme: string, startLine: number, startColumn: number): void {
    tokens.push({
      type,
      lexeme,
      line: startLine,
      column: startColumn,
    });
  }

  /**
   * Checks if a character is a digit (0-9).
   */
  function isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  /**
   * Checks if a character is an alphabetic letter or underscore.
   */
  function isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  /**
   * Checks if a character is alphanumeric or underscore.
   */
  function isAlphaNumeric(char: string): boolean {
    return isAlpha(char) || isDigit(char);
  }

  /**
   * Checks if a character is whitespace.
   */
  function isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\r' || char === '\n';
  }

  /**
   * Tokenizes a number literal, including support for exponent notation.
   * Valid formats: 42, 3.14, 1e-5, 1E+21, 1e10
   */
  function scanNumber(): void {
    const startLine = line;
    const startColumn = column;
    const startPos = position;

    // Consume digits before decimal point
    while (isDigit(peek())) {
      advance();
    }

    // Look for decimal point followed by digits
    if (peek() === '.' && isDigit(peekNext())) {
      advance(); // consume '.'
      while (isDigit(peek())) {
        advance();
      }
    }

    // Look for exponent notation: e or E followed by optional +/- and digits
    if (peek() === 'e' || peek() === 'E') {
      const nextChar = peekNext();
      if (isDigit(nextChar) || ((nextChar === '+' || nextChar === '-') && isDigit(peekNext(2)))) {
        advance(); // consume 'e' or 'E'

        // Consume optional sign
        if (peek() === '+' || peek() === '-') {
          advance();
        }

        // Consume exponent digits
        while (isDigit(peek())) {
          advance();
        }
      }
    }

    const lexeme = source.substring(startPos, position);
    addToken('NUMBER', lexeme, startLine, startColumn);
  }

  /**
   * Tokenizes an identifier (data field, function name, or cell reference).
   */
  function scanIdentifier(): void {
    const startLine = line;
    const startColumn = column;
    const startPos = position;

    // Consume first character (alpha or underscore)
    advance();

    // Consume remaining alphanumeric characters
    while (isAlphaNumeric(peek())) {
      advance();
    }

    const lexeme = source.substring(startPos, position);
    addToken('IDENTIFIER', lexeme, startLine, startColumn);
  }

  // Main tokenization loop
  while (position < source.length) {
    const char = peek();

    // Skip whitespace
    if (isWhitespace(char)) {
      if (char === '\n') {
        line++;
        column = 0; // Will be incremented to 1 by advance()
      }
      advance();
      continue;
    }

    const startLine = line;
    const startColumn = column;

    // Single-character tokens
    switch (char) {
      case '(':
        advance();
        addToken('LPAREN', '(', startLine, startColumn);
        continue;
      case ')':
        advance();
        addToken('RPAREN', ')', startLine, startColumn);
        continue;
      case ',':
        advance();
        addToken('COMMA', ',', startLine, startColumn);
        continue;
      case '+':
        advance();
        addToken('PLUS', '+', startLine, startColumn);
        continue;
      case '-':
        advance();
        addToken('MINUS', '-', startLine, startColumn);
        continue;
      case '*':
        advance();
        addToken('STAR', '*', startLine, startColumn);
        continue;
      case '/':
        advance();
        addToken('SLASH', '/', startLine, startColumn);
        continue;
    }

    // Two-character tokens: <=, >=, ==
    if (char === '<') {
      advance();
      if (peek() === '=') {
        advance();
        addToken('LTE', '<=', startLine, startColumn);
      } else {
        addToken('LT', '<', startLine, startColumn);
      }
      continue;
    }

    if (char === '>') {
      advance();
      if (peek() === '=') {
        advance();
        addToken('GTE', '>=', startLine, startColumn);
      } else {
        addToken('GT', '>', startLine, startColumn);
      }
      continue;
    }

    if (char === '=') {
      advance();
      if (peek() === '=') {
        advance();
        addToken('EQ', '==', startLine, startColumn);
      } else {
        throw new Error(`Unexpected character '=' at line ${startLine}, column ${startColumn}. Did you mean '=='?`);
      }
      continue;
    }

    // Number literals
    if (isDigit(char)) {
      scanNumber();
      continue;
    }

    // Identifiers (data fields, function names, cell references)
    if (isAlpha(char)) {
      scanIdentifier();
      continue;
    }

    // Invalid character
    throw new Error(`Unexpected character '${char}' at line ${startLine}, column ${startColumn}`);
  }

  // Add EOF token
  addToken('EOF', '', line, column);

  return tokens;
}

// ============================================================================
// Parser Result Types
// ============================================================================

/**
 * Result type for parser operations.
 * Either contains a successful value T or an error E.
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * ParseError represents a parsing error with position information.
 */
export interface ParseError {
  message: string;
  position: number;    // Token index where error occurred
  line: number;        // Line number (1-indexed)
  column: number;      // Column number (1-indexed)
}

// ============================================================================
// Recursive-Descent Parser
// ============================================================================

import type { ASTNode, BinaryOperator, UnaryOperator } from './ast';

/**
 * Parser class encapsulates parsing state and methods.
 */
class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Parses tokens into an AST.
   * Grammar:
   *   expression     → comparison
   *   comparison     → addSub ( ( "<" | ">" | "<=" | ">=" | "==" ) addSub )*
   *   addSub         → mulDiv ( ( "+" | "-" ) mulDiv )*
   *   mulDiv         → unary ( ( "*" | "/" ) unary )*
   *   unary          → ( "-" | "abs" | "sign" | "log" | "sqrt" ) unary
   *                  | primary
   *   primary        → NUMBER
   *                  | IDENTIFIER ( "(" arguments? ")" )?
   *                  | "(" expression ")"
   *   arguments      → expression ( "," expression )*
   */
  parse(): Result<ASTNode, ParseError> {
    try {
      const expr = this.parseExpression();
      
      // Ensure we consumed all tokens (except EOF)
      if (!this.isAtEnd()) {
        return {
          ok: false,
          error: {
            message: `Unexpected token '${this.peek().lexeme}' after expression`,
            position: this.current,
            line: this.peek().line,
            column: this.peek().column,
          },
        };
      }
      
      return { ok: true, value: expr };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        return {
          ok: false,
          error: error as ParseError,
        };
      }
      throw error;
    }
  }

  /**
   * Parses an expression (top-level).
   */
  private parseExpression(): ASTNode {
    return this.parseComparison();
  }

  /**
   * Parses comparison operators (<, >, <=, >=, ==).
   */
  private parseComparison(): ASTNode {
    let expr = this.parseAddSub();

    while (this.match('LT', 'GT', 'LTE', 'GTE', 'EQ')) {
      const operator = this.previous();
      const right = this.parseAddSub();
      
      const op: BinaryOperator = 
        operator.type === 'LT' ? 'lt' :
        operator.type === 'GT' ? 'gt' :
        operator.type === 'LTE' ? 'lte' :
        operator.type === 'GTE' ? 'gte' :
        'eq';
      
      expr = { type: 'BinaryOp', op, left: expr, right };
    }

    return expr;
  }

  /**
   * Parses addition and subtraction operators.
   */
  private parseAddSub(): ASTNode {
    let expr = this.parseMulDiv();

    while (this.match('PLUS', 'MINUS')) {
      const operator = this.previous();
      const right = this.parseMulDiv();
      
      const op: BinaryOperator = operator.type === 'PLUS' ? 'add' : 'sub';
      
      expr = { type: 'BinaryOp', op, left: expr, right };
    }

    return expr;
  }

  /**
   * Parses multiplication and division operators.
   */
  private parseMulDiv(): ASTNode {
    let expr = this.parseUnary();

    while (this.match('STAR', 'SLASH')) {
      const operator = this.previous();
      const right = this.parseUnary();
      
      const op: BinaryOperator = operator.type === 'STAR' ? 'mul' : 'div';
      
      expr = { type: 'BinaryOp', op, left: expr, right };
    }

    return expr;
  }

  /**
   * Parses unary operators (-, abs, sign, log, sqrt) and function calls.
   */
  private parseUnary(): ASTNode {
    // Unary minus
    if (this.match('MINUS')) {
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: 'neg', operand };
    }

    // Unary function names (abs, sign, log, sqrt)
    if (this.check('IDENTIFIER')) {
      const identifier = this.peek();
      const name = identifier.lexeme;
      
      if (name === 'abs' || name === 'sign' || name === 'log' || name === 'sqrt') {
        this.advance();
        const operand = this.parseUnary();
        return { type: 'UnaryOp', op: name, operand };
      }
    }

    return this.parsePrimary();
  }

  /**
   * Parses primary expressions (numbers, identifiers, cell references, function calls, parentheses).
   */
  private parsePrimary(): ASTNode {
    // Number literal
    if (this.match('NUMBER')) {
      const token = this.previous();
      const value = parseFloat(token.lexeme);
      
      if (!isFinite(value)) {
        this.error(`Invalid number literal '${token.lexeme}'`, token);
      }
      
      return { type: 'Literal', value };
    }

    // Identifier (data field, cell reference, or function call)
    if (this.match('IDENTIFIER')) {
      const identifier = this.previous();
      const name = identifier.lexeme;

      // Check for function call
      if (this.match('LPAREN')) {
        // Parse arguments
        const args: ASTNode[] = [];
        
        if (!this.check('RPAREN')) {
          do {
            args.push(this.parseExpression());
          } while (this.match('COMMA'));
        }
        
        this.consume('RPAREN', `Expected ')' after function arguments`);
        
        // Function call
        return { type: 'FunctionCall', name: name as any, args };
      }

      // Cell reference (e.g., A1, B12)
      if (this.isCellReference(name)) {
        return { type: 'CellRef', cell: name };
      }

      // Data field
      return { type: 'DataField', name: name as any };
    }

    // Grouped expression
    if (this.match('LPAREN')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', `Expected ')' after expression`);
      return expr;
    }

    // Error: unexpected token
    const token = this.peek();
    this.error(`Unexpected token '${token.lexeme}'`, token);
    
    // Unreachable, but TypeScript doesn't know error() throws
    throw new Error('Unreachable');
  }

  /**
   * Checks if the identifier is a cell reference (e.g., A1, B12, Z99).
   */
  private isCellReference(name: string): boolean {
    // Cell references: one or more uppercase letters followed by one or more digits
    // Examples: A1, B12, AA5, Z99
    return /^[A-Z]+[0-9]+$/.test(name);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Checks if any of the given token types matches the current token.
   * If match found, advances and returns true.
   */
  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if the current token is of the given type without consuming it.
   */
  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  /**
   * Consumes the current token if it matches the expected type.
   * Otherwise, throws a parse error with the given message.
   */
  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    
    const token = this.peek();
    this.error(message, token);
    
    // Unreachable, but TypeScript doesn't know error() throws
    throw new Error('Unreachable');
  }

  /**
   * Returns the current token without consuming it.
   */
  private peek(): Token {
    return this.tokens[this.current];
  }

  /**
   * Returns the previous token.
   */
  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  /**
   * Consumes and returns the current token, advancing the position.
   */
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  /**
   * Checks if we've reached the end of tokens.
   */
  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  /**
   * Throws a parse error with position information.
   */
  private error(message: string, token: Token): never {
    const error: ParseError = {
      message,
      position: this.current,
      line: token.line,
      column: token.column,
    };
    throw error;
  }
}

/**
 * Parses a source expression string into an AST.
 *
 * @param source - The expression string to parse
 * @returns Result containing either the parsed AST or a ParseError
 */
export function parse(source: string): Result<ASTNode, ParseError> {
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    return parser.parse();
  } catch (error) {
    // Handle tokenization errors
    if (error instanceof Error) {
      return {
        ok: false,
        error: {
          message: error.message,
          position: 0,
          line: 1,
          column: 1,
        },
      };
    }
    throw error;
  }
}
