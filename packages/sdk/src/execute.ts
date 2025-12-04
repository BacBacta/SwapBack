/**
 * Execute module
 */

import type { Connection, Keypair } from "@solana/web3.js";

export interface ExecuteParams {
  /** Serialized transaction from quote/execute API */
  transactionBase64: string;
  /** Optional signer if server doesn't sign */
  signer?: Keypair;
}

export interface ExecuteResult {
  signature: string;
  success: boolean;
}

export async function executeSwap(
  connection: Connection,
  params: ExecuteParams
): Promise<ExecuteResult> {
  const rawTx = Buffer.from(params.transactionBase64, "base64");

  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    maxRetries: 3,
  });

  const latestBlockhash = await connection.getLatestBlockhash();
  const confirmation = await connection.confirmTransaction(
    { signature, ...latestBlockhash },
    "confirmed"
  );

  return {
    signature,
    success: !confirmation.value.err,
  };
}
