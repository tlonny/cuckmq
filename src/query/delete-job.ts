import { QueryConfig } from "./params"

export type DeleteJobParams = {
    jobID : number,
}

export const deleteJob = (queryConfig : QueryConfig) => async (params : DeleteJobParams) : Promise<void> => {
    await queryConfig.handle.query(`
        DELETE FROM "${queryConfig.schema}"."job" 
        WHERE "id" = $1
    `, [
        params.jobID
    ])
}