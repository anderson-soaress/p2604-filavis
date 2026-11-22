module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: ["src/services/validadorCSV.js", "src/services/calculadoraIndicadores.js"],
  coverageThreshold: {
    global: { branches: 65, functions: 75, lines: 80, statements: 80 }
  }
};
