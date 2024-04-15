import { QueryConfig } from "./params"

export type InsertJobResult = {
    jobID : number
}

export type InsertJobParams = {
    jobDefinitionID : number
    payload : object,
    numAttempts : number,
    delayMs : number,
}

export const insertJob = (queryConfig : QueryConfig) => async (params : InsertJobParams) : Promise<InsertJobResult> => {
    const jobID = await queryConfig.handle.query<{ id : number }>(`
        INSERT INTO "${queryConfig.schema}"."job" (
            "job_definition_id",
            "payload",
            "num_attempts",
            "unlocked_at"
        ) VALUES (
            $1, $2, $3, NOW() + ($4 * INTERVAL '1 second')
        ) RETURNING id
    `, [
        params.jobDefinitionID,
        JSON.stringify(params.payload),
        params.numAttempts,
        params.delayMs / 1000
    ]).then(rows => rows.rows[0].id)
    return { jobID }
}