// Require hook for the compiled test build (CommonJS).
//
// Two jobs:
//   1. Resolve the project's "@/..." path alias — tsc type-checks it but emits
//      the specifier verbatim, so plain node can't find it.
//   2. Stub the Next.js server modules. lib/permissions.ts (imported by
//      lib/audience.ts) pulls in next/navigation and the Supabase server
//      client, neither of which can load outside a request. The functions
//      under test never call them.
//
// Plain JS on purpose: it must run before any compiled module is required.

const Module = require('module')
const path = require('path')

const OUT = path.resolve(__dirname, '..', '.test-build')
const STUBS = {
  'next/navigation': path.join(__dirname, 'stubs', 'next-navigation.js'),
  'next/cache': path.join(__dirname, 'stubs', 'next-cache.js'),
  'next/headers': path.join(__dirname, 'stubs', 'next-headers.js'),
  '@/lib/supabase/server': path.join(__dirname, 'stubs', 'supabase-server.js'),
  'next/server': path.join(__dirname, 'stubs', 'next-server.js'),
}

const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(STUBS, request)) return STUBS[request]
  if (request.startsWith('@/')) {
    return resolveFilename.call(this, path.join(OUT, request.slice(2)), ...rest)
  }
  return resolveFilename.call(this, request, ...rest)
}
