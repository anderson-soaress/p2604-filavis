const { calcularIndicadores, estimarEspera } = require("../src/services/calculadoraIndicadores");

describe("CalculadoraIndicadores", () => {
  const registros = [
    { idRegistro: "1", especialidade: "Cardio", unidade: "Centro", competencia: "2026-10", status: "aguardando", dataSolicitacao: "2026-10-01", vagasOfertadasPeriodo: 10 },
    { idRegistro: "2", especialidade: "Cardio", unidade: "Centro", competencia: "2026-10", status: "atendido", dataSolicitacao: "2026-09-01", dataAtendimento: "2026-10-01", vagasOfertadasPeriodo: 10 },
    { idRegistro: "3", especialidade: "Cardio", unidade: "Centro", competencia: "2026-10", status: "faltou", dataSolicitacao: "2026-09-01", vagasOfertadasPeriodo: 10 }
  ];

  test("calcula fila, espera, absenteísmo e capacidade", () => {
    const [resultado] = calcularIndicadores(registros, new Date("2026-10-11T00:00:00Z"));
    expect(resultado.filaAtiva).toBe(1);
    expect(resultado.esperaReferencia).toBe(10);
    expect(resultado.esperaHistorica).toBe(30);
    expect(resultado.absenteismo).toBe(50);
    expect(resultado.capacidade).toBe(10);
  });

  test("retorna zero para absenteísmo sem atendidos/faltas", () => {
    const [resultado] = calcularIndicadores([registros[0]], new Date("2026-10-11T00:00:00Z"));
    expect(resultado.absenteismo).toBe(0);
  });

  test("estima espera somando dias desde a referência", () => {
    expect(estimarEspera(8, new Date("2026-10-01"), new Date("2026-10-11"))).toBe(18);
  });
});
