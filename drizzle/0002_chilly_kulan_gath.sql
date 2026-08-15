ALTER TABLE "jornadas" ADD COLUMN "fecha_apertura_apuestas" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "fecha_cierre_apuestas" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "fecha_cierre_jornada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jornadas" ADD COLUMN "apuesta_pleno_15" text;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_ventana_check" CHECK ("jornadas"."fecha_apertura_apuestas" is null or "jornadas"."fecha_cierre_apuestas" is null or "jornadas"."fecha_cierre_apuestas" > "jornadas"."fecha_apertura_apuestas");--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_pleno_check" CHECK ("jornadas"."apuesta_pleno_15" ~ '^[012M]-[012M]$');