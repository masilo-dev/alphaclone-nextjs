import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * A stateless Transport implementation for the MCP SDK.
 * 
 * In a serverless environment (like Vercel App Router), persistent connections (SSE)
 * are difficult to maintain. This transport allows the official `Server` instance 
 * to handle a single incoming JSON-RPC request and immediately capture its response,
 * which can then be returned via the HTTP POST response.
 */
export class StatelessTransport implements Transport {
  public onmessage?: (message: any) => void;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  private _responseMessage: any | null = null;
  private _resolveResponse: ((msg: any) => void) | null = null;
  private _responsePromise: Promise<any>;

  constructor() {
    this._responsePromise = new Promise((resolve) => {
      this._resolveResponse = resolve;
    });
  }

  async start(): Promise<void> {
    // No initialization needed
  }

  async close(): Promise<void> {
    if (this.onclose) {
      this.onclose();
    }
  }

  /**
   * Called by the MCP SDK Server when it wants to send a message back to the client.
   */
  async send(message: any): Promise<void> {
    this._responseMessage = message;
    if (this._resolveResponse) {
      this._resolveResponse(message);
    }
  }

  /**
   * Helper to wait for the server's response to the processed message.
   * Resolves to null if no response is generated (e.g. for notifications) after a short timeout.
   */
  public async getResponse(timeoutMs = 5000): Promise<any | null> {
    // If a response was already captured synchronously, return it immediately
    if (this._responseMessage) {
      return this._responseMessage;
    }

    return Promise.race([
      this._responsePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]);
  }
}
