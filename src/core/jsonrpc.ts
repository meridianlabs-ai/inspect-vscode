// constants for json-rpc methods
export const kMethodEvalLogs = "eval_logs";
export const kMethodEvalLog = "eval_log";
export const kMethodEvalLogSize = "eval_log_size";
export const kMethodEvalLogBytes = "eval_log_bytes";
export const kMethodEvalLogHeaders = "eval_log_headers";
export const kMethodPendingSamples = "eval_log_pending_samples";
export const kMethodSampleData = "eval_log_sample_data";
export const kMethodLogMessage = "log_message";

// json rpc client (talk from the webview to the extension)
export function webViewJsonRpcClient(vscode: {
  postMessage(message: unknown): void;
}): JsonRpcRequestTransport {
  const target = {
    postMessage: (data: unknown) => {
      vscode.postMessage(data);
    },
    onMessage: (handler: (data: unknown) => void) => {
      const onMessage = (ev: MessageEvent) => {
        handler(ev.data);
      };
      window.addEventListener("message", onMessage);
      return () => {
        window.removeEventListener("message", onMessage);
      };
    },
  };

  const { request } = jsonRpcPostMessageRequestTransport(target);
  return request;
}

export type JsonRpcRequestTransport = (
  method: string,
  params: unknown[] | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Promise<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonRpcServerMethod = (params: Array<any>) => Promise<unknown>;

export const kJsonRpcParseError = -32700;
export const kJsonRpcInvalidRequest = -32600;
export const kJsonRpcMethodNotFound = -32601;
export const kJsonRpcInvalidParams = -32602;
export const kJsonRpcInternalError = -32603;

export interface JsonRpcError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

export function jsonRpcError(
  message: string,
  data?: string | Record<string, unknown>,
  code?: number
): JsonRpcError {
  if (typeof data === "string") {
    data = { description: data };
  }
  return {
    code: code || -3200,
    message,
    data,
  };
}

export function asJsonRpcError(error: unknown) {
  if (typeof error === "object") {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") {
      return jsonRpcError(
        err.message,
        err.data as string | Record<string, unknown> | undefined,
        err.code as number | undefined
      );
    }
  }
  return jsonRpcError(String(error));
}

export interface JsonRpcPostMessageTarget {
  postMessage: (data: unknown) => void;
  onMessage: (handler: (data: unknown) => void) => () => void;
}

export function jsonRpcPostMessageRequestTransport(
  target: JsonRpcPostMessageTarget
): {
  request: JsonRpcRequestTransport;
  disconnect: () => void;
} {
  // track in-flight requests
  const requests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  // listen for responses
  const disconnect = target.onMessage(ev => {
    const response = asJsonRpcResponse(ev);
    if (response) {
      const request = requests.get(response.id);
      if (request) {
        requests.delete(response.id);
        if (response.error) {
          request.reject(response.error);
        } else {
          request.resolve(response.result);
        }
      }
    }
  });

  // return transport
  return {
    request: (method: string, params: unknown[] | undefined) => {
      return new Promise((resolve, reject) => {
        // provision id
        const requestId = Math.floor(Math.random() * 1000000);

        // track request
        requests.set(requestId, { resolve, reject });

        // make request
        const request: JsonRpcRequest = {
          jsonrpc: kJsonRpcVersion,
          id: requestId,
          method,
          params,
        };
        target.postMessage(request);
      });
    },
    disconnect,
  };
}

export function jsonRpcPostMessageServer(
  target: JsonRpcPostMessageTarget,
  methods:
    | Record<string, JsonRpcServerMethod>
    | ((name: string) => JsonRpcServerMethod | undefined)
) {
  // method lookup function
  const lookupMethod =
    typeof methods === "function" ? methods : (name: string) => methods[name];

  // listen for messages
  return target.onMessage(data => {
    const request = asJsonRpcRequest(data);
    if (request) {
      // lookup method
      const method = lookupMethod(request.method);
      if (!method) {
        target.postMessage(methodNotFoundResponse(request));
        return;
      }

      // dispatch method
      method(request.params || [])
        .then(value => {
          target.postMessage(jsonRpcResponse(request, value));
        })
        .catch(error => {
          target.postMessage({
            jsonrpc: request.jsonrpc,
            id: request.id,
            error: asJsonRpcError(error),
          });
        });
    }
  });
}

const kJsonRpcVersion = "2.0";

interface JsonRpcMessage {
  jsonrpc: string;
  id: number;
}

function isJsonRpcMessage(message: unknown): message is JsonRpcRequest {
  const jsMessage = message as JsonRpcMessage;
  return jsMessage.jsonrpc !== undefined && jsMessage.id !== undefined;
}

interface JsonRpcRequest extends JsonRpcMessage {
  method: string;
  params?: unknown[];
}

function isJsonRpcRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return (message as JsonRpcRequest).method !== undefined;
}

interface JsonRpcResponse extends JsonRpcMessage {
  result?: unknown;
  error?: JsonRpcError;
}

function asJsonRpcMessage(data: unknown): JsonRpcMessage | null {
  if (isJsonRpcMessage(data) && data.jsonrpc === kJsonRpcVersion) {
    return data;
  } else {
    return null;
  }
}

function asJsonRpcRequest(data: unknown): JsonRpcRequest | null {
  const message = asJsonRpcMessage(data);
  if (message && isJsonRpcRequest(message)) {
    return message;
  } else {
    return null;
  }
}

function asJsonRpcResponse(data: unknown): JsonRpcResponse | null {
  const message = asJsonRpcMessage(data);
  if (message) {
    return message;
  } else {
    return null;
  }
}

function jsonRpcResponse(request: JsonRpcRequest, result?: unknown) {
  return {
    jsonrpc: request.jsonrpc,
    id: request.id,
    result,
  };
}

function jsonRpcErrorResponse(
  request: JsonRpcRequest,
  code: number,
  message: string
) {
  return {
    jsonrpc: request.jsonrpc,
    id: request.id,
    error: jsonRpcError(message, undefined, code),
  };
}

function methodNotFoundResponse(request: JsonRpcRequest) {
  return jsonRpcErrorResponse(
    request,
    kJsonRpcMethodNotFound,
    `Method '${request.method}' not found.`
  );
}
