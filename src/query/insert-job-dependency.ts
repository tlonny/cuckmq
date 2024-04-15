import { QueryConfig } from "./params"

export type InsertJobDependencyParams = {
    jobID : number
    jobIDDependency : number,
}

export const insertJobDependency = (queryConfig : QueryConfig) => async (params : InsertJobDependencyParams) : Promise<void> => {
    await queryConfig.handle.query(`
        INSERT INTO "${queryConfig.schema}"."job_dependency" (
            "job_id",
            "required_job_id"
        ) VALUES (
            $1, $2
        )
    `, [
        params.jobID,
        params.jobIDDependency
    ])
}