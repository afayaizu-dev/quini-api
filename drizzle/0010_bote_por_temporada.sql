ALTER TABLE "ajustes_bote" ADD COLUMN "temporada_id" uuid;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD COLUMN "origen_temporada_id" uuid;--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "ajustes_bote")
       AND NOT EXISTS (SELECT 1 FROM "temporadas" WHERE "activa") THEN
        RAISE EXCEPTION 'Migración 0010: hay ajustes de bote pero ninguna temporada activa a la que asignarlos. Activa una temporada y vuelve a migrar.';
    END IF;
END $$;--> statement-breakpoint
UPDATE "ajustes_bote" SET "temporada_id" = (SELECT "id" FROM "temporadas" WHERE "activa") WHERE "temporada_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ALTER COLUMN "temporada_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_temporada_id_temporadas_id_fk" FOREIGN KEY ("temporada_id") REFERENCES "public"."temporadas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_origen_temporada_id_temporadas_id_fk" FOREIGN KEY ("origen_temporada_id") REFERENCES "public"."temporadas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ajustes_bote_un_heredado_por_temporada" ON "ajustes_bote" USING btree ("temporada_id") WHERE "ajustes_bote"."origen_temporada_id" is not null;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_origen_distinto_check" CHECK ("ajustes_bote"."origen_temporada_id" <> "ajustes_bote"."temporada_id");
