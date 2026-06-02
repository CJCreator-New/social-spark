/// <reference types="vite/client" />

// Ambient shims for stray Node/test globals referenced by unused utility
// modules and test files. Keeps the TypeScript build clean without pulling in
// full @types/node.
declare const process: { env: Record<string, string | undefined> };
declare const global: typeof globalThis;
declare module 'crypto';
