import { QueryConfig } from "./params"

export type UpdateJobUnlockStateParams = {
    jobID : number,
}

export const updateJobUnlockState = (queryConfig : QueryConfig) => async (params : UpdateJobUnlockStateParams) : Promise<void> => {
    await queryConfig.handle.query(`
        UPDATE "${queryConfig.schema}"."job" "job" SET
            "unlocked_at" = NOW() + ("job_definition"."lock_interval_ms" / 1000) * INTERVAL '1 second'
        FROM "${queryConfig.schema}"."job_definition" "job_definition"
        WHERE "job"."id" = $1 AND "job_definition"."id" = "job_definition_id"
    `, [
        params.jobID
    ])
}