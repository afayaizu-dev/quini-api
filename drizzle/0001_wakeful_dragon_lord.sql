ALTER TABLE "users" ADD COLUMN "apellidos" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "apodo" "citext";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telefono" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_apodo_key" ON "users" USING btree ("apodo");