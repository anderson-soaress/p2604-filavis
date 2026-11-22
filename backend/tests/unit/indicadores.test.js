const { calcularIndicadores, estimarEspera, diasEntre } = require("../../src/services/calculadoraIndicadores");
const { validarCSV } = require("../../src/services/validadorCSV");
const { paraRegistro } = require("../../src/services/mapeadorRegistro");
const { CSV_DS_A, ORACULO, DATA_REFERENCIA, CADASTRO } = require("../helpers/dsA");

// casas decimais equivalentes à tolerância do oráculo (0,1): |esperado - obtido| < 0,1
const CASAS = 1;
const registrosDe = csv => validarCSV(csv, { cadastro: CADASTRO }).registros.map(paraRegistro);
const dsA = () => registrosDe(CSV_DS_A);

describe("CalculadoraIndicadores", () => {
  test("CT11 DS-A confere com o oráculo (tolerância 0,1)", () => {
    const resultado = calcularIndicadores(dsA(), DATA_REFERENCIA);
    expect(resultado).toHaveLength(1);
    const [indicador] = resultado;
    expect(indicador).toMatchObject(ORACULO.chave);
    const esperado = ORACULO.indicadores;
    expect(indicador.filaAtiva).toBe(esperado.filaAtiva);
    expect(indicador.capacidade).toBe(esperado.capacidade);
    expect(Math.abs(indicador.esperaReferencia - esperado.esperaReferencia)).toBeLessThan(ORACULO.tolerancia);
    expect(Math.abs(indicador.esperaHistorica - esperado.esperaHistorica)).toBeLessThan(ORACULO.tolerancia);
    expect(Math.abs(indicador.absenteismo - esperado.absenteismo)).toBeLessThan(ORACULO.tolerancia);
    expect(indicador.totalRegistros).toBe(7);
  });

  test("CT12 só atendidos: fila vazia e espera não calculável (null, não 0)", () => {
    const atendidos = dsA().filter(r => r.status === "atendido");
    const [indicador] = calcularIndicadores(atendidos, DATA_REFERENCIA);
    expect(indicador.filaAtiva).toBe(0);
    expect(indicador.esperaReferencia).toBeNull();
    expect(estimarEspera(indicador.esperaReferencia, DATA_REFERENCIA, new Date("2026-11-10T00:00:00Z"))).toBeNull();
    expect(indicador.absenteismo).toBe(0);
  });

  test("CT13 espera estimada em 2026-11-10 = 30,0", () => {
    const [indicador] = calcularIndicadores(dsA(), DATA_REFERENCIA);
    const alvo = new Date(`${ORACULO.esperaEstimada.data}T00:00:00Z`);
    expect(estimarEspera(indicador.esperaReferencia, DATA_REFERENCIA, alvo)).toBeCloseTo(ORACULO.esperaEstimada.valor, CASAS);
  });

  test("sem atendidos nem faltas: absenteísmo 0 e histórica 0", () => {
    const aguardando = dsA().filter(r => r.status === "aguardando");
    const [indicador] = calcularIndicadores(aguardando, DATA_REFERENCIA);
    expect(indicador.absenteismo).toBe(0);
    expect(indicador.esperaHistorica).toBe(0);
  });

  test("agrupa por especialidade, unidade e competência", () => {
    const registros = dsA();
    registros.push({ ...registros[0], idRegistro: "000900", unidade: "UBS Norte" });
    expect(calcularIndicadores(registros, DATA_REFERENCIA)).toHaveLength(2);
  });

  test("lista vazia não gera indicadores", () => {
    expect(calcularIndicadores([], DATA_REFERENCIA)).toEqual([]);
  });

  test("diasEntre nunca é negativo", () => {
    expect(diasEntre("2026-10-10", "2026-10-01")).toBe(0);
  });

  test("estimarEspera usa a data atual quando não informada", () => {
    expect(estimarEspera(5, new Date())).toBeGreaterThanOrEqual(5);
  });
});
