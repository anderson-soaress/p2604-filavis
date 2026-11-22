const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
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
  console.log("Contas sintéticas criadas.");
}

main().catch(error => { console.error(error); process.exit(1); }).finally(() => prisma.$disconnect());
