const { parse } = require("csv-parse/sync");
const { COLUNAS_SENSIVEIS } = require("../config/colunasSensiveis");

const OBRIGATORIAS = [
  "id_registro", "especialidade", "unidade", "data_solicitacao",
  "status", "competencia", "vagas_ofertadas_periodo"
];
const CONDICIONAIS = ["data_agendada", "data_atendimento"];
const OPCIONAIS = ["funcionario", "sala", "horario_agendado"];
const SENSIVEIS = COLUNAS_SENSIVEIS;
const STATUS = new Set(["aguardando", "agendado", "atendido", "faltou", "cancelado"]);
// RN11: status que exigem data_agendada preenchida.
const STATUS_COM_AGENDA = new Set(["agendado", "atendido", "faltou", "cancelado"]);

const GRAVIDADE = Object.freeze({ CRITICO: "critico", AVISO: "aviso", INFORMATIVO: "informativo" });

function normalizar(valor) {
  return String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ""))) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function competenciaValida(valor) {
  const correspondencia = /^(\d{4})-(\d{2})$/.exec(String(valor ?? ""));
  if (!correspondencia) return false;
  const mes = Number(correspondencia[2]);
  return mes >= 1 && mes <= 12;
}

function horarioValido(valor) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor ?? ""));
}

function paraMinutos(horario) {
  const [h, m] = String(horario).split(":").map(Number);
  return h * 60 + m;
}

// Dia da semana no padrão de Date#getUTCDay: 0 = domingo ... 6 = sábado.
function diaDaSemana(dataISO) {
  return new Date(`${dataISO}T00:00:00.000Z`).getUTCDay();
}

/**
 * RF007/RN05: confere o horário agendado contra o cadastro de referência.
 * Retorna { comprovado, aviso } — aviso é null quando o horário está comprovado.
 * A faixa é [horaInicio, horaFim): um agendamento exatamente em horaFim está fora.
 */
function verificarDisponibilidade(item, cadastro) {
  const doProfissional = cadastro.filter(d => d.codigoProfissional === item.funcionario);
  if (doProfissional.length === 0) {
    return { comprovado: false, aviso: { campo: "funcionario", mensagem: `Profissional ${item.funcionario} não consta no cadastro de referência.` } };
  }
  const naUnidade = doProfissional.filter(d => d.unidade === item.unidade);
  if (naUnidade.length === 0) {
    return { comprovado: false, aviso: { campo: "unidade", mensagem: `Unidade ${item.unidade} não consta no cadastro de referência para ${item.funcionario}.` } };
  }
  if (!horarioValido(item.horario_agendado)) {
    return { comprovado: false, aviso: { campo: "horario_agendado", mensagem: "Horário deve usar HH:MM; disponibilidade não comprovada." } };
  }
  const dia = diaDaSemana(item.data_agendada);
  const minutos = paraMinutos(item.horario_agendado);
  const dentro = naUnidade.some(d =>
    d.diaSemana === dia && minutos >= paraMinutos(d.horaInicio) && minutos < paraMinutos(d.horaFim));
  if (!dentro) {
    return { comprovado: false, aviso: { campo: "horario_agendado", mensagem: "Horário agendado fora da faixa de disponibilidade cadastrada." } };
  }
  return { comprovado: true, aviso: null };
}

/**
 * Valida o CSV antes de qualquer persistência.
 * @param {string} conteudo texto do CSV
 * @param {{ cadastro?: Array<{codigoProfissional,unidade,diaSemana,horaInicio,horaFim}> | null }} opcoes
 *   cadastro de referência de disponibilidade (RF007). Vazio/ausente gera um informativo.
 * @returns {{ valido, erros, registros, resumo }}
 *   valido = nenhum erro "critico". "aviso" e "informativo" não bloqueiam o lote.
 *   Cada registro aceito recebe horarioComprovado (boolean).
 */
function validarCSV(conteudo, opcoes = {}) {
  const cadastro = Array.isArray(opcoes.cadastro) && opcoes.cadastro.length > 0 ? opcoes.cadastro : null;
  const erros = [];
  const adicionar = (linha, campo, gravidade, mensagem) => erros.push({ linha, campo, gravidade, mensagem });
  const critico = (linha, campo, mensagem) => adicionar(linha, campo, GRAVIDADE.CRITICO, mensagem);
  let registros = [];

  try {
    const linhas = parse(conteudo, { bom: true, skip_empty_lines: true, relax_column_count: false, trim: true });
    if (linhas.length < 2) {
      critico(1, "arquivo", "CSV sem registros.");
      return montarResultado(erros, []);
    }
    const cabecalho = linhas[0].map(normalizar);
    OBRIGATORIAS.filter(campo => !cabecalho.includes(campo))
      .forEach(campo => critico(1, campo, "Coluna obrigatória ausente."));
    cabecalho.filter(campo => SENSIVEIS.includes(campo))
      .forEach(campo => critico(1, campo, "Coluna potencialmente identificável não permitida."));
    if (erros.length > 0) return montarResultado(erros, []);

    const opcionaisAusentes = OPCIONAIS.filter(campo => !cabecalho.includes(campo));
    if (opcionaisAusentes.length > 0) {
      adicionar(1, opcionaisAusentes.join(","), GRAVIDADE.INFORMATIVO,
        `Colunas opcionais ausentes (${opcionaisAusentes.join(", ")}); a verificação de disponibilidade não se aplica a esses dados.`);
    }
    if (!cadastro) {
      adicionar(1, "cadastro_referencia", GRAVIDADE.INFORMATIVO,
        "Cadastro de referência de disponibilidade ausente; nenhum horário será considerado comprovado.");
    }

    const vistos = new Set();
    const ofertaPorChave = new Map();
    registros = linhas.slice(1).map((linha, indice) => {
      const item = Object.fromEntries(cabecalho.map((campo, i) => [campo, String(linha[i] ?? "").trim()]));
      const numeroLinha = indice + 2;
      const erro = (campo, mensagem) => critico(numeroLinha, campo, mensagem);

      const vazios = new Set(OBRIGATORIAS.filter(campo => item[campo] === ""));
      vazios.forEach(campo => erro(campo, "Campo obrigatório vazio."));

      if (!vazios.has("id_registro")) {
        if (vistos.has(item.id_registro)) erro("id_registro", "Identificador duplicado no lote.");
        vistos.add(item.id_registro);
      }
      if (!vazios.has("data_solicitacao") && !dataValida(item.data_solicitacao)) erro("data_solicitacao", "Data deve usar AAAA-MM-DD e ser válida.");
      if (!vazios.has("competencia") && !competenciaValida(item.competencia)) erro("competencia", "Competência deve usar AAAA-MM.");
      const statusValido = STATUS.has(item.status);
      if (!vazios.has("status") && !statusValido) erro("status", "Status fora do domínio permitido.");

      const oferta = Number(item.vagas_ofertadas_periodo);
      // Number("") é 0: o vazio precisa ser excluído explicitamente.
      const ofertaValida = !vazios.has("vagas_ofertadas_periodo") && Number.isInteger(oferta) && oferta >= 0;
      if (!vazios.has("vagas_ofertadas_periodo") && !ofertaValida) erro("vagas_ofertadas_periodo", "Oferta deve ser inteiro não negativo.");

      const temAgenda = Boolean(item.data_agendada);
      const temAtendimento = Boolean(item.data_atendimento);
      if (temAgenda && !dataValida(item.data_agendada)) erro("data_agendada", "Data agendada deve usar AAAA-MM-DD e ser válida.");
      if (temAtendimento && !dataValida(item.data_atendimento)) erro("data_atendimento", "Data de atendimento deve usar AAAA-MM-DD e ser válida.");

      // RN11 — só faz sentido quando o status pertence ao domínio.
      if (statusValido) {
        if (STATUS_COM_AGENDA.has(item.status) && !temAgenda) erro("data_agendada", `Status ${item.status} exige data_agendada.`);
        if (item.status === "aguardando" && temAgenda) erro("data_agendada", "Status aguardando não pode ter data_agendada.");
        if (item.status === "atendido" && !temAtendimento) erro("data_atendimento", "Status atendido exige data_atendimento.");
        if (item.status !== "atendido" && temAtendimento) erro("data_atendimento", "Somente status atendido pode ter data_atendimento.");
      }

      // A oferta é única por especialidade+unidade+competência; vale a primeira ocorrência.
      if (ofertaValida) {
        const chave = `${item.especialidade}|${item.unidade}|${item.competencia}`;
        if (!ofertaPorChave.has(chave)) ofertaPorChave.set(chave, oferta);
        else if (ofertaPorChave.get(chave) !== oferta) erro("vagas_ofertadas_periodo", "Oferta divergente para a mesma especialidade, unidade e competência.");
      }

      // RF007/RN05 — só quando há funcionário, horário e data agendada válida.
      item.horarioComprovado = false;
      if (cadastro && item.funcionario && item.horario_agendado && dataValida(item.data_agendada)) {
        const { comprovado, aviso } = verificarDisponibilidade(item, cadastro);
        item.horarioComprovado = comprovado;
        if (aviso) adicionar(numeroLinha, aviso.campo, GRAVIDADE.AVISO, aviso.mensagem);
      }
      return item;
    });
  } catch (error) {
    critico(1, "arquivo", `CSV inválido: ${error.message}`);
    return montarResultado(erros, []);
  }

  return montarResultado(erros, registros);
}

function montarResultado(erros, registros) {
  const resumo = { critico: 0, aviso: 0, informativo: 0 };
  erros.forEach(erro => { resumo[erro.gravidade] += 1; });
  const valido = resumo.critico === 0;
  return { valido, erros, registros: valido ? registros : [], resumo };
}

module.exports = {
  validarCSV, verificarDisponibilidade, dataValida, competenciaValida, horarioValido, normalizar,
  OBRIGATORIAS, CONDICIONAIS, OPCIONAIS, SENSIVEIS, GRAVIDADE
};
