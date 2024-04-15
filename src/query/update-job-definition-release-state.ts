import { QueryConfig } from "./params"

export type UpdateJobDefinitionReleaseState = {
    jobDefinitionID : number,
}

export const updateJobDefinitionReleaseState = (queryConfig : QueryConfig) => async (params : UpdateJobDefinitionReleaseState) : Promise<void> => {
    await queryConfig.handle.query(`
        UPDATE "${queryConfig.schema}"."job_definition"
        SET "last_released_at" = NOW()
        WHERE "id" = $1
    `, [
        params.jobDefinitionID
    ])
}