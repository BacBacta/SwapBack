/**
 * Shim for `rpc-websockets/dist/lib/client/websocket.browser`.
 * Provides a minimal WebSocket factory that works in browsers and Node runtimes
 * used by Next.js without pulling the native `ws` dependency when unavailable.
 */

const { EventEmitter } = require('events');

let WebSocketImpl = typeof WebSocket !== 'undefined' ? WebSocket : null;
try {
  if (!WebSocketImpl) {
    // eslint-disable-next-line global-require
    WebSocketImpl = require('ws');
  }
} catch (err) {
  WebSocketImpl = null;
}

function normalizeUrl(address) {
  if (typeof address !== 'string') {
    throw new TypeError(`Invalid WebSocket URL: ${address}`);
  }

  let url = address.trim();
  if (/^https?:\/\//i.test(url)) {
    url = url.replace(/^http/i, 'ws');
  }

  if (!/^wss?:\/\//i.test(url)) {
    throw new TypeError(`Invalid WebSocket URL: ${address}`);
  }

  return url;
}

function createInMemorySocket() {
  const emitter = new EventEmitter();
  const shim = {
    readyState: 1,
    send: () => {},
    close: (code, reason) => {
      shim.readyState = 3;
      queueMicrotask(() => emitter.emit('close', { code, reason }));
    },
    addEventListener: emitter.on.bind(emitter),
    removeEventListener: emitter.off ? emitter.off.bind(emitter) : emitter.removeListener.bind(emitter),
  };

  queueMicrotask(() => emitter.emit('open'));
  emitter.on('message', () => {});

  return shim;
}

function createWebSocket(address, options = {}, protocols) {
  try {
    const url = normalizeUrl(address);

    if (!WebSocketImpl) {
      return createInMemorySocket();
    }

    const socket = new WebSocketImpl(url, protocols);
    if (!socket.addEventListener && socket.on) {
      // Normalize Node ws interface to browser-like for rpc-websockets
      socket.addEventListener = (event, handler) => {
        socket.on(event, (...args) => handler(...args));
      };
    }
    return socket;
  } catch (error) {
    const emitter = new EventEmitter();
    queueMicrotask(() => emitter.emit('error', error));
    emitter.addEventListener = emitter.on.bind(emitter);
    emitter.removeEventListener = emitter.off ? emitter.off.bind(emitter) : emitter.removeListener.bind(emitter);
    emitter.send = () => {};
    emitter.close = () => {};
    return emitter;
  }
}

module.exports = createWebSocket;
module.exports.default = createWebSocket;
module.exports.WebSocket = WebSocketImpl;
