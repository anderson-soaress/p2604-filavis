const { parse } = require("csv-parse/sync");

const OBRIGATORIAS = [
  "id_registro", "especialidade", "unidade", "data_solicitacao",
  "status", "competencia", "vagas_ofertadas_periodo"
];
const SENSIVEIS = [
  "cpf", "nome", "nome_paciente", "paciente", "cns", "cartao_sus",
  "telefone", "email", "data_nascimento", "endereco"
];
const STATUS = new Set(["aguardando", "agendado", "atendido", "faltou", "cancelado"]);

function normalizar(valor) {
  return String(valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? ""))) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function validarCSV(conteudo) {
  const erros = [];
  let registros = [];
  let cabecalho = [];

  try {
    const linhas = parse(conteudo, { bom: true, skip_empty_lines: true, relax_column_count: false, trim: true });
    if (linhas.length < 2) {
      return { valido: false, erros: [{ linha: 1, campo: "arquivo", gravidade: "critico", mensagem: "CSV sem registros." }], registros: [] };
    }
    cabecalho = linhas[0].map(normalizar);
    const ausentes = OBRIGATORIAS.filter(campo => !cabecalho.includes(campo));
    ausentes.forEach(campo => erros.push({ linha: 1, campo, gravidade: "critico", mensagem: "Coluna obrigatória ausente." }));
    cabecalho.forEach(campo => {
      if (SENSIVEIS.includes(campo)) erros.push({ linha: 1, campo, gravidade: "critico", mensagem: "Coluna potencialmente identificável não permitida." });
    });
    if (erros.some(erro => erro.gravidade === "critico")) return { valido: false, erros, registros: [] };

    const vistos = new Set();
    const ofertaPorChave = new Map();
    registros = linhas.slice(1).map((linha, indice) => {
      const item = Object.fromEntries(cabecalho.map((campo, i) => [campo, String(linha[i] ?? "").trim()]));
      const numeroLinha = indice + 2;
      if (!item.id_registro) erros.push({ linha: numeroLinha, campo: "id_registro", gravidade: "critico", mensagem: "Identificador obrigatório." });
      if (vistos.has(item.id_registro)) erros.push({ linha: numeroLinha, campo: "id_registro", gravidade: "critico", mensagem: "Identificador duplicado no lote." });
      vistos.add(item.id_registro);
      if (!dataValida(item.data_solicitacao)) erros.push({ linha: numeroLinha, campo: "data_solicitacao", gravidade: "critico", mensagem: "Data deve usar AAAA-MM-DD e ser válida." });
      if (!STATUS.has(item.status)) erros.push({ linha: numeroLinha, campo: "status", gravidade: "critico", mensagem: "Status fora do domínio permitido." });
      const oferta = Number(item.vagas_ofertadas_periodo);
      if (!Number.isInteger(oferta) || oferta < 0) erros.push({ linha: numeroLinha, campo: "vagas_ofertadas_periodo", gravidade: "critico", mensagem: "Oferta deve ser inteiro não negativo." });
      if (item.data_agendada && !dataValida(item.data_agendada)) erros.push({ linha: numeroLinha, campo: "data_agendada", gravidade: "critico", mensagem: "Data agendada inválida." });
      if (item.data_atendimento && !dataValida(item.data_atendimento)) erros.push({ linha: numeroLinha, campo: "data_atendimento", gravidade: "critico", mensagem: "Data de atendimento inválida." });
      if (item.status === "atendido" && !item.data_atendimento) erros.push({ linha: numeroLinha, campo: "data_atendimento", gravidade: "critico", mensagem: "Atendido exige data_atendimento." });
      if (item.status !== "atendido" && item.data_atendimento) erros.push({ linha: numeroLinha, campo: "data_atendimento", gravidade: "critico", mensagem: "Somente atendidos podem ter data_atendimento." });
      const chave = `${item.especialidade}|${item.unidade}|${item.competencia}`;
      if (ofertaPorChave.has(chave) && ofertaPorChave.get(chave) !== oferta) erros.push({ linha: numeroLinha, campo: "vagas_ofertadas_periodo", gravidade: "critico", mensagem: "Oferta divergente para a mesma chave." });
      ofertaPorChave.set(chave, oferta);
      return item;
    });
  } catch (error) {
    return { valido: false, erros: [{ linha: 1, campo: "arquivo", gravidade: "critico", mensagem: `CSV inválido: ${error.message}` }], registros: [] };
  }

  const criticos = erros.some(erro => erro.gravidade === "critico");
  return { valido: !criticos, erros, registros: criticos ? [] : registros };
}

module.exports = { validarCSV, OBRIGATORIAS, SENSIVEIS, dataValida, normalizar };
