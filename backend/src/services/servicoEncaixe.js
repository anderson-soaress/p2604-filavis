function selecionarElegivel(registros, vagas, hoje = new Date()) {
  const candidatas = registros
    .filter(registro => registro.status === "aguardando" && registro.horarioComprovado !== false)
    .sort((a, b) => new Date(a.dataSolicitacao) - new Date(b.dataSolicitacao) ||
      String(a.idRegistro).localeCompare(String(b.idRegistro), "pt-BR", { numeric: true }));

  const vagasElegiveis = vagas.filter(vaga =>
    vaga.status === "cancelado" &&
    vaga.dataAgendada &&
    new Date(vaga.dataAgendada) > hoje &&
    vaga.disponibilidadeComprovada === true
  );

  return vagasElegiveis.map(vaga => {
    const candidato = candidatas.find(registro => registro.especialidade === vaga.especialidade);
    return candidato ? {
      vagaId: vaga.idRegistro,
      registroId: candidato.idRegistro,
      criterio: "Mesma especialidade; menor data_solicitacao; desempate pelo menor id_registro."
    } : null;
  }).filter(Boolean);
}

module.exports = { selecionarElegivel };
