/**
 * Unit tests for AST types and Matrix data structure
 */

import { describe, it, expect } from 'vitest';
import { createMatrix, getElement, setElement, type Matrix } from '../../src/engine/ast';

describe('Matrix Data Structure', () => {
  describe('createMatrix', () => {
    it('should create a matrix with correct dimensions', () => {
      const m = createMatrix(10, 5);
      
      expect(m.nDays).toBe(10);
      expect(m.nStocks).toBe(5);
      expect(m.data).toBeInstanceOf(Float64Array);
      expect(m.data.length).toBe(50);
    });

    it('should initialize all elements to NaN', () => {
      const m = createMatrix(3, 2);
      
      for (let i = 0; i < m.data.length; i++) {
        expect(Number.isNaN(m.data[i])).toBe(true);
      }
    });

    it('should throw error for non-positive nDays', () => {
      expect(() => createMatrix(0, 5)).toThrow('Matrix dimensions must be positive');
      expect(() => createMatrix(-1, 5)).toThrow('Matrix dimensions must be positive');
    });

    it('should throw error for non-positive nStocks', () => {
      expect(() => createMatrix(10, 0)).toThrow('Matrix dimensions must be positive');
      expect(() => createMatrix(10, -5)).toThrow('Matrix dimensions must be positive');
    });

    it('should throw error for non-integer dimensions', () => {
      expect(() => createMatrix(3.5, 5)).toThrow('Matrix dimensions must be integers');
      expect(() => createMatrix(10, 2.7)).toThrow('Matrix dimensions must be integers');
    });
  });

  describe('getElement', () => {
    it('should retrieve element from correct position (row-major)', () => {
      const m = createMatrix(3, 4);
      // Manually set a value to test retrieval
      // Position [1][2] should be at index 1 * 4 + 2 = 6
      m.data[6] = 42.5;
      
      expect(getElement(m, 1, 2)).toBe(42.5);
    });

    it('should retrieve elements from first row', () => {
      const m = createMatrix(5, 3);
      m.data[0] = 1.1;
      m.data[1] = 2.2;
      m.data[2] = 3.3;
      
      expect(getElement(m, 0, 0)).toBe(1.1);
      expect(getElement(m, 0, 1)).toBe(2.2);
      expect(getElement(m, 0, 2)).toBe(3.3);
    });

    it('should retrieve elements from last row', () => {
      const m = createMatrix(3, 2);
      // Last row starts at index (3-1) * 2 = 4
      m.data[4] = 7.7;
      m.data[5] = 8.8;
      
      expect(getElement(m, 2, 0)).toBe(7.7);
      expect(getElement(m, 2, 1)).toBe(8.8);
    });

    it('should handle NaN values correctly', () => {
      const m = createMatrix(2, 2);
      m.data[0] = NaN;
      
      expect(Number.isNaN(getElement(m, 0, 0))).toBe(true);
    });

    it('should throw error for negative day index', () => {
      const m = createMatrix(5, 3);
      
      expect(() => getElement(m, -1, 0)).toThrow('Day index out of bounds');
    });

    it('should throw error for day index >= nDays', () => {
      const m = createMatrix(5, 3);
      
      expect(() => getElement(m, 5, 0)).toThrow('Day index out of bounds');
      expect(() => getElement(m, 10, 0)).toThrow('Day index out of bounds');
    });

    it('should throw error for negative stock index', () => {
      const m = createMatrix(5, 3);
      
      expect(() => getElement(m, 0, -1)).toThrow('Stock index out of bounds');
    });

    it('should throw error for stock index >= nStocks', () => {
      const m = createMatrix(5, 3);
      
      expect(() => getElement(m, 0, 3)).toThrow('Stock index out of bounds');
      expect(() => getElement(m, 0, 10)).toThrow('Stock index out of bounds');
    });
  });

  describe('setElement', () => {
    it('should set element at correct position (row-major)', () => {
      const m = createMatrix(3, 4);
      
      setElement(m, 1, 2, 99.9);
      
      // Position [1][2] should be at index 1 * 4 + 2 = 6
      expect(m.data[6]).toBe(99.9);
      expect(getElement(m, 1, 2)).toBe(99.9);
    });

    it('should set elements in first row', () => {
      const m = createMatrix(5, 3);
      
      setElement(m, 0, 0, 1.1);
      setElement(m, 0, 1, 2.2);
      setElement(m, 0, 2, 3.3);
      
      expect(m.data[0]).toBe(1.1);
      expect(m.data[1]).toBe(2.2);
      expect(m.data[2]).toBe(3.3);
    });

    it('should set elements in last row', () => {
      const m = createMatrix(3, 2);
      
      setElement(m, 2, 0, 7.7);
      setElement(m, 2, 1, 8.8);
      
      // Last row starts at index (3-1) * 2 = 4
      expect(m.data[4]).toBe(7.7);
      expect(m.data[5]).toBe(8.8);
    });

    it('should set NaN values correctly', () => {
      const m = createMatrix(2, 2);
      
      setElement(m, 0, 0, NaN);
      
      expect(Number.isNaN(m.data[0])).toBe(true);
      expect(Number.isNaN(getElement(m, 0, 0))).toBe(true);
    });

    it('should not affect other elements', () => {
      const m = createMatrix(3, 3);
      
      setElement(m, 1, 1, 42);
      
      // Check that other elements remain NaN
      expect(Number.isNaN(getElement(m, 0, 0))).toBe(true);
      expect(Number.isNaN(getElement(m, 0, 1))).toBe(true);
      expect(Number.isNaN(getElement(m, 1, 0))).toBe(true);
      expect(Number.isNaN(getElement(m, 1, 2))).toBe(true);
      expect(Number.isNaN(getElement(m, 2, 2))).toBe(true);
    });

    it('should throw error for negative day index', () => {
      const m = createMatrix(5, 3);
      
      expect(() => setElement(m, -1, 0, 42)).toThrow('Day index out of bounds');
    });

    it('should throw error for day index >= nDays', () => {
      const m = createMatrix(5, 3);
      
      expect(() => setElement(m, 5, 0, 42)).toThrow('Day index out of bounds');
      expect(() => setElement(m, 10, 0, 42)).toThrow('Day index out of bounds');
    });

    it('should throw error for negative stock index', () => {
      const m = createMatrix(5, 3);
      
      expect(() => setElement(m, 0, -1, 42)).toThrow('Stock index out of bounds');
    });

    it('should throw error for stock index >= nStocks', () => {
      const m = createMatrix(5, 3);
      
      expect(() => setElement(m, 0, 3, 42)).toThrow('Stock index out of bounds');
      expect(() => setElement(m, 0, 10, 42)).toThrow('Stock index out of bounds');
    });
  });

  describe('Matrix Integration', () => {
    it('should allow setting and getting multiple elements', () => {
      const m = createMatrix(10, 5);
      
      // Set values in a pattern
      for (let day = 0; day < 10; day++) {
        for (let stock = 0; stock < 5; stock++) {
          setElement(m, day, stock, day * 10 + stock);
        }
      }
      
      // Verify all values
      for (let day = 0; day < 10; day++) {
        for (let stock = 0; stock < 5; stock++) {
          expect(getElement(m, day, stock)).toBe(day * 10 + stock);
        }
      }
    });

    it('should correctly handle edge positions (corners)', () => {
      const m = createMatrix(10, 8);
      
      // Top-left
      setElement(m, 0, 0, 1);
      expect(getElement(m, 0, 0)).toBe(1);
      
      // Top-right
      setElement(m, 0, 7, 2);
      expect(getElement(m, 0, 7)).toBe(2);
      
      // Bottom-left
      setElement(m, 9, 0, 3);
      expect(getElement(m, 9, 0)).toBe(3);
      
      // Bottom-right
      setElement(m, 9, 7, 4);
      expect(getElement(m, 9, 7)).toBe(4);
    });

    it('should maintain data integrity with mixed NaN and numeric values', () => {
      const m = createMatrix(3, 3);
      
      setElement(m, 0, 0, 1.5);
      setElement(m, 0, 1, NaN);
      setElement(m, 0, 2, 2.5);
      setElement(m, 1, 0, NaN);
      setElement(m, 1, 1, 3.5);
      setElement(m, 1, 2, NaN);
      
      expect(getElement(m, 0, 0)).toBe(1.5);
      expect(Number.isNaN(getElement(m, 0, 1))).toBe(true);
      expect(getElement(m, 0, 2)).toBe(2.5);
      expect(Number.isNaN(getElement(m, 1, 0))).toBe(true);
      expect(getElement(m, 1, 1)).toBe(3.5);
      expect(Number.isNaN(getElement(m, 1, 2))).toBe(true);
    });
  });
});
