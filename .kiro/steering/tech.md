---
inclusion: always
---

# Tech

- TypeScript everywhere, strict mode. React + Vite frontend. No backend except one serverless function for the LLM call.
- Deploy: Vercel (static site + `/api/translate` function).
- Engine runs in the browser in a Web Worker so recalculation never blocks the UI.
- Matrices: `Float64Array`, row-major, shape [days][stocks]. Missing values are `NaN`, never 0.
- Data: bundled static file of daily OHLCV for ~100 US large caps (~10 years) plus a sector label per stock. Loaded once.
- Parser: hand-written recursive-descent (no parser generators). Produces a typed AST.
- Tests: Vitest for unit tests, fast-check for property-based tests. Every operator gets at least one property test.
- No `any`. No silent catch blocks. Engine functions are pure.
- Keep dependencies minimal; ask before adding a new one.
