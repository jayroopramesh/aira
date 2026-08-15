/**
 * Explicit Babel config. Metro already defaults to `babel-preset-expo`, so this changes nothing
 * about `expo start` / `expo export` — it exists for **jest**: `jest-expo`'s platform presets
 * (`jest-expo/ios` et al) replace the babel-jest options with just a `caller`, discarding the
 * preset that `jest-expo/jest-preset` infers when a project has no babel config. Without this file
 * the transform runs with no preset at all and dies parsing React Native's own Flow-typed setup.
 */
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
