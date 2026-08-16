CREATE TABLE "resultados_miembro" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"jornada_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"aciertos_apuesta_1" smallint,
	"aciertos_apuesta_2" smallint,
	"aciertos_max" smallint NOT NULL,
	"premio_apuesta_1" numeric(12, 2) DEFAULT 0 NOT NULL,
	"premio_apuesta_2" numeric(12, 2) DEFAULT 0 NOT NULL,
	"ranking" smallint NOT NULL,
	"escalon" smallint NOT NULL,
	"importe_escalon" numeric(12, 2) NOT NULL,
	"coste_apuestas" numeric(12, 2) DEFAULT 1.5 NOT NULL,
	"bote" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resultados_miembro_aciertos_1_check" CHECK ("resultados_miembro"."aciertos_apuesta_1" BETWEEN 0 AND 14),
	CONSTRAINT "resultados_miembro_aciertos_2_check" CHECK ("resultados_miembro"."aciertos_apuesta_2" BETWEEN 0 AND 14),
	CONSTRAINT "resultados_miembro_escalon_check" CHECK ("resultados_miembro"."escalon" BETWEEN 1 AND 10),
	CONSTRAINT "resultados_miembro_ranking_check" CHECK ("resultados_miembro"."ranking" >= 1)
);
--> statement-breakpoint
CREATE TABLE "escalones_pago" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escalon" smallint NOT NULL,
	"importe" numeric(12, 2) NOT NULL,
	CONSTRAINT "escalones_pago_escalon_check" CHECK ("escalones_pago"."escalon" BETWEEN 1 AND 10),
	CONSTRAINT "escalones_pago_importe_check" CHECK ("escalones_pago"."importe" > 0)
);
--> statement-breakpoint
ALTER TABLE "resultados_miembro" ADD CONSTRAINT "resultados_miembro_jornada_id_jornadas_id_fk" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultados_miembro" ADD CONSTRAINT "resultados_miembro_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resultados_miembro_jornada_usuario_key" ON "resultados_miembro" USING btree ("jornada_id","usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "escalones_pago_escalon_key" ON "escalones_pago" USING btree ("escalon");


INSERT INTO "escalones_pago" ("escalon", "importe") VALUES
    (10, 2.50),
    (9, 2.40),
    (8, 2.30),
    (7, 2.20),
    (6, 2.10),
    (5, 2.00),
    (4, 1.90),
    (3, 1.80),
    (2, 1.70),
    (1, 1.50);