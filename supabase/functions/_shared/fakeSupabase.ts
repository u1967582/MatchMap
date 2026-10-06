// Cliente Supabase falso para los tests de las edge functions (deno test).
// Registra cada llamada y resuelve con lo que devuelva `respond`.
// deno-lint-ignore-file no-explicit-any

export interface QueryCall {
  table: string;
  ops: { method: string; args: any[] }[];
}

export type Responder = (call: QueryCall) => { data?: any; error?: any };

export function op(call: QueryCall, method: string) {
  return call.ops.find((o) => o.method === method);
}

export function createFakeSupabase(opts: {
  respond?: Responder;
  rpc?: (fn: string, args: any) => { data?: any; error?: any };
  getUser?: (token?: string) => { data: { user: any }; error?: any };
  deleteUser?: (id: string) => { error?: any };
  storage?: {
    list?: (bucket: string, prefix: string, options?: any) => { data?: any; error?: any };
    remove?: (bucket: string, paths: string[]) => { error?: any };
    move?: (bucket: string, from: string, to: string) => { error?: any };
  };
} = {}) {
  const calls: QueryCall[] = [];
  const rpcCalls: { fn: string; args: any }[] = [];
  const storageCalls: { bucket: string; method: string; args: any[] }[] = [];

  const builder = (table: string) => {
    const call: QueryCall = { table, ops: [] };
    calls.push(call);
    const b: any = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') {
            const result = { data: null, error: null, ...(opts.respond?.(call) ?? {}) };
            return (res: any, rej: any) => Promise.resolve(result).then(res, rej);
          }
          return (...args: any[]) => {
            call.ops.push({ method: prop, args });
            return b;
          };
        },
      },
    );
    return b;
  };

  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args?: any) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: null, ...(opts.rpc?.(fn, args) ?? {}) });
    },
    auth: {
      getUser: (token?: string) =>
        Promise.resolve(opts.getUser?.(token) ?? { data: { user: null }, error: null }),
      admin: {
        deleteUser: (id: string) => Promise.resolve({ error: null, ...(opts.deleteUser?.(id) ?? {}) }),
      },
    },
    storage: {
      from: (bucket: string) => ({
        list: (prefix: string, options?: any) => {
          storageCalls.push({ bucket, method: 'list', args: [prefix, options] });
          return Promise.resolve({ data: [], error: null, ...(opts.storage?.list?.(bucket, prefix, options) ?? {}) });
        },
        remove: (paths: string[]) => {
          storageCalls.push({ bucket, method: 'remove', args: [paths] });
          return Promise.resolve({ data: null, error: null, ...(opts.storage?.remove?.(bucket, paths) ?? {}) });
        },
        move: (from: string, to: string) => {
          storageCalls.push({ bucket, method: 'move', args: [from, to] });
          return Promise.resolve({ data: null, error: null, ...(opts.storage?.move?.(bucket, from, to) ?? {}) });
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  };

  return { client, calls, rpcCalls, storageCalls };
}

/** Silencia console.log/warn/error durante un test. */
export async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const { log, warn, error } = console;
  console.log = console.warn = console.error = () => {};
  try {
    return await fn();
  } finally {
    Object.assign(console, { log, warn, error });
  }
}
