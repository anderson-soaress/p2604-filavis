const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/db");
const { semear } = require("../../prisma/seed");
const { DATA_REFERENCIA } = require("../helpers/dsA");

// Data de referência fixa do DS-A (2026-10-31), para que a vaga 000107 (2026-11-10) seja futura.
app.locals.agora = () => new Date(DATA_REFERENCIA);

const CONTAS = {
  REGULACAO: { email: "regulacao@filavis.local", senha: "Regula123!" },
  GESTOR: { email: "gestor@filavis.local", senha: "Gestor123!" }
};

async function prepararBanco() {
  await semear(prisma); // usuários e cadastro de referência (idempotente)
}

async function limpar() {
  await prisma.sugestaoEncaixe.deleteMany();
  await prisma.indicador.deleteMany();
  await prisma.registro.deleteMany();
}

async function entrar(perfil) {
  const agente = request.agent(app);
  const resposta = await agente.post("/api/auth/login").send(CONTAS[perfil]);
  if (resposta.status !== 200) throw new Error(`Login ${perfil} falhou: ${resposta.status}`);
  return agente;
}

function importar(agente, csv, nome = "lote.csv") {
  return agente.post("/api/importacoes").attach("arquivo", Buffer.from(csv, "utf8"), { filename: nome, contentType: "text/csv" });
}

async function contagens() {
  const [registros, indicadores] = await Promise.all([prisma.registro.count(), prisma.indicador.count()]);
  return { registros, indicadores };
}

module.exports = { app, prisma, request, CONTAS, prepararBanco, limpar, entrar, importar, contagens };
