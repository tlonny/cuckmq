import { QueryConfig } from "./params";

export type GetFinalizeableJobResult = {
    jobID : number,
    jobDefinitionName : string,
    timeout : boolean,
    noAttemptsRemaining : boolean, 
    unmetDependencies : boolean
}

type QueryResult = {
    id : number,
    name : string,
    timeout : boolean,
    no_attempts_remaining : boolean,
    unmet_dependencies : boolean
}

export const getFinalizeableJob = (queryConfig : QueryConfig) => async () : Promise<GetFinalizeableJobResult | undefined> => {
    const row = await queryConfig.handle.query<QueryResult>(`
        WITH "finalize_conditions" AS (
            SELECT
                "job"."id",
                "job_definition"."name",
                ("job"."created_at" + ("job_definition"."timeout_interval_ms" / 1000.0) * INTERVAL '1 second' < NOW()) AS timeout,
                ("job"."num_attempts" <= 0) AS no_attempts_remaining,
                (SELECT EXISTS (
                    SELECT 1
                    FROM "${queryConfig.schema}"."job_dependency" "_job_dependency"
                    JOIN "${queryConfig.schema}"."job" "_job" 
                    ON "_job_dependency"."required_job_id" = "_job"."id"
                    WHERE "_job_dependency"."job_id" = "job"."id"
                    AND "_job"."finalized_at" IS NOT NULL
                    AND NOT "_job"."is_success"
                )) AS unmet_dependencies
            FROM "${queryConfig.schema}"."job" "job"
            JOIN "${queryConfig.schema}"."job_definition" "job_definition"
            ON "job"."job_definition_id" = "job_definition"."id"
            WHERE "job"."finalized_at" IS NULL
        )
        SELECT "id", "name", "timeout", "no_attempts_remaining", "unmet_dependencies"
        FROM "finalize_conditions"
        WHERE "timeout" OR "no_attempts_remaining" OR "unmet_dependencies"
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    `).then(rows => rows.rows?.[0])

    if(!row) {
        return undefined
    }

    return {
        jobID : row.id,
        jobDefinitionName : row.name,
        timeout : row.timeout,
        noAttemptsRemaining : row.no_attempts_remaining,
        unmetDependencies : row.unmet_dependencies
    }
}