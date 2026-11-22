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
- `npm test`
- `npm run test:coverage`
- `npm run lint`

Os testes unitários cobrem as regras centrais de validação e cálculo. A cobertura-alvo do P1
(80% em ValidadorCSV e CalculadoraIndicadores) precisa ser confirmada pela execução local.

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
- `POST /api/encaixes/:id/registrar`
- `POST /api/encaixes/:id/dispensar`

## Limitações explícitas
- O cadastro de referência de disponibilidade é simplificado e fica desativado quando ausente.
- A regra de encaixe considera somente vaga futura cancelada e candidato aguardando da mesma
  especialidade; não agenda automaticamente nem integra SISREG/e-SUS.
- A sessão usa armazenamento em memória para desenvolvimento. Antes de implantação,
  substituir por store persistente e configurar HTTPS, cookies seguros, rate limiting e gestão
  de segredos.
- A interface é um painel funcional inicial, não reprodução final de todos os protótipos P2.
- A validação de colunas sensíveis utiliza a lista fechada inicial. Revisar a lista do P1 §10.3
  antes de declarar conformidade integral.
