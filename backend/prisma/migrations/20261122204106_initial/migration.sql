-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('GESTOR', 'REGULACAO');

-- CreateEnum
CREATE TYPE "StatusRegistro" AS ENUM ('aguardando', 'agendado', 'atendido', 'faltou', 'cancelado');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registro" (
    "id" SERIAL NOT NULL,
    "idRegistro" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "dataSolicitacao" TIMESTAMP(3) NOT NULL,
    "status" "StatusRegistro" NOT NULL,
    "competencia" TEXT NOT NULL,
    "vagasOfertadasPeriodo" INTEGER NOT NULL,
    "dataAgendada" TIMESTAMP(3),
    "dataAtendimento" TIMESTAMP(3),
    "funcionario" TEXT,
    "sala" TEXT,
    "horarioAgendado" TEXT,
    "horarioComprovado" BOOLEAN NOT NULL DEFAULT false,
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Indicador" (
    "id" SERIAL NOT NULL,
    "especialidade" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "filaAtiva" INTEGER NOT NULL,
    "esperaReferencia" DOUBLE PRECISION NOT NULL,
    "esperaHistorica" DOUBLE PRECISION NOT NULL,
    "absenteismo" DOUBLE PRECISION NOT NULL,
    "capacidade" INTEGER NOT NULL,
    "dataReferencia" TIMESTAMP(3) NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Indicador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SugestaoEncaixe" (
    "id" SERIAL NOT NULL,
    "registroId" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "criterio" TEXT NOT NULL,
    "decisao" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SugestaoEncaixe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Registro_idRegistro_key" ON "Registro"("idRegistro");

-- CreateIndex
CREATE INDEX "Registro_especialidade_unidade_competencia_idx" ON "Registro"("especialidade", "unidade", "competencia");

-- CreateIndex
CREATE INDEX "Registro_status_dataSolicitacao_idx" ON "Registro"("status", "dataSolicitacao");

-- CreateIndex
CREATE UNIQUE INDEX "Indicador_especialidade_unidade_competencia_key" ON "Indicador"("especialidade", "unidade", "competencia");

-- AddForeignKey
ALTER TABLE "SugestaoEncaixe" ADD CONSTRAINT "SugestaoEncaixe_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
