/**
 * SwapBack Client
 */

import { getQuote, type QuoteParams, type QuoteResult } from "./quote";
import { executeSwap, type ExecuteParams, type ExecuteResult } from "./execute";
import type { Connection } from "@solana/web3.js";

export interface SwapBackClientConfig {
  apiBase?: string;
  connection: Connection;
}

export class SwapBackClient {
  private apiBase: string;
  private connection: Connection;

  constructor(config: SwapBackClientConfig) {
    this.apiBase = config.apiBase ?? "https://swapback.io/api";
    this.connection = config.connection;
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    return getQuote(params, { apiBase: this.apiBase });
  }

  async execute(params: ExecuteParams): Promise<ExecuteResult> {
    return executeSwap(this.connection, params);
  }
}
