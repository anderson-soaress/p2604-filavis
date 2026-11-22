const { app, prisma, request, CONTAS, prepararBanco, limpar, entrar, importar } = require("./helpers");
const { CSV_DS_A } = require("../helpers/dsA");

beforeAll(prepararBanco);
beforeEach(limpar);
afterAll(() => prisma.$disconnect());

const ROTAS_PROTEGIDAS = [
  ["post", "/api/auth/logout"],
  ["get", "/api/auth/me"],
  ["post", "/api/importacoes"],
  ["get", "/api/dashboard"],
  ["get", "/api/encaixes"],
  ["post", "/api/encaixes/000107/registrar"],
  ["post", "/api/encaixes/000107/dispensar"]
];

describe("Autenticação e autorização", () => {
  test.each(ROTAS_PROTEGIDAS)("CT20 %s %s sem sessão → 401", async (metodo, rota) => {
    const resposta = await request(app)[metodo](rota);
    expect(resposta.status).toBe(401);
  });

  test("CT20 Gestor em POST /api/importacoes → 403 e nada é importado", async () => {
    const gestor = await entrar("GESTOR");
    const resposta = await importar(gestor, CSV_DS_A);
    expect(resposta.status).toBe(403);
    expect(await prisma.registro.count()).toBe(0);
  });

  test("CT20 Gestor em POST /api/encaixes/:id/registrar → 403 e nada é gravado", async () => {
    const regulacao = await entrar("REGULACAO");
    expect((await importar(regulacao, CSV_DS_A)).status).toBe(201);
    const gestor = await entrar("GESTOR");
    const resposta = await gestor.post("/api/encaixes/000107/registrar").send({ registroId: "000101" });
    expect(resposta.status).toBe(403);
    expect(await prisma.sugestaoEncaixe.count()).toBe(0);
  });

  test("CT20 Gestor acessa o dashboard (rota não restrita a perfil)", async () => {
    const gestor = await entrar("GESTOR");
    expect((await gestor.get("/api/dashboard")).status).toBe(200);
  });

  test("CT21 senha errada → 401, mensagem genérica e nenhum cookie de sessão", async () => {
    const resposta = await request(app).post("/api/auth/login").send({ email: CONTAS.REGULACAO.email, senha: "errada" });
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: "Credenciais inválidas." });
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  test("CT21 email inexistente recebe a mesma mensagem (não revela se a conta existe)", async () => {
    const resposta = await request(app).post("/api/auth/login").send({ email: "ninguem@filavis.local", senha: "x" });
    expect(resposta.status).toBe(401);
    expect(resposta.body).toEqual({ erro: "Credenciais inválidas." });
    expect(resposta.headers["set-cookie"]).toBeUndefined();
  });

  test("login correto emite cookie httpOnly e /me devolve o perfil", async () => {
    const resposta = await request(app).post("/api/auth/login").send(CONTAS.REGULACAO);
    expect(resposta.status).toBe(200);
    expect(resposta.headers["set-cookie"][0]).toMatch(/filavis\.sid=.*HttpOnly/i);
    const agente = await entrar("REGULACAO");
    expect((await agente.get("/api/auth/me")).body.usuario.perfil).toBe("REGULACAO");
  });

  test("logout encerra a sessão", async () => {
    const agente = await entrar("REGULACAO");
    expect((await agente.post("/api/auth/logout")).status).toBe(204);
    expect((await agente.get("/api/auth/me")).status).toBe(401);
  });
});
