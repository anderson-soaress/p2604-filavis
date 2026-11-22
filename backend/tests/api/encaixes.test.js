const { prisma, prepararBanco, limpar, entrar, importar } = require("./helpers");
const { CSV_DS_A } = require("../helpers/dsA");
const { CRITERIO, MENSAGEM_SEM_ENCAIXE } = require("../../src/services/servicoEncaixe");

beforeAll(prepararBanco);
beforeEach(limpar);
afterAll(() => prisma.$disconnect());

async function regulacaoComDsA() {
  const agente = await entrar("REGULACAO");
  expect((await importar(agente, CSV_DS_A)).status).toBe(201);
  return agente;
}

describe("Encaixes via API", () => {
  test("CT15 GET /api/encaixes sugere 000101 para a vaga 000107", async () => {
    const agente = await regulacaoComDsA();
    const resposta = await agente.get("/api/encaixes");
    expect(resposta.status).toBe(200);
    expect(resposta.body.sugestoes).toEqual([expect.objectContaining({ vagaId: "000107", registroId: "000101", criterio: CRITERIO })]);
  });

  test("CT17 registrar grava vaga, id_registro, critério, usuário e data/hora", async () => {
    const agente = await regulacaoComDsA();
    const usuario = await prisma.usuario.findUnique({ where: { email: "regulacao@filavis.local" } });
    const antes = new Date();
    const resposta = await agente.post("/api/encaixes/000107/registrar").send({ registroId: "000101", vagaId: "000107", criterio: "ignorado pelo servidor" });
    expect(resposta.status).toBe(201);

    const gravados = await prisma.sugestaoEncaixe.findMany();
    expect(gravados).toHaveLength(1);
    const [decisao] = gravados;
    expect(decisao).toMatchObject({ vagaId: "000107", registroId: "000101", criterio: CRITERIO, usuarioId: usuario.id, decisao: "REGISTRADA" });
    expect(decisao.criadoEm).toBeInstanceOf(Date);
    expect(decisao.criadoEm.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);

    // Vaga registrada sai da lista de sugestões.
    expect((await agente.get("/api/encaixes")).body.sugestoes).toEqual([]);
  });

  test("CT17 dispensar 000101 e 000102 via API → Não há encaixe possível", async () => {
    const agente = await regulacaoComDsA();
    const primeira = await agente.post("/api/encaixes/000107/dispensar").send({ registroId: "000101" });
    expect(primeira.status).toBe(200);
    expect(primeira.body.proxima.registroId).toBe("000102");

    const segunda = await agente.post("/api/encaixes/000107/dispensar").send({ registroId: "000102" });
    expect(segunda.status).toBe(200);
    expect(segunda.body.proxima).toMatchObject({ vagaId: "000107", registroId: null, mensagem: MENSAGEM_SEM_ENCAIXE });
    expect(await prisma.sugestaoEncaixe.count({ where: { decisao: "DISPENSADA" } })).toBe(2);

    // Sem candidata, registrar é recusado.
    const registro = await agente.post("/api/encaixes/000107/registrar").send({ registroId: "000102" });
    expect(registro.status).toBe(409);
  });

  test.each([
    ["registroId que não é a sugestão vigente", "000107", { registroId: "000102" }],
    ["vaga inexistente", "999999", { registroId: "000101" }],
    ["vaga não elegível (registro aguardando)", "000101", { registroId: "000102" }],
    ["vagaId do corpo diferente da rota", "000107", { registroId: "000101", vagaId: "000105" }]
  ])("registrar sugestão inexistente (%s) → 409 e nada é gravado", async (_caso, vaga, corpo) => {
    const agente = await regulacaoComDsA();
    const resposta = await agente.post(`/api/encaixes/${vaga}/registrar`).send(corpo);
    expect(resposta.status).toBe(409);
    expect(await prisma.sugestaoEncaixe.count()).toBe(0);
  });

  test("dispensar candidata que não é a vigente → 409", async () => {
    const agente = await regulacaoComDsA();
    expect((await agente.post("/api/encaixes/000107/dispensar").send({ registroId: "000102" })).status).toBe(409);
  });

  test("registrar/dispensar sem registroId → 400", async () => {
    const agente = await regulacaoComDsA();
    expect((await agente.post("/api/encaixes/000107/registrar").send({})).status).toBe(400);
    expect((await agente.post("/api/encaixes/000107/dispensar").send({})).status).toBe(400);
  });
});
