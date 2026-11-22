// Utilitários para montar variações do DS-A (data/ds-a.csv) nos testes.
const fs = require("fs");
const path = require("path");

const DIR_DADOS = path.join(__dirname, "../../../data");
const CSV_DS_A = fs.readFileSync(path.join(DIR_DADOS, "ds-a.csv"), "utf8");
const ORACULO = JSON.parse(fs.readFileSync(path.join(DIR_DADOS, "ds-a.oraculo.json"), "utf8"));
const DATA_REFERENCIA = new Date(`${ORACULO.dataReferencia}T00:00:00.000Z`);

// Mesmo cadastro que o seed grava no banco.
const { DISPONIBILIDADES: CADASTRO } = require("../../prisma/cadastroReferencia");

function tabela(csv = CSV_DS_A) {
  const [cabecalho, ...linhas] = csv.trim().split(/\r?\n/).map(l => l.split(","));
  return { cabecalho, linhas };
}

function paraCSV({ cabecalho, linhas }) {
  return [cabecalho, ...linhas].map(l => l.join(",")).join("\n") + "\n";
}

/** Altera campos da linha cujo id_registro é `id`. */
function alterar(id, campos, csv = CSV_DS_A) {
  const t = tabela(csv);
  const linha = t.linhas.find(l => l[0] === id);
  if (!linha) throw new Error(`id ${id} não existe no CSV`);
  Object.entries(campos).forEach(([campo, valor]) => { linha[t.cabecalho.indexOf(campo)] = valor; });
  return paraCSV(t);
}

/** Remove colunas do cabeçalho e das linhas. */
function removerColunas(colunas, csv = CSV_DS_A) {
  const t = tabela(csv);
  const manter = t.cabecalho.map((c, i) => (colunas.includes(c) ? -1 : i)).filter(i => i >= 0);
  return paraCSV({ cabecalho: manter.map(i => t.cabecalho[i]), linhas: t.linhas.map(l => manter.map(i => l[i])) });
}

/** Acrescenta uma coluna (com o mesmo valor em todas as linhas). */
function adicionarColuna(nome, valor, csv = CSV_DS_A) {
  const t = tabela(csv);
  return paraCSV({ cabecalho: [...t.cabecalho, nome], linhas: t.linhas.map(l => [...l, valor]) });
}

/** Acrescenta uma linha a partir de um objeto { coluna: valor }. */
function acrescentar(campos, csv = CSV_DS_A) {
  const t = tabela(csv);
  t.linhas.push(t.cabecalho.map(c => campos[c] ?? ""));
  return paraCSV(t);
}

module.exports = { CSV_DS_A, ORACULO, DATA_REFERENCIA, CADASTRO, tabela, alterar, removerColunas, adicionarColuna, acrescentar };
