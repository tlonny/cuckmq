import { QueryConfig } from "./params";

export type GetRepeatableJobDefinitionResult = {
    jobDefinitionID : number,
    jobDefinitionName : string,
    numAttempts : number,
}

export const getRepeatableJobDefinition = (queryConfig : QueryConfig) => async () : Promise<GetRepeatableJobDefinitionResult | undefined> => {
    const row = await queryConfig.handle.query(`
        SELECT "id", "name", "num_attempts"
        FROM "${queryConfig.schema}"."job_definition"
        WHERE "repeat_interval_ms" IS NOT NULL
        AND "last_repeated_at" IS NULL
        OR "last_repeated_at" + ("repeat_interval_ms" / 1000.0) * INTERVAL '1 second' < NOW()
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    `).then(rows => rows.rows?.[0])

    if(!row) {
        return undefined
    }

    return {
        jobDefinitionID : row.id,
        jobDefinitionName : row.name,
        numAttempts : row.num_attempts,
    }
}