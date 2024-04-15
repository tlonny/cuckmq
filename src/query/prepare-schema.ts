import { QueryConfig } from "./params"

export const prepareSchema = (queryConfig : QueryConfig) => async () : Promise<void> => {
    await queryConfig.handle.query(`
        CREATE SCHEMA IF NOT EXISTS "${queryConfig.schema}"
    `)

    await queryConfig.handle.query(`
        CREATE TABLE IF NOT EXISTS "${queryConfig.schema}"."job_definition" (
            "id" SERIAL,
            "name" TEXT NOT NULL,
            "channel" TEXT NOT NULL,
            "num_attempts" INTEGER NOT NULL,
            "repeat_interval_ms" INTEGER NULL,
            "release_interval_ms" INTEGER NOT NULL,
            "lock_interval_ms" INTEGER NOT NULL,
            "timeout_interval_ms" INTEGER NOT NULL,
            "last_repeated_at" TIMESTAMP NULL,
            "last_released_at" TIMESTAMP NULL,
            "last_heartbeat_at" TIMESTAMP NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
            PRIMARY KEY ("id")
        )
    `)

    await queryConfig.handle.query(`
        CREATE TABLE IF NOT EXISTS "${queryConfig.schema}"."job" (
            "id" SERIAL,
            "job_definition_id" INTEGER NOT NULL,
            "payload" JSONB NOT NULL,
            "num_attempts" INTEGER NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
            "unlocked_at" TIMESTAMP NOT NULL,
            "finalized_at" TIMESTAMP NULL,
            "is_success" BOOLEAN NULL,
            PRIMARY KEY ("id"),
            FOREIGN KEY ("job_definition_id") REFERENCES "${queryConfig.schema}"."job_definition" ("id")
        )
    `)

    await queryConfig.handle.query(`
        CREATE TABLE IF NOT EXISTS "${queryConfig.schema}"."job_dependency" (
            "id" SERIAL,
            "job_id" INTEGER NOT NULL,
            "required_job_id" INTEGER NOT NULL,
            "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
            PRIMARY KEY ("id"),
            FOREIGN KEY ("job_id") REFERENCES "${queryConfig.schema}"."job" ("id") 
                ON DELETE CASCADE,
            FOREIGN KEY ("required_job_id") REFERENCES "${queryConfig.schema}"."job" ("id")
                ON DELETE CASCADE
        )
    `)

    await queryConfig.handle.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "job_definition_name_idx" ON 
            "${queryConfig.schema}"."job_definition" ("name")
    `)

    await queryConfig.handle.query(`
        CREATE INDEX IF NOT EXISTS "job_dependency_job_id_idx" ON 
            "${queryConfig.schema}"."job_dependency" ("job_id")
    `)
}