import { QueryConfig } from "./params"

export type UpsertJobDefinitionParams = {
    name : string,
    channel : string,
    repeatIntervalMs : number | null,
    releaseIntervalMs : number,
    lockIntervalMs : number,
    timeoutIntervalMs : number,
    numAttempts : number,
}

export type UpsertJobDefinitionResult = {
    jobDefinitionID : number
}

export const upsertJobDefinition = (queryConfig : QueryConfig) => async (params : UpsertJobDefinitionParams) : Promise<UpsertJobDefinitionResult> => {
    const jobDefinitionID = await queryConfig.handle.query<{ id : number }>(`
        INSERT INTO "${queryConfig.schema}"."job_definition" (
            "name", 
            "channel",
            "num_attempts",
            "repeat_interval_ms",
            "release_interval_ms",
            "lock_interval_ms",
            "timeout_interval_ms",
            "last_heartbeat_at"
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, NOW()
        ) ON CONFLICT ("name") DO UPDATE SET
            "name" = EXCLUDED."name",
            "channel" = EXCLUDED."channel",
            "num_attempts" = EXCLUDED."num_attempts",
            "repeat_interval_ms" = EXCLUDED."repeat_interval_ms",
            "release_interval_ms" = EXCLUDED."release_interval_ms",
            "lock_interval_ms" = EXCLUDED."lock_interval_ms",
            "timeout_interval_ms" = EXCLUDED."timeout_interval_ms",
            "last_heartbeat_at" = NOW()
        RETURNING id
    `, [
        params.name,
        params.channel,
        params.numAttempts,
        params.repeatIntervalMs,
        params.releaseIntervalMs,
        params.lockIntervalMs,
        params.timeoutIntervalMs
    ]).then(rows => rows.rows[0].id)
    return { jobDefinitionID }
}