// Executado antes de cada arquivo de tests/api. Os testes de API usam um banco
// PostgreSQL real e APAGAM as tabelas de dados em beforeEach, por isso exigimos
// que o nome do banco contenha "test" para nunca rodar contra o banco de desenvolvimento.
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env.test") });
require("dotenv").config({ path: path.join(__dirname, "../../.env.test") });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("Defina DATABASE_URL apontando para um banco de TESTE (ex.: .../filavis_test) antes de rodar test:api.");
}
const nomeBanco = new URL(url).pathname.replace(/^\//, "");
if (!/test/i.test(nomeBanco)) {
  throw new Error(`Recusando rodar testes de API no banco "${nomeBanco}": o nome precisa conter "test".`);
}
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "segredo-somente-para-testes";
