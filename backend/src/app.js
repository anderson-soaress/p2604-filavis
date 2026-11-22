const express = require("express");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcrypt");
const multer = require("multer");
const prisma = require("./db");
const { validarCSV } = require("./services/validadorCSV");
const { calcularIndicadores, estimarEspera } = require("./services/calculadoraIndicadores");
const { sugerirEncaixes, MENSAGEM_SEM_ENCAIXE } = require("./services/servicoEncaixe");
const { paraRegistro } = require("./services/mapeadorRegistro");
const { exigirAutenticacao, exigirPerfil } = require("./middleware/autenticacao");

const app = express();
// Relógio injetável: os testes fixam a data de referência (ex.: 2026-10-31 do DS-A).
app.locals.agora = () => new Date();
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
  const cadastro = await prisma.disponibilidadeProfissional.findMany();
  const resultado = validarCSV(req.file.buffer.toString("utf8"), { cadastro });
  if (!resultado.valido) {
    return res.status(422).json({ mensagem: "Lote rejeitado; nenhum registro foi persistido.", erros: resultado.erros, resumo: resultado.resumo });
  }

  try {
    const dataReferencia = req.app.locals.agora();
    const importacao = await prisma.$transaction(async tx => {
      const dados = resultado.registros.map(paraRegistro);
      await tx.registro.createMany({ data: dados });
      const todos = await tx.registro.findMany();
      const indicadores = calcularIndicadores(todos, dataReferencia);
      await tx.indicador.deleteMany();
      for (const indicador of indicadores) {
        const campos = { ...indicador, dataReferencia };
        delete campos.totalRegistros;
        await tx.indicador.create({ data: campos });
      }
      return { quantidade: dados.length, indicadores: indicadores.length };
    });
    return res.status(201).json({ mensagem: "Importação aceita.", ...importacao, erros: resultado.erros, resumo: resultado.resumo });
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
  const hoje = req.app.locals.agora();
  res.json({
    dataReferencia: indicadores[0]?.dataReferencia ?? null,
    indicadores: indicadores.map(item => ({
      ...item,
      esperaEstimada: estimarEspera(item.esperaReferencia, item.dataReferencia, hoje)
    }))
  });
});

// O servidor é a fonte da verdade da sugestão: ela é recalculada a partir do banco
// em toda leitura e antes de gravar qualquer decisão (RN07/RN08).
async function carregarSugestoes(dataReferencia) {
  const [registros, decisoes] = await Promise.all([
    prisma.registro.findMany(),
    prisma.sugestaoEncaixe.findMany({ select: { vagaId: true, registroId: true, decisao: true } })
  ]);
  return { registros, decisoes, sugestoes: sugerirEncaixes(registros, dataReferencia, decisoes) };
}

app.get("/api/encaixes", exigirAutenticacao, exigirPerfil("REGULACAO"), async (req, res) => {
  const { sugestoes } = await carregarSugestoes(req.app.locals.agora());
  res.json({ sugestoes });
});

// :id = id_registro da vaga (registro cancelado). Corpo: { registroId, vagaId? }.
// Só grava se a dupla vaga/registro for exatamente a sugestão atual; senão 409.
app.post("/api/encaixes/:id/registrar", exigirAutenticacao, exigirPerfil("REGULACAO"), async (req, res) => {
  const vagaId = req.params.id;
  const { registroId } = req.body || {};
  if (!registroId) return res.status(400).json({ erro: "Informe registroId." });
  const { sugestoes } = await carregarSugestoes(req.app.locals.agora());
  const atual = sugestoes.find(s => s.vagaId === vagaId);
  const corresponde = atual && atual.registroId && atual.registroId === registroId &&
    (req.body.vagaId === undefined || req.body.vagaId === vagaId);
  if (!corresponde) {
    return res.status(409).json({ erro: "A sugestão informada não corresponde à sugestão vigente.", sugestaoAtual: atual || null });
  }
  // RNF010: vaga, id_registro, critério, usuário e data/hora (criadoEm).
  const decisao = await prisma.sugestaoEncaixe.create({
    data: { vagaId, registroId, criterio: atual.criterio, decisao: "REGISTRADA", usuarioId: req.session.usuario.id }
  });
  res.status(201).json({ ...decisao, observacao: "Decisão registrada; a agenda oficial não foi alterada." });
});

// Dispensa a candidata atual da vaga e devolve a próxima (ou "Não há encaixe possível").
app.post("/api/encaixes/:id/dispensar", exigirAutenticacao, exigirPerfil("REGULACAO"), async (req, res) => {
  const vagaId = req.params.id;
  const { registroId } = req.body || {};
  if (!registroId) return res.status(400).json({ erro: "Informe registroId." });
  const dataReferencia = req.app.locals.agora();
  const { sugestoes } = await carregarSugestoes(dataReferencia);
  const atual = sugestoes.find(s => s.vagaId === vagaId);
  if (!atual || atual.registroId !== registroId) {
    return res.status(409).json({ erro: "A sugestão informada não corresponde à sugestão vigente.", sugestaoAtual: atual || null });
  }
  await prisma.sugestaoEncaixe.create({
    data: { vagaId, registroId, criterio: atual.criterio, decisao: "DISPENSADA", usuarioId: req.session.usuario.id }
  });
  const { sugestoes: novas } = await carregarSugestoes(dataReferencia);
  const proxima = novas.find(s => s.vagaId === vagaId) || { vagaId, registroId: null, mensagem: MENSAGEM_SEM_ENCAIXE };
  res.status(200).json({ decisao: "DISPENSADA", proxima, observacao: "Sugestão dispensada; agenda oficial não foi alterada." });
});

module.exports = app;
