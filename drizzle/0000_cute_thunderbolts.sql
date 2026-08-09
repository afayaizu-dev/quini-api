CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"nombre" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" "citext" NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" in ('user','admin'))
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"family_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" "inet"
);
--> statement-breakpoint
CREATE TABLE "equipos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nombre_largo" "citext" NOT NULL,
	"nombre_corto" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipos_nombre_largo_check" CHECK (length(trim("equipos"."nombre_largo")) > 0),
	CONSTRAINT "equipos_nombre_corto_check" CHECK (length(trim("equipos"."nombre_corto")) > 0)
);
--> statement-breakpoint
CREATE TABLE "temporadas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date NOT NULL,
	"activa" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "temporadas_codigo_check" CHECK ("temporadas"."codigo" ~ '^\d{4}-\d{2}$'),
	CONSTRAINT "temporadas_fechas_check" CHECK ("temporadas"."fecha_fin" > "temporadas"."fecha_inicio")
);
--> statement-breakpoint
CREATE TABLE "jornadas" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"temporada_id" uuid NOT NULL,
	"numero_jornada" integer NOT NULL,
	"fecha" date NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jornadas_numero_check" CHECK ("jornadas"."numero_jornada" >= 1)
);
--> statement-breakpoint
CREATE TABLE "partidos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"jornada_id" uuid NOT NULL,
	"orden" smallint NOT NULL,
	"equipo_local_id" uuid NOT NULL,
	"equipo_visitante_id" uuid NOT NULL,
	CONSTRAINT "partidos_orden_check" CHECK ("partidos"."orden" between 1 and 15),
	CONSTRAINT "partidos_equipos_distintos_check" CHECK ("partidos"."equipo_local_id" <> "partidos"."equipo_visitante_id")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_temporada_id_temporadas_id_fk" FOREIGN KEY ("temporada_id") REFERENCES "public"."temporadas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_jornada_id_jornadas_id_fk" FOREIGN KEY ("jornada_id") REFERENCES "public"."jornadas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_equipo_local_id_equipos_id_fk" FOREIGN KEY ("equipo_local_id") REFERENCES "public"."equipos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_equipo_visitante_id_equipos_id_fk" FOREIGN KEY ("equipo_visitante_id") REFERENCES "public"."equipos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email_key" ON "invitations" USING btree ("email") WHERE "invitations"."accepted_at" is null and "invitations"."revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_account_key" ON "oauth_accounts" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "equipos_nombre_largo_key" ON "equipos" USING btree ("nombre_largo");--> statement-breakpoint
CREATE UNIQUE INDEX "temporadas_codigo_key" ON "temporadas" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "temporadas_una_activa" ON "temporadas" USING btree ("activa") WHERE "temporadas"."activa";--> statement-breakpoint
CREATE UNIQUE INDEX "jornadas_temporada_numero_key" ON "jornadas" USING btree ("temporada_id","numero_jornada");--> statement-breakpoint
CREATE UNIQUE INDEX "partidos_jornada_orden_key" ON "partidos" USING btree ("jornada_id","orden");