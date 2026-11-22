const express = require("express");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcrypt");
const multer = require("multer");
const prisma = require("./db");
const { validarCSV } = require("./services/validadorCSV");
const { calcularIndicadores, estimarEspera } = require("./services/calculadoraIndicadores");
const { selecionarElegivel } = require("./services/servicoEncaixe");
const { exigirAutenticacao, exigirPerfil } = require("./middleware/autenticacao");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(session({
  name: "filavis.sid",
  secret: process.env.SESSION_SECRET || "somente-desenvolvimento",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: false, maxAge: 30 * 60 * 1000 }
}));

app.get("/health", (_req, res) => res.json({ status: "ok", sistema: "FilaVis API" }));

app.post("/api/auth/login", async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "Informe email e senha." });
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const senhaCorreta = usuario && await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) return res.status(401).json({ erro: "Credenciais inválidas." });
  req.session.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  req.session.ultimaAtividade = Date.now();
  return res.json({ usuario: req.session.usuario });
});

app.post("/api/auth/logout", exigirAutenticacao, (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get("/api/auth/me", exigirAutenticacao, (req, res) => res.json({ usuario: req.session.usuario }));

app.post("/api/importacoes", exigirAutenticacao, exigirPerfil("REGULACAO"), upload.single("arquivo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: "Envie um arquivo CSV no campo arquivo." });
  const resultado = validarCSV(req.file.buffer.toString("utf8"));
  if (!resultado.valido) return res.status(422).json({ mensagem: "Lote rejeitado; nenhum registro foi persistido.", erros: resultado.erros });

  try {
    const importacao = await prisma.$transaction(async tx => {
      const dados = resultado.registros.map(item => ({
        idRegistro: item.id_registro,
        especialidade: item.especialidade,
        unidade: item.unidade,
        dataSolicitacao: new Date(`${item.data_solicitacao}T00:00:00.000Z`),
        status: item.status,
        competencia: item.competencia,
        vagasOfertadasPeriodo: Number(item.vagas_ofertadas_periodo),
        dataAgendada: item.data_agendada ? new Date(`${item.data_agendada}T00:00:00.000Z`) : null,
        dataAtendimento: item.data_atendimento ? new Date(`${item.data_atendimento}T00:00:00.000Z`) : null,
        funcionario: item.funcionario || null,
        sala: item.sala || null,
        horarioAgendado: item.horario_agendado || null,
        horarioComprovado: false
      }));
      await tx.registro.createMany({ data: dados });
      const todos = await tx.registro.findMany();
      const indicadores = calcularIndicadores(todos);
      await tx.indicador.deleteMany();
      for (const indicador of indicadores) {
        const campos = { ...indicador, dataReferencia: new Date() };
        delete campos.totalRegistros;
        await tx.indicador.create({ data: campos });
      }
      return { quantidade: dados.length, indicadores: indicadores.length };
    });
    return res.status(201).json({ mensagem: "Importação aceita.", ...importacao, erros: resultado.erros });
  } catch (error) {
    console.error("Falha na importação:", error);
    return res.status(409).json({ erro: "Falha ao persistir o lote; a transação foi revertida.", detalhe: error.code || "DATABASE_ERROR" });
  }
});

app.get("/api/dashboard", exigirAutenticacao, async (req, res) => {
  const { especialidade, unidade, competencia } = req.query;
  const filtros = {};
  if (especialidade) filtros.especialidade = String(especialidade);
  if (unidade) filtros.unidade = String(unidade);
  if (competencia) filtros.competencia = String(competencia);
  const indicadores = await prisma.indicador.findMany({ where: filtros, orderBy: [{ especialidade: "asc" }, { unidade: "asc" }] });
  const hoje = new Date();
  res.json({
    dataReferencia: indicadores[0]?.dataReferencia ?? null,
    indicadores: indicadores.map(item => ({
      ...item,
      esperaEstimada: estimarEspera(item.esperaReferencia, item.dataReferencia, hoje)
    }))
  });
});

app.get("/api/encaixes", exigirAutenticacao, exigirPerfil("REGULACAO"), async (_req, res) => {
  const [registros, vagas] = await Promise.all([
    prisma.registro.findMany({ where: { status: "aguardando" }, orderBy: [{ dataSolicitacao: "asc" }, { idRegistro: "asc" }] }),
    prisma.registro.findMany({ where: { status: "cancelado", dataAgendada: { gt: new Date() } } })
  ]);
  const sugestoes = selecionarElegivel(registros, vagas.map(vaga => ({ ...vaga, disponibilidadeComprovada: false })));
  res.json({ sugestoes, observacao: "Sem cadastro de referência de disponibilidade, nenhuma vaga é elegível." });
});

app.post("/api/encaixes/:id/registrar", exigirAutenticacao, exigirPerfil("REGULACAO"), async (req, res) => {
  const { registroId, vagaId, criterio } = req.body || {};
  if (!registroId || !vagaId || !criterio) return res.status(400).json({ erro: "Dados incompletos." });
  const sugestao = await prisma.sugestaoEncaixe.create({
    data: { registroId, vagaId, criterio, decisao: "REGISTRADA", usuarioId: req.session.usuario.id }
  });
  res.status(201).json(sugestao);
});

app.post("/api/encaixes/:id/dispensar", exigirAutenticacao, exigirPerfil("REGULACAO"), (_req, res) => res.status(200).json({ decisao: "DISPENSADA", mensagem: "Sugestão dispensada; agenda oficial não foi alterada." }));

module.exports = app;
