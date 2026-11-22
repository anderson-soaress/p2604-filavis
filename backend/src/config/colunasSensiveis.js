// Lista fechada de colunas potencialmente identificáveis (P1 v1.2 §10.3).
// Os nomes estão na forma normalizada: minúsculos e sem acento. O validador
// normaliza o cabeçalho do CSV da mesma forma antes de comparar, então
// "CPF", "Celular" e "Endereço" também são barrados.
const COLUNAS_SENSIVEIS = Object.freeze([
  "nome",
  "nome_paciente",
  "cpf",
  "cns",
  "rg",
  "telefone",
  "celular",
  "email",
  "endereco",
  "data_nascimento"
]);

module.exports = { COLUNAS_SENSIVEIS };
