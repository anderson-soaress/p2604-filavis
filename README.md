# FilaVis — incremento de código P3 (seções 5 a 7.1)

Implementação inicial alinhada ao P1 v1.2 e P2 v1.7: frontend Next.js, API Express,
Prisma/PostgreSQL, validação CSV antes da persistência, indicadores agregados,
sessão por perfil e sugestão consultiva de encaixe.

## Requisitos
- Node.js 20 LTS ou superior
- npm 10+
- PostgreSQL 15+

## Executar localmente
1. Crie um banco PostgreSQL chamado `filavis`.
2. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `SESSION_SECRET`.
3. Na raiz: `npm install`
   Copie também o `.env` para `backend/.env` (o Prisma CLI lê o `.env` da pasta onde roda) e para `frontend/.env.local` (o Next só lê a própria pasta).
4. Gere o Prisma Client e aplique a migração:
   `npm run db:generate`
   `npm run db:migrate`
5. Crie contas sintéticas:
   `npm run db:seed`
6. Inicie API e interface:
   `npm run dev`

API: http://localhost:3001/health
Frontend: http://localhost:3000

## Contas sintéticas
- gestor@filavis.local / Gestor123!
- regulacao@filavis.local / Regula123!

Somente para demonstração local. Não usar em produção.

## Testes e qualidade

| Comando (na raiz) | O que roda | Precisa de banco? |
|---|---|---|
| `npm run test:unit` | `backend/tests/unit` (validador, indicadores, encaixe) | não |
| `npm run test:api` | `backend/tests/api` (Supertest + PostgreSQL real) | sim |
| `npm run test:coverage` | unit + api com cobertura (`backend/coverage/`) | sim |
| `npm run lint` | ESLint do backend e do frontend | não |

A cobertura mínima do P1 (80% de linhas em `validadorCSV.js` e `calculadoraIndicadores.js`)
está em `backend/jest.config.js` (`coverageThreshold`): abaixo disso o comando falha.

### Banco de teste
Os testes de API **apagam** as tabelas `Registro`, `Indicador` e `SugestaoEncaixe` antes de
cada teste. Por segurança, `tests/api/setup.js` só roda se o nome do banco contiver `test`.

```bash
createdb filavis_test
export DATABASE_URL=postgresql://USUARIO:SENHA@localhost:5432/filavis_test
npm run db:deploy   # aplica as migrações
npm run db:seed     # contas sintéticas + cadastro de referência
npm run test:coverage
```

Em vez do `export`, você também pode criar um `.env.test` na raiz (ignorado pelo git) com o
`DATABASE_URL` de teste. Os testes fixam a data de referência em 2026-10-31 (a do DS-A).

### Dados sintéticos
- `data/ds-a.csv`: DS-A (7 registros de Cardiologia, UBS Centro, competência 2026-10).
- `data/ds-a.oraculo.json`: valores esperados calculados à mão, com a memória de cálculo.

Os testes geram as variações de cada CT a partir do DS-A (`backend/tests/helpers/dsA.js`).

## Integração contínua
`.github/workflows/ci.yml` roda em todo push na `main` e em todo pull request:

1. gitleaks (varredura de segredos no histórico);
2. Node 20 com cache npm e `npm ci`;
3. `prisma generate`, `prisma migrate deploy` e seed num PostgreSQL 16 (service container);
4. `npm run lint`;
5. `npm run test:coverage` (unit + api);
6. `next build` do frontend;
7. upload de `backend/coverage/` como artefato `coverage` (aba *Actions* → execução → *Artifacts*).

## Casos de teste (P1 §16.1) → arquivos

Os nomes dos testes começam com o ID do CT, por exemplo `npx jest -t CT09` (dentro de `backend/`).

| CT | Cenário | Arquivo(s) |
|---|---|---|
| CT01 | DS-A aceito: 7 registros, 0 críticos; 1 informativo sem coluna opcional | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT02 | Sem coluna `competencia` → rejeitado | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT03 | Data `01/10/2026` na linha 2 → erro com linha e campo | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT04 | `000102` duplicado → rejeitado | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT05 | Colunas sensíveis do §10.3 (+ `CPF`, `Celular`, `Endereço`) | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT06 | Status `remarcado` → rejeitado | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT07 | `000103` atendido sem `data_atendimento` → rejeitado | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT08 | Uma linha com 35 vagas → rejeitado | `tests/unit/validador.test.js`, `tests/api/importacoes.test.js` |
| CT09 | `000107` às 18:00 → aceito com exatamente 1 aviso | `tests/unit/validador.test.js` |
| CT10 | Só obrigatórias e condicionais → aceito com informativo | `tests/unit/validador.test.js` |
| CT11 | Indicadores do DS-A = oráculo (tolerância 0,1) | `tests/unit/indicadores.test.js` |
| CT12 | Só atendidos → fila vazia, espera "não calculável" | `tests/unit/indicadores.test.js` |
| CT13 | Espera estimada em 2026-11-10 = 30,0 | `tests/unit/indicadores.test.js` |
| CT15 | Vaga `000107`, sugerida `000101` | `tests/unit/encaixe.test.js`, `tests/api/encaixes.test.js` |
| CT16 | `000099` de 2026-10-01 → desempate sugere `000099` | `tests/unit/encaixe.test.js` |
| CT17 | Dispensar `000101` e `000102` → "Não há encaixe possível"; registro com 5 campos; 409 | `tests/unit/encaixe.test.js`, `tests/api/encaixes.test.js` |
| CT18 | Lote do CT09 → nenhuma vaga | `tests/unit/encaixe.test.js` |
| CT19 | `000107` em 2026-10-28 → nenhuma vaga | `tests/unit/encaixe.test.js` |
| CT20 | 401 sem sessão; 403 do Gestor em importação e registro de encaixe | `tests/api/autenticacao.test.js` |
| CT21 | Senha errada → mensagem genérica, sem cookie | `tests/api/autenticacao.test.js` |

Além dos CTs, há testes da RN11 (datas condicionais), da competência `AAAA-MM`, dos campos
obrigatórios vazios, dos limites da faixa de horário e do determinismo do encaixe (20 execuções).

## CSV mínimo
Obrigatórias: `id_registro, especialidade, unidade, data_solicitacao, status, competencia, vagas_ofertadas_periodo`
Condicionais: `data_agendada, data_atendimento`
Opcionais: `funcionario, sala, horario_agendado`

Datas no formato AAAA-MM-DD. Status aceitos: `aguardando`, `agendado`, `atendido`,
`faltou`, `cancelado`.

## Endpoints principais
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/importacoes` (somente REGULACAO; multipart `arquivo`)
- `GET /api/dashboard`
- `GET /api/encaixes` (somente REGULACAO)
- `POST /api/encaixes/:id/registrar` (`:id` = vaga; corpo `{ registroId }`; 409 se não for a sugestão vigente)
- `POST /api/encaixes/:id/dispensar` (corpo `{ registroId }`; devolve a próxima candidata)

## Limitações explícitas
- O cadastro de referência de disponibilidade (`DisponibilidadeProfissional`) é simplificado:
  uma faixa `[horaInicio, horaFim)` por profissional, unidade e dia da semana. Sem cadastro,
  a importação emite um informativo e nenhuma vaga fica elegível para encaixe.
- A regra de encaixe considera somente vaga futura cancelada e candidato aguardando da mesma
  especialidade; não agenda automaticamente nem integra SISREG/e-SUS.
- A sessão usa armazenamento em memória para desenvolvimento. Antes de implantação,
  substituir por store persistente e configurar HTTPS, cookies seguros, rate limiting e gestão
  de segredos.
- A interface é um painel funcional inicial, não reprodução final de todos os protótipos P2.
- A validação de colunas sensíveis usa exatamente a lista do P1 §10.3
  (`backend/src/config/colunasSensiveis.js`). Ela barra só nomes de coluna e não inspeciona o
  conteúdo das células.
