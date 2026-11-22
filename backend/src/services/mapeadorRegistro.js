// Converte uma linha aceita pelo validador (snake_case, texto) no formato do
// model Prisma Registro (camelCase, tipos nativos). Usado na importação e nos testes.
function paraData(valor) {
  return valor ? new Date(`${valor}T00:00:00.000Z`) : null;
}

function paraRegistro(item) {
  return {
    idRegistro: item.id_registro,
    especialidade: item.especialidade,
    unidade: item.unidade,
    dataSolicitacao: paraData(item.data_solicitacao),
    status: item.status,
    competencia: item.competencia,
    vagasOfertadasPeriodo: Number(item.vagas_ofertadas_periodo),
    dataAgendada: paraData(item.data_agendada),
    dataAtendimento: paraData(item.data_atendimento),
    funcionario: item.funcionario || null,
    sala: item.sala || null,
    horarioAgendado: item.horario_agendado || null,
    horarioComprovado: item.horarioComprovado === true
  };
}

module.exports = { paraRegistro, paraData };
