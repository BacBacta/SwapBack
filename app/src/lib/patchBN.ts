import { BN as AnchorBN } from '@coral-xyz/anchor';
import BNjs from 'bn.js';

type BNish = typeof AnchorBN;

const patchBNPrototype = (BNClass: BNish | typeof BNjs) => {
  const BNPrototype = BNClass?.prototype as unknown as {
    _initArray?: (src: unknown, base?: number | 'hex', endian?: 'le' | 'be') => unknown;
    __swapbackPatched?: boolean;
  };

  if (!BNPrototype || BNPrototype.__swapbackPatched || typeof BNPrototype._initArray !== 'function') {
    return;
  }

  const originalInitArray = BNPrototype._initArray;

  let warnedEmptyBuffer = false;

  BNPrototype._initArray = function patchedInitArray(
    src: unknown,
    base?: number | 'hex',
    endian?: 'le' | 'be'
  ) {
    const length = (() => {
      if (!src) return 0;
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(src)) {
        return src.length;
      }
      if (ArrayBuffer.isView(src)) {
        return (src as ArrayBufferView).byteLength;
      }
      if (src instanceof ArrayBuffer) {
        return src.byteLength;
      }
      if (typeof (src as { length?: number }).length === 'number') {
        return (src as { length?: number }).length ?? 0;
      }
      return 0;
    })();

    if (length === 0) {
      const safeBuffer = typeof Buffer !== 'undefined' ? Buffer.from([0]) : new Uint8Array([0]);
      if (!warnedEmptyBuffer) {
        warnedEmptyBuffer = true;
        // En prod, ce cas peut arriver (buffers vides) et le patch l'absorbe.
        // Ne pas polluer la console avec un warn utilisateur.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[BNGuard] Empty buffer received; injecting zero byte to prevent assertion', {
            base,
            endian,
            stack: new Error().stack,
          });
        } else {
          console.debug('[BNGuard] Empty buffer received; injecting zero byte to prevent assertion', {
            base,
            endian,
          });
        }
      }
      return originalInitArray.call(this, safeBuffer, base, endian);
    }

    return originalInitArray.call(this, src, base, endian);
  } as typeof BNPrototype._initArray;

  BNPrototype.__swapbackPatched = true;
};

[AnchorBN, BNjs].forEach(patchBNPrototype);
