/**
 * Shim for rpc-websockets v9.x
 * 
 * Some dependencies (like older @solana/web3.js internals) try to import from
 * 'rpc-websockets/dist/lib/client' or 'rpc-websockets/dist/lib/client/websocket.browser'
 * which no longer exist in v9.x.
 * 
 * This shim re-exports the main module to maintain compatibility.
 */

// Re-export everything from the main rpc-websockets module
module.exports = require('rpc-websockets');
