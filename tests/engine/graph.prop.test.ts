/**
 * Property-Based Tests for Dependency Graph Module
 * 
 * Tests topological ordering properties using fast-check.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DependencyGraph } from '../../src/engine/graph.js';
import type { ASTNode } from '../../src/engine/ast.js';

// ============================================================================
// Generators
// ============================================================================

/**
 * Generates a valid cell name (A1-Z99).
 */
const arbitraryCellName = (): fc.Arbitrary<string> => {
  return fc.tuple(
    fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
    fc.integer({ min: 1, max: 99 })
  ).map(([col, row]) => `${col}${row}`);
};

/**
 * Generates an acyclic dependency graph.
 * 
 * Strategy: Create cells in a topologically sorted order by construction.
 * Each cell can only reference cells that come before it in the list.
 * This guarantees no cycles.
 * 
 * Returns: { graph: DependencyGraph, cells: string[] }
 * where cells is the list of all cell names in the graph.
 */
const arbitraryAcyclicGraph = (): fc.Arbitrary<{ graph: DependencyGraph; cells: string[] }> => {
  return fc.integer({ min: 0, max: 20 }).chain(numCells => {
    if (numCells === 0) {
      return fc.constant({ graph: new DependencyGraph(), cells: [] });
    }

    // Generate unique cell names
    return fc.uniqueArray(arbitraryCellName(), { minLength: numCells, maxLength: numCells })
      .chain(cellNames => {
        // For each cell, generate dependencies from cells that come before it
        const cellDepsArbitraries = cellNames.map((cellName, index) => {
          // Can only depend on cells before this one (ensures acyclic)
          const availableDeps = cellNames.slice(0, index);
          
          if (availableDeps.length === 0) {
            // First cell has no dependencies (literal)
            return fc.constant({ cell: cellName, deps: [] });
          }

          // Generate 0 to min(3, availableDeps.length) dependencies
          const maxDeps = Math.min(3, availableDeps.length);
          return fc.uniqueArray(
            fc.constantFrom(...availableDeps),
            { minLength: 0, maxLength: maxDeps }
          ).map(deps => ({ cell: cellName, deps }));
        });

        // Combine all cell definitions
        return fc.tuple(...cellDepsArbitraries).map(cellDefs => {
          const graph = new DependencyGraph();

          // Add each cell to the graph
          for (const { cell, deps } of cellDefs) {
            let ast: ASTNode;

            if (deps.length === 0) {
              // No dependencies: literal value
              ast = { type: 'Literal', value: 42 };
            } else if (deps.length === 1) {
              // Single dependency: simple cell reference
              ast = { type: 'CellRef', cell: deps[0] };
            } else {
              // Multiple dependencies: build binary tree of additions
              ast = { type: 'CellRef', cell: deps[0] };
              for (let i = 1; i < deps.length; i++) {
                ast = {
                  type: 'BinaryOp',
                  op: 'add',
                  left: ast,
                  right: { type: 'CellRef', cell: deps[i] }
                };
              }
            }

            graph.addCell({ cell, ast });
          }

          return { graph, cells: cellNames };
        });
      });
  });
};

/**
 * Generates an acyclic graph with various structures:
 * - Chains (A -> B -> C -> D)
 * - Diamonds (A -> B,C -> D)
 * - Trees (hierarchical dependencies)
 * - Disconnected components
 */
const arbitraryDiverseAcyclicGraph = (): fc.Arbitrary<{ graph: DependencyGraph; cells: string[] }> => {
  return fc.oneof(
    // Random acyclic graph
    arbitraryAcyclicGraph(),
    
    // Chain structure: A1 -> A2 -> A3 -> ...
    fc.integer({ min: 1, max: 10 }).chain(length => {
      return fc.constant(null).map(() => {
        const graph = new DependencyGraph();
        const cells: string[] = [];

        for (let i = 1; i <= length; i++) {
          const cellName = `A${i}`;
          cells.push(cellName);

          if (i === 1) {
            // First cell: literal
            graph.addCell({ cell: cellName, ast: { type: 'Literal', value: i } });
          } else {
            // Depends on previous cell
            const prevCell = `A${i - 1}`;
            graph.addCell({ cell: cellName, ast: { type: 'CellRef', cell: prevCell } });
          }
        }

        return { graph, cells };
      });
    }),
    
    // Diamond structure: D1 <- B1,C1 <- A1
    fc.constant(null).map(() => {
      const graph = new DependencyGraph();
      
      // Top of diamond
      graph.addCell({ cell: 'D1', ast: { type: 'Literal', value: 1 } });
      
      // Middle branches
      graph.addCell({ cell: 'B1', ast: { type: 'CellRef', cell: 'D1' } });
      graph.addCell({ cell: 'C1', ast: { type: 'CellRef', cell: 'D1' } });
      
      // Bottom (depends on both branches)
      graph.addCell({
        cell: 'A1',
        ast: {
          type: 'BinaryOp',
          op: 'add',
          left: { type: 'CellRef', cell: 'B1' },
          right: { type: 'CellRef', cell: 'C1' }
        }
      });

      return { graph, cells: ['D1', 'B1', 'C1', 'A1'] };
    }),
    
    // Tree structure: multiple levels of fan-out
    fc.integer({ min: 2, max: 4 }).chain(levels => {
      return fc.constant(null).map(() => {
        const graph = new DependencyGraph();
        const cells: string[] = [];

        // Level 0: root
        graph.addCell({ cell: 'Z1', ast: { type: 'Literal', value: 0 } });
        cells.push('Z1');

        let currentLevel = ['Z1'];
        
        for (let level = 1; level < levels; level++) {
          const nextLevel: string[] = [];
          
          for (let parentIdx = 0; parentIdx < currentLevel.length; parentIdx++) {
            const parent = currentLevel[parentIdx];
            
            // Create 2 children per parent
            for (let childIdx = 0; childIdx < 2; childIdx++) {
              const cellName = `L${level}P${parentIdx}C${childIdx}`;
              cells.push(cellName);
              nextLevel.push(cellName);
              
              graph.addCell({
                cell: cellName,
                ast: { type: 'CellRef', cell: parent }
              });
            }
          }
          
          currentLevel = nextLevel;
        }

        return { graph, cells };
      });
    }),
    
    // Disconnected components: two separate chains
    fc.constant(null).map(() => {
      const graph = new DependencyGraph();
      
      // Component 1: A1 -> A2
      graph.addCell({ cell: 'A1', ast: { type: 'Literal', value: 1 } });
      graph.addCell({ cell: 'A2', ast: { type: 'CellRef', cell: 'A1' } });
      
      // Component 2: B1 -> B2
      graph.addCell({ cell: 'B1', ast: { type: 'Literal', value: 2 } });
      graph.addCell({ cell: 'B2', ast: { type: 'CellRef', cell: 'B1' } });

      return { graph, cells: ['A1', 'A2', 'B1', 'B2'] };
    })
  );
};

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: Dependency Graph', () => {
  /**
   * **Validates: Requirements 7.1**
   * 
   * Property: Topological Order
   * 
   * For any acyclic graph, the evaluation order must satisfy:
   * ∀ cell c, ∀ dependency d of c: index(d) < index(c) in the evaluation order
   * 
   * This ensures dependencies are always evaluated before their dependents.
   */
  it('topological order: dependencies come before dependents', () => {
    fc.assert(
      fc.property(arbitraryAcyclicGraph(), ({ graph, cells }) => {
        const result = graph.getEvaluationOrder();
        
        // Acyclic graph must produce a valid order
        expect(result.ok).toBe(true);
        
        if (!result.ok) return;
        
        const order = result.value;
        
        // Build index map: cell -> position in evaluation order
        const indexMap = new Map<string, number>();
        for (let i = 0; i < order.length; i++) {
          indexMap.set(order[i], i);
        }
        
        // For each cell, verify all its dependencies come before it
        for (const cell of cells) {
          const deps = graph.getDependencies(cell);
          const cellIndex = indexMap.get(cell);
          
          // Cell should be in the order
          expect(cellIndex).toBeDefined();
          
          if (cellIndex !== undefined) {
            for (const dep of deps) {
              const depIndex = indexMap.get(dep);
              
              // Dependency should be in the order
              expect(depIndex).toBeDefined();
              
              if (depIndex !== undefined) {
                // Dependency must come before dependent
                expect(depIndex).toBeLessThan(cellIndex);
              }
            }
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('topological order: diverse graph structures (chains, diamonds, trees, disconnected)', () => {
    fc.assert(
      fc.property(arbitraryDiverseAcyclicGraph(), ({ graph, cells }) => {
        const result = graph.getEvaluationOrder();
        
        // Must succeed for acyclic graphs
        expect(result.ok).toBe(true);
        
        if (!result.ok) return;
        
        const order = result.value;
        
        // Order should contain all cells
        expect(order.length).toBe(cells.length);
        
        // Build index map
        const indexMap = new Map<string, number>();
        for (let i = 0; i < order.length; i++) {
          indexMap.set(order[i], i);
        }
        
        // Verify topological property
        for (const cell of cells) {
          const deps = graph.getDependencies(cell);
          const cellIndex = indexMap.get(cell);
          
          expect(cellIndex).toBeDefined();
          
          if (cellIndex !== undefined) {
            for (const dep of deps) {
              const depIndex = indexMap.get(dep);
              expect(depIndex).toBeDefined();
              
              if (depIndex !== undefined) {
                expect(depIndex).toBeLessThan(cellIndex);
              }
            }
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('evaluation order contains all cells exactly once', () => {
    fc.assert(
      fc.property(arbitraryAcyclicGraph(), ({ graph, cells }) => {
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        
        if (!result.ok) return;
        
        const order = result.value;
        
        // Order should have same length as cells
        expect(order.length).toBe(cells.length);
        
        // Order should contain each cell exactly once
        const orderSet = new Set(order);
        expect(orderSet.size).toBe(order.length); // No duplicates
        
        for (const cell of cells) {
          expect(orderSet.has(cell)).toBe(true);
        }
      }),
      { numRuns: 1000 }
    );
  });

  it('acyclic graphs never produce cycle errors', () => {
    fc.assert(
      fc.property(arbitraryAcyclicGraph(), ({ graph }) => {
        const result = graph.getEvaluationOrder();
        expect(result.ok).toBe(true);
        
        // hasCycle should also return false
        expect(graph.hasCycle()).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('cells with no dependencies can appear anywhere before their dependents', () => {
    fc.assert(
      fc.property(arbitraryAcyclicGraph(), ({ graph, cells }) => {
        const result = graph.getEvaluationOrder();
        
        expect(result.ok).toBe(true);
        
        if (!result.ok) return;
        
        const order = result.value;
        const indexMap = new Map<string, number>();
        
        for (let i = 0; i < order.length; i++) {
          indexMap.set(order[i], i);
        }
        
        // Find cells with no dependencies (roots)
        const roots = cells.filter(cell => graph.getDependencies(cell).length === 0);
        
        // For each root, verify no other cell comes before it and depends on it
        // (This is a weaker property: roots are free to be in any order relative to each other)
        for (const root of roots) {
          const rootIndex = indexMap.get(root);
          expect(rootIndex).toBeDefined();
          
          if (rootIndex !== undefined) {
            // Any cell that depends on root must come after it
            for (const cell of cells) {
              const deps = graph.getDependencies(cell);
              if (deps.includes(root)) {
                const cellIndex = indexMap.get(cell);
                expect(cellIndex).toBeGreaterThan(rootIndex);
              }
            }
          }
        }
      }),
      { numRuns: 1000 }
    );
  });
});
