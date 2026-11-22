const { validarCSV, verificarDisponibilidade, SENSIVEIS } = require("../../src/services/validadorCSV");
const { CSV_DS_A, CADASTRO, alterar, removerColunas, adicionarColuna, acrescentar } = require("../helpers/dsA");

const validar = (csv, cadastro = CADASTRO) => validarCSV(csv, { cadastro });
const doTipo = (resultado, gravidade) => resultado.erros.filter(e => e.gravidade === gravidade);
const temCritico = (resultado, campo, linha) =>
  resultado.erros.some(e => e.gravidade === "critico" && e.campo === campo && (linha === undefined || e.linha === linha));

// Linhas do DS-A: cabeçalho = 1; 000101 = 2; 000102 = 3; ... 000107 = 8.

describe("ValidadorCSV — casos do P1 §16.1", () => {
  test("CT01 aceita o DS-A: 7 registros e 0 críticos", () => {
    const resultado = validar(CSV_DS_A);
    expect(resultado.valido).toBe(true);
    expect(resultado.registros).toHaveLength(7);
    expect(resultado.resumo).toEqual({ critico: 0, aviso: 0, informativo: 0 });
  });

  test("CT01 sem uma coluna opcional (sala) gera exatamente 1 informativo e continua aceito", () => {
    const resultado = validar(removerColunas(["sala"]));
    expect(resultado.valido).toBe(true);
    expect(resultado.registros).toHaveLength(7);
    expect(resultado.resumo).toEqual({ critico: 0, aviso: 0, informativo: 1 });
    expect(doTipo(resultado, "informativo")[0].campo).toBe("sala");
  });

  test("CT02 rejeita lote sem a coluna competencia", () => {
    const resultado = validar(removerColunas(["competencia"]));
    expect(resultado.valido).toBe(false);
    expect(resultado.registros).toEqual([]);
    expect(temCritico(resultado, "competencia", 1)).toBe(true);
  });

  test("CT03 rejeita data 01/10/2026 informando linha 2 e campo data_solicitacao", () => {
    const resultado = validar(alterar("000101", { data_solicitacao: "01/10/2026" }));
    expect(resultado.valido).toBe(false);
    expect(resultado.erros).toContainEqual(expect.objectContaining({ linha: 2, campo: "data_solicitacao", gravidade: "critico" }));
  });

  test("CT04 rejeita id_registro 000102 duplicado", () => {
    const csv = acrescentar({
      id_registro: "000102", especialidade: "Cardiologia", unidade: "UBS Centro", data_solicitacao: "2026-10-22",
      status: "aguardando", competencia: "2026-10", vagas_ofertadas_periodo: "40"
    });
    const resultado = validar(csv);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros).toContainEqual(expect.objectContaining({ linha: 9, campo: "id_registro", mensagem: expect.stringContaining("duplicado") }));
  });

  const variacoes = [...SENSIVEIS.map(nome => [nome, nome]), ["CPF", "cpf"], ["Celular", "celular"], ["Endereço", "endereco"]];
  test.each(variacoes)("CT05 rejeita coluna sensível %s", (coluna, normalizada) => {
    const resultado = validar(adicionarColuna(coluna, "x"));
    expect(resultado.valido).toBe(false);
    expect(resultado.registros).toEqual([]);
    expect(temCritico(resultado, normalizada, 1)).toBe(true);
  });

  test("CT05 a lista de colunas sensíveis é exatamente a do P1 §10.3", () => {
    expect([...SENSIVEIS].sort()).toEqual(
      ["nome", "nome_paciente", "cpf", "cns", "rg", "telefone", "celular", "email", "endereco", "data_nascimento"].sort());
  });

  test("CT06 rejeita status remarcado", () => {
    const resultado = validar(alterar("000102", { status: "remarcado" }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "status", 3)).toBe(true);
  });

  test("CT07 rejeita 000103 atendido sem data_atendimento", () => {
    const resultado = validar(alterar("000103", { data_atendimento: "" }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "data_atendimento", 4)).toBe(true);
  });

  test("CT08 rejeita uma linha com 35 vagas na mesma chave", () => {
    const resultado = validar(alterar("000104", { vagas_ofertadas_periodo: "35" }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "vagas_ofertadas_periodo", 5)).toBe(true);
  });

  test("CT09 aceita 000107 às 18:00 com exatamente 1 aviso e horário não comprovado", () => {
    const resultado = validar(alterar("000107", { horario_agendado: "18:00" }));
    expect(resultado.valido).toBe(true);
    expect(resultado.registros).toHaveLength(7);
    const avisos = doTipo(resultado, "aviso");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ linha: 8, campo: "horario_agendado" });
    expect(resultado.registros.find(r => r.id_registro === "000107").horarioComprovado).toBe(false);
  });

  test("CT10 só obrigatórias e condicionais: aceito com informativo", () => {
    const resultado = validar(removerColunas(["funcionario", "sala", "horario_agendado"]));
    expect(resultado.valido).toBe(true);
    expect(resultado.registros).toHaveLength(7);
    expect(resultado.resumo).toEqual({ critico: 0, aviso: 0, informativo: 1 });
    expect(resultado.registros.every(r => r.horarioComprovado === false)).toBe(true);
  });
});

describe("ValidadorCSV — RN11 (datas condicionais)", () => {
  test.each(["agendado", "atendido", "faltou", "cancelado"])("RN11 status %s sem data_agendada é crítico", status => {
    const resultado = validar(alterar("000105", { status, data_agendada: "", data_atendimento: status === "atendido" ? "2026-10-10" : "" }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "data_agendada", 6)).toBe(true);
  });

  test("RN11 aguardando com data_agendada é crítico", () => {
    const resultado = validar(alterar("000101", { data_agendada: "2026-11-03" }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "data_agendada", 2)).toBe(true);
  });

  test.each(["aguardando", "agendado", "faltou", "cancelado"])("RN11 status %s com data_atendimento é crítico", status => {
    const resultado = validar(alterar("000106", { status, data_agendada: status === "aguardando" ? "" : "2026-10-20" }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "data_atendimento", 7)).toBe(true);
  });

  test("RN11 agendado com data_agendada e sem atendimento é aceito", () => {
    const resultado = validar(alterar("000105", { status: "agendado" }));
    expect(resultado.valido).toBe(true);
  });

  test("RN11 data_agendada em formato inválido é crítico", () => {
    const resultado = validar(alterar("000105", { data_agendada: "10/10/2026" }));
    expect(temCritico(resultado, "data_agendada", 6)).toBe(true);
  });

  test("RN11 data_atendimento em formato inválido é crítico", () => {
    const resultado = validar(alterar("000103", { data_atendimento: "2026-10-32" }));
    expect(temCritico(resultado, "data_atendimento", 4)).toBe(true);
  });
});

describe("ValidadorCSV — competência e campos obrigatórios", () => {
  test.each(["10/2026", "2026-13", "2026-1", "202610", "2026-00"])("competencia %s fora de AAAA-MM é crítica", valor => {
    const resultado = validar(alterar("000101", { competencia: valor }));
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "competencia", 2)).toBe(true);
  });

  test.each(["id_registro", "especialidade", "unidade", "data_solicitacao", "status", "competencia", "vagas_ofertadas_periodo"])(
    "campo obrigatório %s vazio é crítico (um único erro por campo)", campo => {
      const resultado = validar(alterar("000102", { [campo]: "" }));
      expect(resultado.valido).toBe(false);
      const doCampo = resultado.erros.filter(e => e.linha === 3 && e.campo === campo);
      expect(doCampo).toHaveLength(1);
      expect(doCampo[0]).toMatchObject({ gravidade: "critico", mensagem: "Campo obrigatório vazio." });
    });

  test("data inexistente (2026-02-30) é crítica", () => {
    expect(temCritico(validar(alterar("000101", { data_solicitacao: "2026-02-30" })), "data_solicitacao", 2)).toBe(true);
  });

  test("oferta negativa ou não inteira é crítica", () => {
    expect(temCritico(validar(alterar("000101", { vagas_ofertadas_periodo: "-1" })), "vagas_ofertadas_periodo", 2)).toBe(true);
    expect(temCritico(validar(alterar("000101", { vagas_ofertadas_periodo: "4.5" })), "vagas_ofertadas_periodo", 2)).toBe(true);
  });

  test("CSV só com cabeçalho é rejeitado", () => {
    const resultado = validar(CSV_DS_A.split("\n")[0]);
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "arquivo", 1)).toBe(true);
  });

  test("CSV malformado (colunas a mais) é rejeitado sem lançar exceção", () => {
    const resultado = validar(`${CSV_DS_A.trim()},extra\n`);
    expect(resultado.valido).toBe(false);
    expect(temCritico(resultado, "arquivo", 1)).toBe(true);
  });

  test("cabeçalho com maiúsculas e acento nas obrigatórias é normalizado", () => {
    const csv = CSV_DS_A.replace("id_registro,especialidade", "ID_Registro,Especialidade");
    expect(validar(csv).valido).toBe(true);
  });
});

describe("ValidadorCSV — cadastro de referência (RF007/RN05)", () => {
  test("horário dentro da faixa marca horarioComprovado = true", () => {
    const resultado = validar(CSV_DS_A);
    const vaga = resultado.registros.find(r => r.id_registro === "000107");
    expect(vaga.horarioComprovado).toBe(true);
    expect(resultado.registros.filter(r => r.horarioComprovado)).toHaveLength(1);
  });

  test("sem cadastro: informativo e nenhum horário comprovado", () => {
    const resultado = validarCSV(CSV_DS_A);
    expect(resultado.valido).toBe(true);
    expect(resultado.resumo).toEqual({ critico: 0, aviso: 0, informativo: 1 });
    expect(doTipo(resultado, "informativo")[0].campo).toBe("cadastro_referencia");
    expect(resultado.registros.every(r => r.horarioComprovado === false)).toBe(true);
  });

  test("cadastro vazio é tratado como ausente", () => {
    expect(validarCSV(CSV_DS_A, { cadastro: [] }).resumo.informativo).toBe(1);
  });

  test("funcionário fora do cadastro gera aviso", () => {
    const resultado = validar(alterar("000107", { funcionario: "PRF-999" }));
    expect(resultado.valido).toBe(true);
    expect(doTipo(resultado, "aviso")).toEqual([expect.objectContaining({ linha: 8, campo: "funcionario" })]);
  });

  test("unidade fora do cadastro gera aviso", () => {
    const resultado = validar(alterar("000107", { unidade: "UBS Norte" }));
    expect(resultado.valido).toBe(true);
    expect(doTipo(resultado, "aviso")).toEqual([expect.objectContaining({ linha: 8, campo: "unidade" })]);
  });

  test("dia da semana diferente (quarta) gera aviso", () => {
    const resultado = validar(alterar("000107", { data_agendada: "2026-11-11" }));
    expect(doTipo(resultado, "aviso")).toHaveLength(1);
  });

  test("limites da faixa: 13:00 dentro, 16:59 dentro, 17:00 fora, 12:59 fora", () => {
    const item = { funcionario: "PRF-017", unidade: "UBS Centro", data_agendada: "2026-11-10" };
    expect(verificarDisponibilidade({ ...item, horario_agendado: "13:00" }, CADASTRO).comprovado).toBe(true);
    expect(verificarDisponibilidade({ ...item, horario_agendado: "16:59" }, CADASTRO).comprovado).toBe(true);
    expect(verificarDisponibilidade({ ...item, horario_agendado: "17:00" }, CADASTRO).comprovado).toBe(false);
    expect(verificarDisponibilidade({ ...item, horario_agendado: "12:59" }, CADASTRO).comprovado).toBe(false);
  });

  test("horário em formato inválido gera aviso e não comprova", () => {
    const resultado = validar(alterar("000107", { horario_agendado: "2pm" }));
    expect(resultado.valido).toBe(true);
    expect(doTipo(resultado, "aviso")).toEqual([expect.objectContaining({ campo: "horario_agendado" })]);
    expect(resultado.registros.find(r => r.id_registro === "000107").horarioComprovado).toBe(false);
  });
});
