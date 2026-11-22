const { validarCSV } = require("../src/services/validadorCSV");

const cabecalho = "id_registro,especialidade,unidade,data_solicitacao,status,competencia,vagas_ofertadas_periodo";
const linha = "R001,Cardiologia,UBS Centro,2026-10-01,aguardando,2026-10,20";

describe("ValidadorCSV", () => {
  test("aceita lote válido", () => {
    const resultado = validarCSV(`${cabecalho}\n${linha}`);
    expect(resultado.valido).toBe(true);
    expect(resultado.registros).toHaveLength(1);
  });

  test("rejeita coluna obrigatória ausente", () => {
    const resultado = validarCSV("id_registro,especialidade\nR001,Cardiologia");
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some(erro => erro.campo === "unidade")).toBe(true);
  });

  test("rejeita coluna sensível mesmo com caixa/acentuação diferente", () => {
    const resultado = validarCSV(`${cabecalho},CPF\n${linha},123`);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some(erro => erro.campo === "cpf")).toBe(true);
  });

  test("rejeita identificador duplicado", () => {
    const resultado = validarCSV(`${cabecalho}\n${linha}\n${linha}`);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some(erro => erro.campo === "id_registro" && erro.mensagem.includes("duplicado"))).toBe(true);
  });

  test("rejeita data inválida", () => {
    const resultado = validarCSV(`${cabecalho}\nR002,Cardiologia,Centro,2026-02-30,aguardando,2026-10,20`);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some(erro => erro.campo === "data_solicitacao")).toBe(true);
  });

  test("rejeita status fora do domínio", () => {
    const resultado = validarCSV(`${cabecalho}\nR002,Cardiologia,Centro,2026-10-01,em_analise,2026-10,20`);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some(erro => erro.campo === "status")).toBe(true);
  });

  test("rejeita oferta divergente para mesma chave", () => {
    const segunda = "R002,Cardiologia,UBS Centro,2026-10-02,aguardando,2026-10,25";
    const resultado = validarCSV(`${cabecalho}\n${linha}\n${segunda}`);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some(erro => erro.campo === "vagas_ofertadas_periodo")).toBe(true);
  });
});
