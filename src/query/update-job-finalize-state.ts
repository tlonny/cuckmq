import { QueryConfig } from "./params"

export type UpdateJobFinalizeStateParams = {
    jobID : number,
    isSuccess : boolean,
}

export const updateJobFinalizeState = (queryConfig : QueryConfig) => async (params : UpdateJobFinalizeStateParams) : Promise<void> => {
    await queryConfig.handle.query(`
        UPDATE "${queryConfig.schema}"."job" SET
            "finalized_at" = NOW(),
            "is_success" = $1
        WHERE "id" = $2
    `, [
        params.isSuccess,
        params.jobID
    ])
}