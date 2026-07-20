export type SupabaseResult<T = any> = { data: T | null; error: any };

const CHAINABLE_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'order',
  'limit',
  'range',
  'match',
  'filter',
  'or',
  'not',
  'single',
  'maybeSingle',
] as const;

export function createQueryBuilderMock(result: SupabaseResult = { data: null, error: null }) {
  const builder: any = {};
  CHAINABLE_METHODS.forEach((method) => {
    builder[method] = jest.fn(() => builder);
  });
  builder.then = (onFulfilled: any, onRejected?: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected: any) => Promise.resolve(result).catch(onRejected);
  return builder;
}

export function createSupabaseMock() {
  return {
    from: jest.fn(() => createQueryBuilderMock()),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: null })
      ),
      signUp: jest.fn(() => Promise.resolve({ data: { user: null, session: null }, error: null })),
      signInWithOAuth: jest.fn(() =>
        Promise.resolve({ data: { url: null, provider: 'google' }, error: null })
      ),
      signInWithIdToken: jest.fn(() =>
        Promise.resolve({ data: { user: null, session: null }, error: null })
      ),
      updateUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: '' }, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
        remove: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
  };
}
