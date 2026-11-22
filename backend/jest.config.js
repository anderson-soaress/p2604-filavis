// Dois projetos: "unit" (sem banco) e "api" (Supertest + PostgreSQL de teste).
// O limite de cobertura (P1: 80% de linhas) vale para os dois módulos centrais.
module.exports = {
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: {
    "./src/services/validadorCSV.js": { lines: 80 },
    "./src/services/calculadoraIndicadores.js": { lines: 80 }
  },
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"]
    },
    {
      displayName: "api",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/api/**/*.test.js"],
      setupFiles: ["<rootDir>/tests/api/setup.js"]
    }
  ]
};
