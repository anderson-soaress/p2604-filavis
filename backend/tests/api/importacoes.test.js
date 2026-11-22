const { prisma, prepararBanco, limpar, entrar, importar, contagens } = require("./helpers");
const { CSV_DS_A, ORACULO, alterar, removerColunas, adicionarColuna, acrescentar } = require("../helpers/dsA");

beforeAll(prepararBanco);
beforeEach(limpar);
afterAll(() => prisma.$disconnect());

describe("POST /api/importacoes", () => {
  test("CT01 importa o DS-A: 7 registros, 0 críticos e indicadores do oráculo", async () => {
    const agente = await entrar("REGULACAO");
    const resposta = await importar(agente, CSV_DS_A);
    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ quantidade: 7, indicadores: 1 });
    expect(resposta.body.resumo.critico).toBe(0);
    expect(await contagens()).toEqual({ registros: 7, indicadores: 1 });

    const vaga = await prisma.registro.findUnique({ where: { idRegistro: "000107" } });
    expect(vaga.horarioComprovado).toBe(true);
    const indicador = await prisma.indicador.findFirst();
    expect(indicador.filaAtiva).toBe(ORACULO.indicadores.filaAtiva);
    expect(Math.abs(indicador.esperaReferencia - ORACULO.indicadores.esperaReferencia)).toBeLessThan(ORACULO.tolerancia);
  });

  test("CT01 sem coluna opcional: aceito com 1 informativo na resposta", async () => {
    const agente = await entrar("REGULACAO");
    const resposta = await importar(agente, removerColunas(["sala"]));
    expect(resposta.status).toBe(201);
    expect(resposta.body.resumo).toEqual({ critico: 0, aviso: 0, informativo: 1 });
  });

  // Lote rejeitado: nada pode mudar no banco. Começamos com o DS-A já importado
  // para que "antes" tenha dados. Os lotes rejeitados usam ids novos (0002xx), então
  // só não chegam ao banco porque o validador os barrou.
  const loteNovo = CSV_DS_A.replace(/^0001/gm, "0002");
  const rejeitados = [
    ["CT02 sem competencia", removerColunas(["competencia"], loteNovo)],
    ["CT03 data 01/10/2026", alterar("000201", { data_solicitacao: "01/10/2026" }, loteNovo)],
    ["CT04 id duplicado", acrescentar({
      id_registro: "000202", especialidade: "Cardiologia", unidade: "UBS Centro", data_solicitacao: "2026-10-22",
      status: "aguardando", competencia: "2026-10", vagas_ofertadas_periodo: "40"
    }, loteNovo)],
    ["CT05 coluna CPF", adicionarColuna("CPF", "x", loteNovo)],
    ["CT06 status remarcado", alterar("000202", { status: "remarcado" }, loteNovo)],
    ["CT07 atendido sem data_atendimento", alterar("000203", { data_atendimento: "" }, loteNovo)],
    ["CT08 oferta 35", alterar("000204", { vagas_ofertadas_periodo: "35" }, loteNovo)]
  ];

  test("lote com ids novos (controle) seria aceito sem as alterações", async () => {
    const agente = await entrar("REGULACAO");
    expect((await importar(agente, loteNovo)).status).toBe(201);
    expect((await contagens()).registros).toBe(7);
  });

  test.each(rejeitados)("%s via API: 422 e contagens inalteradas (rollback)", async (_nome, csv) => {
    const agente = await entrar("REGULACAO");
    expect((await importar(agente, CSV_DS_A)).status).toBe(201);
    const antes = await contagens();
    const indicadorAntes = await prisma.indicador.findFirst();

    const resposta = await importar(agente, csv);
    expect(resposta.status).toBe(422);
    expect(resposta.body.resumo.critico).toBeGreaterThan(0);
    expect(resposta.body.erros.every(e => e.linha && e.campo && e.gravidade)).toBe(true);

    expect(await contagens()).toEqual(antes);
    expect(await prisma.registro.count({ where: { idRegistro: { startsWith: "0002" } } })).toBe(0);
    expect((await prisma.indicador.findFirst()).atualizadoEm).toEqual(indicadorAntes.atualizadoEm);
  });

  test("falha no banco durante a transação (id já importado) reverte tudo: 409 e contagens inalteradas", async () => {
    const agente = await entrar("REGULACAO");
    expect((await importar(agente, CSV_DS_A)).status).toBe(201);
    const antes = await contagens();
    // Lote válido para o validador: 000201–000207 são novos, mas 000101 já existe no banco
    // → violação de unicidade dentro da transação. Nenhuma das 8 linhas pode ficar gravada.
    const misto = acrescentar({
      id_registro: "000101", especialidade: "Cardiologia", unidade: "UBS Centro", data_solicitacao: "2026-10-01",
      status: "aguardando", competencia: "2026-10", vagas_ofertadas_periodo: "40"
    }, loteNovo);
    const silenciar = jest.spyOn(console, "error").mockImplementation(() => {});
    const resposta = await importar(agente, misto);
    expect(silenciar).toHaveBeenCalledWith("Falha na importação:", expect.objectContaining({ code: "P2002" }));
    silenciar.mockRestore();
    expect(resposta.status).toBe(409);
    expect(resposta.body.detalhe).toBe("P2002");
    expect(await contagens()).toEqual(antes);
    expect(await prisma.registro.count({ where: { idRegistro: { startsWith: "0002" } } })).toBe(0);
  });

  test("sem arquivo: 400", async () => {
    const agente = await entrar("REGULACAO");
    expect((await agente.post("/api/importacoes")).status).toBe(400);
  });
});
