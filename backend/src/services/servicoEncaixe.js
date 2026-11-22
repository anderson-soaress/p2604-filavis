// Sugestão consultiva de encaixe (RN07/RN08). Funções puras: o servidor
// recalcula a sugestão a cada pedido, inclusive antes de gravar uma decisão.

const CRITERIO = "Mesma especialidade; menor data_solicitacao; desempate pelo menor id_registro.";
const MENSAGEM_SEM_ENCAIXE = "Não há encaixe possível";

const tempo = valor => new Date(valor).getTime();

function compararIdRegistro(a, b) {
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
}

/**
 * RN07: vaga elegível = registro cancelado, com data_agendada posterior à data
 * de referência e com horário comprovado pelo cadastro de referência.
 */
function vagasElegiveis(registros, dataReferencia) {
  return registros
    .filter(r => r.status === "cancelado" && r.dataAgendada &&
      tempo(r.dataAgendada) > tempo(dataReferencia) && r.horarioComprovado === true)
    .sort((a, b) => tempo(a.dataAgendada) - tempo(b.dataAgendada) || compararIdRegistro(a.idRegistro, b.idRegistro));
}

/**
 * RN08: candidatas = todos os registros "aguardando" da mesma especialidade da vaga,
 * ordenados por data_solicitacao e, no empate, pelo menor id_registro.
 * horarioComprovado NÃO filtra candidatas: ele descreve a vaga, não o paciente.
 */
function candidatasParaVaga(vaga, registros, excluidos = new Set()) {
  return registros
    .filter(r => r.status === "aguardando" && r.especialidade === vaga.especialidade && !excluidos.has(r.idRegistro))
    .sort((a, b) => tempo(a.dataSolicitacao) - tempo(b.dataSolicitacao) || compararIdRegistro(a.idRegistro, b.idRegistro));
}

/**
 * Calcula uma sugestão por vaga elegível.
 * @param registros todos os registros importados (formato Prisma)
 * @param dataReferencia data de referência dos dados
 * @param decisoes decisões já gravadas: [{ vagaId, registroId, decisao: "REGISTRADA" | "DISPENSADA" }]
 *   - vaga com decisão REGISTRADA sai da lista;
 *   - candidata REGISTRADA em qualquer vaga deixa de concorrer;
 *   - candidata DISPENSADA só deixa de concorrer àquela vaga.
 * @returns [{ vagaId, especialidade, dataAgendada, registroId, criterio }] ou,
 *   sem candidata, [{ vagaId, ..., registroId: null, mensagem: "Não há encaixe possível" }]
 */
function sugerirEncaixes(registros, dataReferencia, decisoes = []) {
  const vagasRegistradas = new Set(decisoes.filter(d => d.decisao === "REGISTRADA").map(d => d.vagaId));
  const pacientesEncaixados = new Set(decisoes.filter(d => d.decisao === "REGISTRADA").map(d => d.registroId));

  return vagasElegiveis(registros, dataReferencia)
    .filter(vaga => !vagasRegistradas.has(vaga.idRegistro))
    .map(vaga => {
      const dispensadas = decisoes
        .filter(d => d.decisao === "DISPENSADA" && d.vagaId === vaga.idRegistro)
        .map(d => d.registroId);
      const excluidos = new Set([...pacientesEncaixados, ...dispensadas]);
      const [primeira] = candidatasParaVaga(vaga, registros, excluidos);
      const base = { vagaId: vaga.idRegistro, especialidade: vaga.especialidade, dataAgendada: vaga.dataAgendada };
      return primeira
        ? { ...base, registroId: primeira.idRegistro, criterio: CRITERIO }
        : { ...base, registroId: null, mensagem: MENSAGEM_SEM_ENCAIXE };
    });
}

function sugestaoParaVaga(vagaId, registros, dataReferencia, decisoes = []) {
  return sugerirEncaixes(registros, dataReferencia, decisoes).find(s => s.vagaId === vagaId) || null;
}

module.exports = { sugerirEncaixes, sugestaoParaVaga, vagasElegiveis, candidatasParaVaga, CRITERIO, MENSAGEM_SEM_ENCAIXE };
