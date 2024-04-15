import { QueryConfig } from "./params";

export type GetSweepableJobDefinitionParams = {
    staleJobDefinitionSweepThresholdMs : number,
}

export type GetSweepableJobDefinitionResult = {
    jobDefinitionID : number,
    jobDefinitionName : string,
}

export const getSweepableJobDefinition = (queryConfig : QueryConfig) => async (params : GetSweepableJobDefinitionParams) : Promise<GetSweepableJobDefinitionResult | undefined> => {
    const row = await queryConfig.handle.query<{ id: number, name : string }>(`
        SELECT "id", "name"
        FROM "${queryConfig.schema}"."job_definition" "job_definition"
        WHERE "last_heartbeat_at" + ($1 * INTERVAL '1 second') < NOW()
        AND NOT EXISTS (
            SELECT 1
            FROM "${queryConfig.schema}"."job" "_job"
            WHERE "_job"."job_definition_id" = "job_definition"."id"
        )
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    `, [params.staleJobDefinitionSweepThresholdMs / 1000]).then(rows => rows.rows?.[0])

    if(!row) {
        return undefined
    }

    return {
        jobDefinitionID : row.id,
        jobDefinitionName : row.name
    }
}