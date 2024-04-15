import { QueryConfig } from "./params";

export type GetAvailableJobResult = {
    jobID : number,
    jobDefinitionName : string,
    jobDefinitionID : number,
    payload : object,
    numAttempts : number,
}

export type GetAvailableJobParams = {
    channel : string
}

type QueryResult = {
    id : number,
    job_definition_id : number,
    name : string,
    payload : object,
    num_attempts : number,
}

export const getAvailableJob = (queryConfig : QueryConfig) => async (params : GetAvailableJobParams) : Promise<GetAvailableJobResult | undefined> => {
    const row = await queryConfig.handle.query<QueryResult>(`
        SELECT
            "job"."id",
            "job_definition"."name",
            "job"."job_definition_id",
            "job"."payload",
            "job"."num_attempts"
        FROM "${queryConfig.schema}"."job" "job"
        JOIN "${queryConfig.schema}"."job_definition" "job_definition"
        ON "job"."job_definition_id" = "job_definition"."id"
        WHERE
            "job"."finalized_at" IS NULL AND 
            "job"."unlocked_at" < NOW() AND 
            "job_definition"."channel" = $1 AND 
            "job"."num_attempts" > 0 AND (
                "job_definition"."last_released_at" IS NULL OR
                "job_definition"."last_released_at" + ("job_definition"."release_interval_ms" / 1000.0) * INTERVAL '1 second' < NOW()
            ) AND NOT EXISTS (
                SELECT 1 FROM "${queryConfig.schema}"."job_dependency" "_job_dependency"
                JOIN "${queryConfig.schema}"."job" "_job" ON "_job_dependency"."required_job_id" = "_job"."id"
                WHERE "_job_dependency"."job_id" = "job"."id" AND (
                    "_job"."finalized_at" IS NULL OR
                    ("_job"."finalized_at" IS NOT NULL AND "_job"."is_success" = FALSE)
                )
            )
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    `, [params.channel]).then(rows => rows.rows?.[0])

    if(!row) {
        return undefined
    }

    return {
        jobID : row.id,
        jobDefinitionID : row.job_definition_id,
        jobDefinitionName : row.name,
        payload: row.payload,
        numAttempts: row.num_attempts
    }
}