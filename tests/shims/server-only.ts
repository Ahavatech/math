// Vitest's test environment has no concept of Next.js's server/client
// component boundary, so the real `server-only` package (which throws
// when imported from client code) would throw unconditionally here.
// This shim is aliased in vitest.config.ts; the real guard still applies
// in the actual Next.js build.
export {};
