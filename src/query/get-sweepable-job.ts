import { QueryConfig } from "./params";

export type GetSweepableJobParams = {
    finalizedJobSweepThresholdMs : number,
}

export type GetSweepableJobResult = {
    jobID : number,
    jobDefinitionName : string,
}

export const getSweepableJob = (queryConfig : QueryConfig) => async (params : GetSweepableJobParams) : Promise<GetSweepableJobResult | undefined> => {
    const row = await queryConfig.handle.query<{ id: number, name : string }>(`
        SELECT "job"."id", "job_definition"."name"
        FROM "${queryConfig.schema}"."job" "job"
        JOIN "${queryConfig.schema}"."job_definition" "job_definition"
        ON "job"."job_definition_id" = "job_definition"."id"
        WHERE "job"."finalized_at" IS NOT NULL
        AND "job"."finalized_at" + ($1 * INTERVAL '1 second') < NOW()
        AND NOT EXISTS (
            SELECT 1
            FROM "${queryConfig.schema}"."job_dependency" "_job_dependency"
            JOIN "${queryConfig.schema}"."job" "_job" 
            ON "_job_dependency"."job_id" = "_job"."id"
            WHERE "_job_dependency"."required_job_id" = "job"."id"
            AND "_job"."finalized_at" IS NULL
        )
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    `, [params.finalizedJobSweepThresholdMs / 1000]).then(rows => rows.rows?.[0])
    if(!row) {
        return undefined
    }

    return {
        jobID : row.id,
        jobDefinitionName : row.name
    }
}