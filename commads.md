# Comandos del la aplicación

## docker

| **comando**                                    | **Utilidad**                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| npm run db:psql -- -c '\l'                     | Sirve para entrar “indirectamente” a PostgreSQL dentro del contenedor y listar las bases de datos, sin abrir una sesión interactiva. |
| docker compose -f docker/docker-compose.yml ps | Solo inspecciona y muestra estado de la máquinas del ficheros                                                                        |
