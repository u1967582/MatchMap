module.exports = function (api) {
  const isProduction = process.env.NODE_ENV === 'production';
  api.cache.using(() => isProduction);

  const plugins = [];

  // En builds de producción se eliminan los console.log/info/debug (hay cientos
  // y algunos incluyen emails o ids de usuario). Se mantienen error y warn.
  if (isProduction) {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: ['babel-preset-expo'],

    plugins,
  };
};
