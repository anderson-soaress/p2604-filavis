const { sugerirEncaixes, sugestaoParaVaga, MENSAGEM_SEM_ENCAIXE, CRITERIO } = require("../../src/services/servicoEncaixe");
const { validarCSV } = require("../../src/services/validadorCSV");
const { paraRegistro } = require("../../src/services/mapeadorRegistro");
const { CSV_DS_A, ORACULO, DATA_REFERENCIA, CADASTRO, alterar, acrescentar } = require("../helpers/dsA");

const registrosDe = csv => {
  const resultado = validarCSV(csv, { cadastro: CADASTRO });
  expect(resultado.valido).toBe(true);
  return resultado.registros.map(paraRegistro);
};
const dispensa = registroId => ({ vagaId: "000107", registroId, decisao: "DISPENSADA" });

describe("ServicoEncaixe", () => {
  test("CT15 DS-A: vaga 000107 e sugerida 000101", () => {
    const sugestoes = sugerirEncaixes(registrosDe(CSV_DS_A), DATA_REFERENCIA);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ vagaId: ORACULO.encaixe.vagaId, registroId: ORACULO.encaixe.registroId, criterio: CRITERIO });
  });

  test("CT16 acrescentar 000099 aguardando de 2026-10-01: desempate pelo menor id sugere 000099", () => {
    const csv = acrescentar({
      id_registro: "000099", especialidade: "Cardiologia", unidade: "UBS Centro", data_solicitacao: "2026-10-01",
      status: "aguardando", competencia: "2026-10", vagas_ofertadas_periodo: "40"
    });
    const [sugestao] = sugerirEncaixes(registrosDe(csv), DATA_REFERENCIA);
    expect(sugestao.registroId).toBe("000099");
  });

  test("CT17 após dispensar 000101 e 000102: Não há encaixe possível", () => {
    const registros = registrosDe(CSV_DS_A);
    expect(sugestaoParaVaga("000107", registros, DATA_REFERENCIA, [dispensa("000101")]).registroId).toBe("000102");
    const final = sugestaoParaVaga("000107", registros, DATA_REFERENCIA, [dispensa("000101"), dispensa("000102")]);
    expect(final.registroId).toBeNull();
    expect(final.mensagem).toBe(MENSAGEM_SEM_ENCAIXE);
    expect(MENSAGEM_SEM_ENCAIXE).toBe("Não há encaixe possível");
  });

  test("CT18 lote do CT09 (000107 às 18:00): nenhuma vaga elegível", () => {
    const registros = registrosDe(alterar("000107", { horario_agendado: "18:00" }));
    expect(sugerirEncaixes(registros, DATA_REFERENCIA)).toEqual([]);
  });

  test("CT19 000107 com data 2026-10-28 (antes da referência): nenhuma vaga", () => {
    // horarioComprovado é forçado a true para isolar a regra da data.
    const registros = registrosDe(alterar("000107", { data_agendada: "2026-10-28" }))
      .map(r => (r.idRegistro === "000107" ? { ...r, horarioComprovado: true } : r));
    expect(sugerirEncaixes(registros, DATA_REFERENCIA)).toEqual([]);
  });

  test("determinismo: mesma sugestão em 20 execuções com a entrada em ordens diferentes", () => {
    const base = registrosDe(acrescentar({
      id_registro: "000099", especialidade: "Cardiologia", unidade: "UBS Centro", data_solicitacao: "2026-10-01",
      status: "aguardando", competencia: "2026-10", vagas_ofertadas_periodo: "40"
    }));
    const resultados = Array.from({ length: 20 }, (_, i) => {
      const rotacionado = [...base.slice(i % base.length), ...base.slice(0, i % base.length)];
      const entrada = i % 2 ? rotacionado.reverse() : rotacionado;
      return JSON.stringify(sugerirEncaixes(entrada, DATA_REFERENCIA));
    });
    expect(new Set(resultados).size).toBe(1);
    expect(JSON.parse(resultados[0])[0].registroId).toBe("000099");
  });

  test("candidatas NÃO são filtradas por horarioComprovado", () => {
    const registros = registrosDe(CSV_DS_A);
    expect(registros.find(r => r.idRegistro === "000101").horarioComprovado).toBe(false);
    expect(sugerirEncaixes(registros, DATA_REFERENCIA)[0].registroId).toBe("000101");
  });

  test("vaga com decisão REGISTRADA sai da lista e a paciente encaixada não concorre a outras vagas", () => {
    const registros = registrosDe(CSV_DS_A);
    const decisoes = [{ vagaId: "000107", registroId: "000101", decisao: "REGISTRADA" }];
    expect(sugerirEncaixes(registros, DATA_REFERENCIA, decisoes)).toEqual([]);
    const outraVaga = { ...registros.find(r => r.idRegistro === "000107"), idRegistro: "000108" };
    const [sugestao] = sugerirEncaixes([...registros, outraVaga], DATA_REFERENCIA, decisoes);
    expect(sugestao).toMatchObject({ vagaId: "000108", registroId: "000102" });
  });

  test("especialidade diferente não concorre à vaga", () => {
    const registros = registrosDe(CSV_DS_A).map(r => (r.status === "aguardando" ? { ...r, especialidade: "Dermatologia" } : r));
    expect(sugerirEncaixes(registros, DATA_REFERENCIA)[0].mensagem).toBe(MENSAGEM_SEM_ENCAIXE);
  });

  test("sugestaoParaVaga devolve null para vaga inexistente", () => {
    expect(sugestaoParaVaga("999999", registrosDe(CSV_DS_A), DATA_REFERENCIA)).toBeNull();
  });
});
