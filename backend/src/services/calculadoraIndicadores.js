function diasEntre(inicio, fim) {
  return Math.max(0, (new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000);
}

function calcularIndicadores(registros, hoje = new Date()) {
  const grupos = new Map();
  for (const registro of registros) {
    const chave = `${registro.especialidade}|${registro.unidade}|${registro.competencia}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(registro);
  }

  return [...grupos.entries()].map(([chave, itens]) => {
    const [especialidade, unidade, competencia] = chave.split("|");
    const aguardando = itens.filter(item => item.status === "aguardando");
    const atendidos = itens.filter(item => item.status === "atendido");
    const faltas = itens.filter(item => item.status === "faltou");
    const espera = aguardando.length
      ? aguardando.reduce((soma, item) => soma + diasEntre(item.dataSolicitacao, hoje), 0) / aguardando.length
      : 0;
    const esperaHistorica = atendidos.length
      ? atendidos.reduce((soma, item) => soma + diasEntre(item.dataSolicitacao, item.dataAtendimento), 0) / atendidos.length
      : 0;
    const denominador = atendidos.length + faltas.length;
    const capacidade = Number(itens[0]?.vagasOfertadasPeriodo ?? 0);
    return {
      especialidade, unidade, competencia,
      filaAtiva: aguardando.length,
      esperaReferencia: Number(espera.toFixed(2)),
      esperaHistorica: Number(esperaHistorica.toFixed(2)),
      absenteismo: denominador ? Number((faltas.length / denominador * 100).toFixed(2)) : 0,
      capacidade,
      totalRegistros: itens.length
    };
  });
}

function estimarEspera(esperaReferencia, dataReferencia, hoje = new Date()) {
  return Number((Number(esperaReferencia) + diasEntre(dataReferencia, hoje)).toFixed(2));
}

module.exports = { calcularIndicadores, estimarEspera, diasEntre };
