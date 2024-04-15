import { QueryConfig } from "./params"

export type DeleteJobDefinitionParams = {
    jobDefinitionID : number,
}

export const deleteJobDefinition = (queryConfig : QueryConfig) => async (params : DeleteJobDefinitionParams) : Promise<void> => {
    await queryConfig.handle.query(`
        DELETE FROM "${queryConfig.schema}"."job_definition" 
        WHERE "id" = $1
    `, [
        params.jobDefinitionID
    ])
}