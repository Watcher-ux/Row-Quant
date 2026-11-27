/**
 * Unit Tests for Dependency Graph Module
 */

import { describe, it, expect } from 'vitest';
import { extractCellReferences, DependencyGraph } from '../../src/engine/graph.js';
import type { ASTNode } from '../../src/engine/ast.js';

describe('extractCellReferences', () => {
  it('should return empty array for literal node', () => {
    const ast: ASTNode = { type: 'Literal', value: 42 };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual([]);
  });

  it('should return empty array for data field node', () => {
    const ast: ASTNode = { type: 'DataField', name: 'close' };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual([]);
  });

  it('should extract single cell reference', () => {
    const ast: ASTNode = { type: 'CellRef', cell: 'A1' };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual(['A1']);
  });

  it('should normalize cell references to uppercase', () => {
    const ast: ASTNode = { type: 'CellRef', cell: 'a1' };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual(['A1']);
  });

  it('should extract cell reference from unary operation', () => {
    const ast: ASTNode = {
      type: 'UnaryOp',
      op: 'neg',
      operand: { type: 'CellRef', cell: 'B2' }
    };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual(['B2']);
  });

  it('should extract cell references from binary operation', () => {
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'CellRef', cell: 'A1' },
      right: { type: 'CellRef', cell: 'B2' }
    };
    const refs = extractCellReferences(ast);
    expect(refs).toHaveLength(2);
    expect(refs).toContain('A1');
    expect(refs).toContain('B2');
  });

  it('should extract cell references from function call', () => {
    const ast: ASTNode = {
      type: 'FunctionCall',
      name: 'rank',
      args: [{ type: 'CellRef', cell: 'C3' }]
    };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual(['C3']);
  });

  it('should extract multiple cell references from complex expression', () => {
    // Expression: rank(A1 + B2) * C3
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'mul',
      left: {
        type: 'FunctionCall',
        name: 'rank',
        args: [{
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'CellRef', cell: 'A1' },
          right: { type: 'CellRef', cell: 'B2' }
        }]
      },
      right: { type: 'CellRef', cell: 'C3' }
    };
    const refs = extractCellReferences(ast);
    expect(refs).toHaveLength(3);
    expect(refs).toContain('A1');
    expect(refs).toContain('B2');
    expect(refs).toContain('C3');
  });

  it('should deduplicate cell references', () => {
    // Expression: A1 + A1
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'CellRef', cell: 'A1' },
      right: { type: 'CellRef', cell: 'A1' }
    };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual(['A1']);
  });

  it('should extract cell references from nested function calls', () => {
    // Expression: ts_delta(A1, 5) + ts_mean(B2, 10)
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: {
        type: 'FunctionCall',
        name: 'ts_delta',
        args: [
          { type: 'CellRef', cell: 'A1' },
          { type: 'Literal', value: 5 }
        ]
      },
      right: {
        type: 'FunctionCall',
        name: 'ts_mean',
        args: [
          { type: 'CellRef', cell: 'B2' },
          { type: 'Literal', value: 10 }
        ]
      }
    };
    const refs = extractCellReferences(ast);
    expect(refs).toHaveLength(2);
    expect(refs).toContain('A1');
    expect(refs).toContain('B2');
  });

  it('should handle expressions with no cell references', () => {
    // Expression: rank(close) + 42
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: {
        type: 'FunctionCall',
        name: 'rank',
        args: [{ type: 'DataField', name: 'close' }]
      },
      right: { type: 'Literal', value: 42 }
    };
    const refs = extractCellReferences(ast);
    expect(refs).toEqual([]);
  });

  it('should handle mixed case cell references', () => {
    const ast: ASTNode = {
      type: 'BinaryOp',
      op: 'add',
      left: { type: 'CellRef', cell: 'a1' },
      right: { type: 'CellRef', cell: 'A1' }
    };
    const refs = extractCellReferences(ast);
    // Should deduplicate after normalizing to uppercase
    expect(refs).toEqual(['A1']);
  });
});

describe('DependencyGraph', () => {
  describe('constructor', () => {
    it('should create an empty graph', () => {
      const graph = new DependencyGraph();
      expect(graph.size()).toBe(0);
      expect(graph.getCells()).toEqual([]);
    });
  });

  describe('addCell', () => {
    it('should add cell with no dependencies', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      graph.addCell({ cell: 'A1', ast });

      expect(graph.size()).toBe(1);
      expect(graph.getDependencies('A1')).toEqual([]);
    });

    it('should add cell with single dependency', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'CellRef', cell: 'B1' };
      graph.addCell({ cell: 'A1', ast });

      expect(graph.getDependencies('A1')).toEqual(['B1']);
    });

    it('should add cell with multiple dependencies', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'add',
        left: { type: 'CellRef', cell: 'B1' },
        right: { type: 'CellRef', cell: 'C1' }
      };
      graph.addCell({ cell: 'A1', ast });

      const deps = graph.getDependencies('A1');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('B1');
      expect(deps).toContain('C1');
    });

    it('should normalize cell name to uppercase', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      graph.addCell({ cell: 'a1', ast });

      expect(graph.getDependencies('A1')).toEqual([]);
      expect(graph.getDependencies('a1')).toEqual([]);
    });

    it('should update dependencies when cell is added again', () => {
      const graph = new DependencyGraph();
      
      // First add: A1 = B1
      const ast1: ASTNode = { type: 'CellRef', cell: 'B1' };
      graph.addCell({ cell: 'A1', ast: ast1 });
      expect(graph.getDependencies('A1')).toEqual(['B1']);

      // Update: A1 = C1
      const ast2: ASTNode = { type: 'CellRef', cell: 'C1' };
      graph.addCell({ cell: 'A1', ast: ast2 });
      expect(graph.getDependencies('A1')).toEqual(['C1']);
    });

    it('should handle complex expression with nested references', () => {
      const graph = new DependencyGraph();
      // A1 = rank(B1 + C1) * D1
      const ast: ASTNode = {
        type: 'BinaryOp',
        op: 'mul',
        left: {
          type: 'FunctionCall',
          name: 'rank',
          args: [{
            type: 'BinaryOp',
            op: 'add',
            left: { type: 'CellRef', cell: 'B1' },
            right: { type: 'CellRef', cell: 'C1' }
          }]
        },
        right: { type: 'CellRef', cell: 'D1' }
      };
      graph.addCell({ cell: 'A1', ast });

      const deps = graph.getDependencies('A1');
      expect(deps).toHaveLength(3);
      expect(deps).toContain('B1');
      expect(deps).toContain('C1');
      expect(deps).toContain('D1');
    });
  });

  describe('getDependencies', () => {
    it('should return empty array for undefined cell', () => {
      const graph = new DependencyGraph();
      expect(graph.getDependencies('A1')).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'CellRef', cell: 'B1' };
      graph.addCell({ cell: 'A1', ast });

      expect(graph.getDependencies('A1')).toEqual(['B1']);
      expect(graph.getDependencies('a1')).toEqual(['B1']);
      expect(graph.getDependencies('a1')).toEqual(['B1']);
    });
  });

  describe('getCells', () => {
    it('should return empty array for empty graph', () => {
      const graph = new DependencyGraph();
      expect(graph.getCells()).toEqual([]);
    });

    it('should return all cell names', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      
      graph.addCell({ cell: 'A1', ast });
      graph.addCell({ cell: 'B1', ast });
      graph.addCell({ cell: 'C1', ast });

      const cells = graph.getCells();
      expect(cells).toHaveLength(3);
      expect(cells).toContain('A1');
      expect(cells).toContain('B1');
      expect(cells).toContain('C1');
    });
  });

  describe('removeCell', () => {
    it('should remove cell from graph', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      graph.addCell({ cell: 'A1', ast });

      expect(graph.size()).toBe(1);
      graph.removeCell('A1');
      expect(graph.size()).toBe(0);
      expect(graph.getDependencies('A1')).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      graph.addCell({ cell: 'A1', ast });

      graph.removeCell('a1');
      expect(graph.size()).toBe(0);
    });

    it('should not throw when removing non-existent cell', () => {
      const graph = new DependencyGraph();
      expect(() => graph.removeCell('A1')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all cells', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      
      graph.addCell({ cell: 'A1', ast });
      graph.addCell({ cell: 'B1', ast });
      graph.addCell({ cell: 'C1', ast });

      expect(graph.size()).toBe(3);
      graph.clear();
      expect(graph.size()).toBe(0);
      expect(graph.getCells()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return 0 for empty graph', () => {
      const graph = new DependencyGraph();
      expect(graph.size()).toBe(0);
    });

    it('should return correct size', () => {
      const graph = new DependencyGraph();
      const ast: ASTNode = { type: 'Literal', value: 42 };
      
      graph.addCell({ cell: 'A1', ast });
      expect(graph.size()).toBe(1);

      graph.addCell({ cell: 'B1', ast });
      expect(graph.size()).toBe(2);

      graph.addCell({ cell: 'C1', ast });
      expect(graph.size()).toBe(3);
    });

    it('should not increase size when updating existing cell', () => {
      const graph = new DependencyGraph();
      const ast1: ASTNode = { type: 'Literal', value: 42 };
      const ast2: ASTNode = { type: 'Literal', value: 100 };
      
      graph.addCell({ cell: 'A1', ast: ast1 });
      expect(graph.size()).toBe(1);

      graph.addCell({ cell: 'A1', ast: ast2 });
      expect(graph.size()).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle simple chain: A1 -> B1 -> C1', () => {
      const graph = new DependencyGraph();
      
      // C1 = 42
      graph.addCell({ cell: 'C1', ast: { type: 'Literal', value: 42 } });
      
      // B1 = C1
      graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'C1' } });
      
      // A1 = B1
      graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });

      expect(graph.getDependencies('A1')).toEqual(['B1']);
      expect(graph.getDependencies('B1')).toEqual(['C1']);
      expect(graph.getDependencies('C1')).toEqual([]);
    });

    it('should handle diamond dependency: A1 -> B1,C1 -> D1', () => {
      const graph = new DependencyGraph();
      
      // D1 = 42
      graph.addCell({ cell: 'D1', ast: { type: 'Literal', value: 42 } });
      
      // B1 = D1
      graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'D1' } });
      
      // C1 = D1
      graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'D1' } });
      
      // A1 = B1 + C1
      graph.addCell({
        cell: 'A1',
        ast: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'CellRef', cell: 'B1' },
          right: { type: 'CellRef', cell: 'C1' }
        }
      });

      const a1Deps = graph.getDependencies('A1');
      expect(a1Deps).toHaveLength(2);
      expect(a1Deps).toContain('B1');
      expect(a1Deps).toContain('C1');
      expect(graph.getDependencies('B1')).toEqual(['D1']);
      expect(graph.getDependencies('C1')).toEqual(['D1']);
      expect(graph.getDependencies('D1')).toEqual([]);
    });

    it('should handle cells with mixed data fields and cell references', () => {
      const graph = new DependencyGraph();
      
      // A1 = close
      graph.addCell({ cell: 'A1', ast: { type: 'DataField', name: 'close' } });
      
      // B1 = rank(A1)
      graph.addCell({
        cell: 'B1',
        ast: {
          type: 'FunctionCall',
          name: 'rank',
          args: [{ type: 'CellRef', cell: 'A1' }]
        }
      });
      
      // C1 = B1 + volume
      graph.addCell({
        cell: 'C1',
        ast: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'CellRef', cell: 'B1' },
          right: { type: 'DataField', name: 'volume' }
        }
      });

      expect(graph.getDependencies('A1')).toEqual([]);
      expect(graph.getDependencies('B1')).toEqual(['A1']);
      expect(graph.getDependencies('C1')).toEqual(['B1']);
    });
  });

  describe('getEvaluationOrder', () => {
    describe('acyclic graphs', () => {
      it('should return empty order for empty graph', () => {
        const graph = new DependencyGraph();
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual([]);
        }
      });

      it('should return single cell for graph with one cell', () => {
        const graph = new DependencyGraph();
        graph.addCell({ cell: 'A1', ast: { type: 'Literal', value: 42 } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toEqual(['A1']);
        }
      });

      it('should return cells with no dependencies in any order', () => {
        const graph = new DependencyGraph();
        graph.addCell({ cell: 'A1', ast: { type: 'Literal', value: 1 } });
        graph.addCell({ cell: 'B1', ast: { type: 'Literal', value: 2 } });
        graph.addCell({ cell: 'C1', ast: { type: 'Literal', value: 3 } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toHaveLength(3);
          expect(result.value).toContain('A1');
          expect(result.value).toContain('B1');
          expect(result.value).toContain('C1');
        }
      });

      it('should order simple chain: C1 before B1 before A1', () => {
        const graph = new DependencyGraph();
        
        // C1 = 42
        graph.addCell({ cell: 'C1', ast: { type: 'Literal', value: 42 } });
        
        // B1 = C1
        graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'C1' } });
        
        // A1 = B1
        graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          const order = result.value;
          expect(order).toEqual(['C1', 'B1', 'A1']);
        }
      });

      it('should order diamond dependency: D1 before B1,C1 before A1', () => {
        const graph = new DependencyGraph();
        
        // D1 = 42
        graph.addCell({ cell: 'D1', ast: { type: 'Literal', value: 42 } });
        
        // B1 = D1
        graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'D1' } });
        
        // C1 = D1
        graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'D1' } });
        
        // A1 = B1 + C1
        graph.addCell({
          cell: 'A1',
          ast: {
            type: 'BinaryOp',
            op: 'add',
            left: { type: 'CellRef', cell: 'B1' },
            right: { type: 'CellRef', cell: 'C1' }
          }
        });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          const order = result.value;
          
          // D1 must come first
          expect(order[0]).toBe('D1');
          
          // A1 must come last
          expect(order[3]).toBe('A1');
          
          // B1 and C1 must come after D1 and before A1
          const b1Index = order.indexOf('B1');
          const c1Index = order.indexOf('C1');
          const d1Index = order.indexOf('D1');
          const a1Index = order.indexOf('A1');
          
          expect(b1Index).toBeGreaterThan(d1Index);
          expect(c1Index).toBeGreaterThan(d1Index);
          expect(a1Index).toBeGreaterThan(b1Index);
          expect(a1Index).toBeGreaterThan(c1Index);
        }
      });

      it('should handle complex multi-level dependencies', () => {
        const graph = new DependencyGraph();
        
        // E1 = 1
        graph.addCell({ cell: 'E1', ast: { type: 'Literal', value: 1 } });
        
        // D1 = E1
        graph.addCell({ cell: 'D1', ast: { type: 'CellRef', cell: 'E1' } });
        
        // C1 = D1
        graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'D1' } });
        
        // B1 = C1 + E1
        graph.addCell({
          cell: 'B1',
          ast: {
            type: 'BinaryOp',
            op: 'add',
            left: { type: 'CellRef', cell: 'C1' },
            right: { type: 'CellRef', cell: 'E1' }
          }
        });
        
        // A1 = B1 + D1
        graph.addCell({
          cell: 'A1',
          ast: {
            type: 'BinaryOp',
            op: 'add',
            left: { type: 'CellRef', cell: 'B1' },
            right: { type: 'CellRef', cell: 'D1' }
          }
        });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          const order = result.value;
          
          // E1 must come first
          const e1Index = order.indexOf('E1');
          const d1Index = order.indexOf('D1');
          const c1Index = order.indexOf('C1');
          const b1Index = order.indexOf('B1');
          const a1Index = order.indexOf('A1');
          
          // E1 before all
          expect(e1Index).toBe(0);
          
          // D1 after E1
          expect(d1Index).toBeGreaterThan(e1Index);
          
          // C1 after D1
          expect(c1Index).toBeGreaterThan(d1Index);
          
          // B1 after C1 and E1
          expect(b1Index).toBeGreaterThan(c1Index);
          expect(b1Index).toBeGreaterThan(e1Index);
          
          // A1 after B1 and D1 (last)
          expect(a1Index).toBeGreaterThan(b1Index);
          expect(a1Index).toBeGreaterThan(d1Index);
          expect(a1Index).toBe(order.length - 1);
        }
      });

      it('should handle disconnected components', () => {
        const graph = new DependencyGraph();
        
        // Component 1: A1 -> B1
        graph.addCell({ cell: 'B1', ast: { type: 'Literal', value: 1 } });
        graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
        
        // Component 2: C1 -> D1
        graph.addCell({ cell: 'D1', ast: { type: 'Literal', value: 2 } });
        graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'D1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        if (result.ok) {
          const order = result.value;
          
          // B1 before A1
          const a1Index = order.indexOf('A1');
          const b1Index = order.indexOf('B1');
          expect(b1Index).toBeLessThan(a1Index);
          
          // D1 before C1
          const c1Index = order.indexOf('C1');
          const d1Index = order.indexOf('D1');
          expect(d1Index).toBeLessThan(c1Index);
        }
      });
    });

    describe('cyclic graphs', () => {
      it('should detect simple self-loop', () => {
        const graph = new DependencyGraph();
        
        // A1 = A1 (self-reference)
        graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'A1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('Circular dependency');
          expect(result.error.cycle).toEqual(['A1', 'A1']);
        }
      });

      it('should detect two-cell cycle', () => {
        const graph = new DependencyGraph();
        
        // A1 = B1
        graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
        
        // B1 = A1
        graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'A1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('Circular dependency');
          
          // The cycle should be [A1, B1, A1] or [B1, A1, B1] depending on visit order
          const cycle = result.error.cycle;
          expect(cycle.length).toBe(3);
          expect(cycle[0]).toBe(cycle[cycle.length - 1]);
          expect(new Set(cycle).size).toBe(2); // Two unique cells
        }
      });

      it('should detect three-cell cycle', () => {
        const graph = new DependencyGraph();
        
        // A1 = B1
        graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
        
        // B1 = C1
        graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'C1' } });
        
        // C1 = A1
        graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'A1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('Circular dependency');
          
          const cycle = result.error.cycle;
          expect(cycle.length).toBe(4); // 3 unique + repeat of first
          expect(cycle[0]).toBe(cycle[cycle.length - 1]);
          expect(new Set(cycle).size).toBe(3); // Three unique cells
        }
      });

      it('should detect cycle in complex graph with acyclic parts', () => {
        const graph = new DependencyGraph();
        
        // Acyclic part: D1 = 42
        graph.addCell({ cell: 'D1', ast: { type: 'Literal', value: 42 } });
        
        // Cyclic part: A1 -> B1 -> C1 -> A1
        graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
        graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'C1' } });
        graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'A1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('Circular dependency');
          
          // The cycle should involve A1, B1, C1
          const cycleSet = new Set(result.error.cycle);
          expect(cycleSet.has('A1')).toBe(true);
          expect(cycleSet.has('B1')).toBe(true);
          expect(cycleSet.has('C1')).toBe(true);
        }
      });

      it('should detect cycle with multiple dependencies', () => {
        const graph = new DependencyGraph();
        
        // A1 = B1 + C1
        graph.addCell({
          cell: 'A1',
          ast: {
            type: 'BinaryOp',
            op: 'add',
            left: { type: 'CellRef', cell: 'B1' },
            right: { type: 'CellRef', cell: 'C1' }
          }
        });
        
        // B1 = 42
        graph.addCell({ cell: 'B1', ast: { type: 'Literal', value: 42 } });
        
        // C1 = A1 (creates cycle A1 -> C1 -> A1)
        graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'A1' } });
        
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain('Circular dependency');
          
          const cycleSet = new Set(result.error.cycle);
          expect(cycleSet.has('A1')).toBe(true);
          expect(cycleSet.has('C1')).toBe(true);
        }
      });
    });
  });

  describe('hasCycle', () => {
    it('should return false for empty graph', () => {
      const graph = new DependencyGraph();
      expect(graph.hasCycle()).toBe(false);
    });

    it('should return false for single cell with no dependencies', () => {
      const graph = new DependencyGraph();
      graph.addCell({ cell: 'A1', ast: { type: 'Literal', value: 42 } });
      expect(graph.hasCycle()).toBe(false);
    });

    it('should return false for acyclic chain', () => {
      const graph = new DependencyGraph();
      graph.addCell({ cell: 'C1', ast: { type: 'Literal', value: 42 } });
      graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'C1' } });
      graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
      
      expect(graph.hasCycle()).toBe(false);
    });

    it('should return true for self-loop', () => {
      const graph = new DependencyGraph();
      graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'A1' } });
      
      expect(graph.hasCycle()).toBe(true);
    });

    it('should return true for two-cell cycle', () => {
      const graph = new DependencyGraph();
      graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
      graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'A1' } });
      
      expect(graph.hasCycle()).toBe(true);
    });

    it('should return true for multi-cell cycle', () => {
      const graph = new DependencyGraph();
      graph.addCell({ cell: 'A1', ast: { type: 'CellRef', cell: 'B1' } });
      graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'C1' } });
      graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'A1' } });
      
      expect(graph.hasCycle()).toBe(true);
    });
  });
});
