import { BN } from '@coral-xyz/anchor';

const BNPrototype = BN.prototype as unknown as {
  _initArray?: (src: unknown, base?: number | 'hex', endian?: 'le' | 'be') => BN;
  __swapbackPatched?: boolean;
};

if (BNPrototype && !BNPrototype.__swapbackPatched && typeof BNPrototype._initArray === 'function') {
  const originalInitArray = BNPrototype._initArray;

  BNPrototype._initArray = function patchedInitArray(
    src: unknown,
    base?: number | 'hex',
    endian?: 'le' | 'be'
  ) {
    if (src && typeof (src as { length?: number }).length === 'number') {
      const length = (src as { length?: number }).length ?? 0;
      if (length === 0) {
        const safeBuffer = new Uint8Array([0]);
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[BNGuard] Empty buffer received; injecting zero byte to prevent assertion');
        }
        return originalInitArray.call(this, safeBuffer, base, endian);
      }
    }

    return originalInitArray.call(this, src, base, endian);
  } as typeof BNPrototype._initArray;

  BNPrototype.__swapbackPatched = true;
}
