import path from 'path';

const SOURCE = `
console.log('user', email);
console.info('info');
console.debug('debug');
console.warn('warn');
console.error('error');
`;

function transformWithNodeEnv(nodeEnv: string): string {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    jest.resetModules();
    const babel = require('@babel/core');
    const result = babel.transformSync(SOURCE, {
      configFile: path.join(__dirname, '../../babel.config.js'),
      filename: 'example.js',
      babelrc: false,
      caller: { name: 'metro', bundler: 'metro', platform: 'ios' },
    });
    return result?.code ?? '';
  } finally {
    process.env.NODE_ENV = previous;
  }
}

describe('babel.config.js', () => {
  it('elimina console.log/info/debug en producción pero mantiene warn y error', () => {
    const code = transformWithNodeEnv('production');
    expect(code).not.toContain('console.log');
    expect(code).not.toContain('console.info');
    expect(code).not.toContain('console.debug');
    expect(code).toContain('console.warn');
    expect(code).toContain('console.error');
  });

  it('no elimina nada fuera de producción', () => {
    const code = transformWithNodeEnv('development');
    expect(code).toContain('console.log');
    expect(code).toContain('console.info');
  });
});
