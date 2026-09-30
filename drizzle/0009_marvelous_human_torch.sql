CREATE TABLE "ajustes_bote" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"importe" numeric(12, 2) NOT NULL,
	"motivo" text NOT NULL,
	"fecha" date NOT NULL,
	"registrado_por" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_registrado_por_users_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;