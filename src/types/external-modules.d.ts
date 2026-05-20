declare module 'recharts';

/** Stripe ships types, but `moduleResolution: bundler` can resolve to untyped ESM entry; use `any` for API surface. */
declare module 'stripe' {
  const Stripe: any;
  export default Stripe;
}

declare module 'html2canvas' {
  export default function html2canvas(element: HTMLElement, options?: Record<string, unknown>): Promise<HTMLCanvasElement>;
}

declare module '@modelcontextprotocol/sdk/server/index.js' {
  export class Server {
    constructor(info: { name: string; version: string }, options?: Record<string, unknown>);
    setRequestHandler(schema: unknown, handler: (...args: unknown[]) => unknown): void;
    connect(transport: unknown): Promise<void>;
    close(): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/types.js' {
  export const CallToolRequestSchema: unknown;
  export const ListToolsRequestSchema: unknown;
}

declare module '@modelcontextprotocol/sdk/server/sse.js' {
  export class SSEServerTransport {
    constructor(path: string, res: unknown);
    start(): Promise<void>;
    send(message: unknown): Promise<void>;
    close(): Promise<void>;
    handlePostMessage(req: unknown, res: unknown): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/server/streamableHttp.js' {
  export class StreamableHTTPServerTransport {
    constructor(options?: Record<string, unknown>);
    handleRequest(req: unknown, res: unknown, body?: unknown): Promise<void>;
  }
}

declare module 'pdfjs-dist' {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<any>;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(src: any): {
    promise: Promise<PDFDocumentProxy>;
  };
}

declare module 'next-pwa' {
  const withPWA: (config: any) => (nextConfig: any) => any;
  export default withPWA;
}

