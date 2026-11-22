module.exports = [{
  files: ["app/**/*.js"],
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: { process: "readonly", fetch: "readonly", console: "readonly", FormData: "readonly" }
  },
  rules: {
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-undef": "error"
  }
}];
