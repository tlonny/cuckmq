import { QueryConfig } from "./params"

export type UpdateJobDefinitionRepeatState = {
    jobDefinitionID : number,
}

export const updateJobDefinitionRepeatState = (queryConfig : QueryConfig) => async (params : UpdateJobDefinitionRepeatState) : Promise<void> => {
    await queryConfig.handle.query(`
        UPDATE "${queryConfig.schema}"."job_definition"
        SET "last_repeated_at" = NOW()
        WHERE "id" = $1
    `, [
        params.jobDefinitionID
    ])
}