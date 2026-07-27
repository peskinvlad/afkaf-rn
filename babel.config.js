module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Strip console.log from production bundles as a safety net against
    // leaking tokens/PII into device logs. Keeps warn/error — those are the
    // diagnostic channels and are already scrubbed of sensitive data.
    // Dev (Expo Go) keeps all logging.
    env: {
      production: {
        plugins: [['transform-remove-console', { exclude: ['error', 'warn'] }]],
      },
    },
  };
};
