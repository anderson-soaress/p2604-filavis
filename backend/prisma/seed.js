const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

// PRF-017 atende na UBS Centro às terças, 13:00–17:00.
const { DISPONIBILIDADES } = require("./cadastroReferencia");

async function semear(prisma) {
  const senhaGestor = await bcrypt.hash("Gestor123!", 10);
  const senhaRegulacao = await bcrypt.hash("Regula123!", 10);
  await prisma.usuario.upsert({
    where: { email: "gestor@filavis.local" },
    update: {},
    create: { nome: "Gestor de demonstração", email: "gestor@filavis.local", senhaHash: senhaGestor, perfil: "GESTOR" }
  });
  await prisma.usuario.upsert({
    where: { email: "regulacao@filavis.local" },
    update: {},
    create: { nome: "Equipe de regulação", email: "regulacao@filavis.local", senhaHash: senhaRegulacao, perfil: "REGULACAO" }
  });
  for (const disponibilidade of DISPONIBILIDADES) {
    const { codigoProfissional, unidade, diaSemana, horaInicio } = disponibilidade;
    await prisma.disponibilidadeProfissional.upsert({
      where: { codigoProfissional_unidade_diaSemana_horaInicio: { codigoProfissional, unidade, diaSemana, horaInicio } },
      update: { horaFim: disponibilidade.horaFim },
      create: disponibilidade
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  semear(prisma)
    .then(() => console.log("Contas sintéticas e cadastro de referência criados."))
    .catch(error => { console.error(error); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = { semear, DISPONIBILIDADES };
