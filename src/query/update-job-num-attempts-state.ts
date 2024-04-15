import { QueryConfig } from "./params"

export type UpdateJobNumAttemptsStateParams = {
    jobID : number,
}

export const updateJobNumAttemptsState = (queryConfig : QueryConfig) => async (params : UpdateJobNumAttemptsStateParams) : Promise<void> => {
    await queryConfig.handle.query(`
        UPDATE "${queryConfig.schema}"."job" SET
            "num_attempts" = "num_attempts" - 1
        WHERE "id" = $1 AND "job_definition"."id" = "job_definition_id"
    `, [
        params.jobID
    ])
}