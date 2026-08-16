CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"importe" numeric(12, 2) NOT NULL,
	"fecha_pago" date NOT NULL,
	"registrado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pagos_importe_check" CHECK ("pagos"."importe" > 0)
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;