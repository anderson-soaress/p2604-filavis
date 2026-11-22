const { selecionarElegivel } = require("../src/services/servicoEncaixe");

test("seleciona solicitação mais antiga e desempata por id", () => {
  const registros = [
    { idRegistro: "R10", especialidade: "Cardio", status: "aguardando", dataSolicitacao: "2026-10-01", horarioComprovado: true },
    { idRegistro: "R02", especialidade: "Cardio", status: "aguardando", dataSolicitacao: "2026-10-01", horarioComprovado: true }
  ];
  const vagas = [{ idRegistro: "V1", especialidade: "Cardio", status: "cancelado", dataAgendada: "2026-12-01", disponibilidadeComprovada: true }];
  expect(selecionarElegivel(registros, vagas, new Date("2026-11-01"))[0].registroId).toBe("R02");
});

test("não sugere vaga passada ou sem disponibilidade comprovada", () => {
  const registros = [{ idRegistro: "R1", especialidade: "Cardio", status: "aguardando", dataSolicitacao: "2026-10-01" }];
  const vagas = [{ idRegistro: "V1", especialidade: "Cardio", status: "cancelado", dataAgendada: "2026-10-01", disponibilidadeComprovada: false }];
  expect(selecionarElegivel(registros, vagas, new Date("2026-11-01"))).toEqual([]);
});
