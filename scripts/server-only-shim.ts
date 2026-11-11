/**
 * Registers a shim for the `server-only` package so that service modules
 * that import it can run under `tsx` outside of the Next.js runtime.
 *
 * Usage: import this file BEFORE any service imports in scripts:
 *   import "./scripts/server-only-shim";
 *
 * This is the same approach as vitest.config.ts's resolve alias for
 * `server-only`, but at the Node module-resolution level for tsx.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("module");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
) {
  if (request === "server-only") {
    // Resolve to an empty module that does nothing
    return originalResolveFilename.call(
      this,
      require("path").resolve(__dirname, "../tests/shims/server-only.ts"),
      parent,
      isMain,
      options,
    );
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
