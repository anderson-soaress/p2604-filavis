-- CreateTable
CREATE TABLE "DisponibilidadeProfissional" (
    "id" SERIAL NOT NULL,
    "codigoProfissional" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,

    CONSTRAINT "DisponibilidadeProfissional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilidadeProfissional_codigoProfissional_unidade_diaS_key" ON "DisponibilidadeProfissional"("codigoProfissional", "unidade", "diaSemana", "horaInicio");
