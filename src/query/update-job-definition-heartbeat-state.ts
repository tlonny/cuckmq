import { QueryConfig } from "./params"

export type UpdateJobDefinitionHeartbeatState = {
    jobDefinitionID : number,
}

export const updateJobDefinitionHeartbeatState = (queryConfig : QueryConfig) => async (params : UpdateJobDefinitionHeartbeatState) : Promise<void> => {
    await queryConfig.handle.query(`
        UPDATE "${queryConfig.schema}"."job_definition"
        SET "last_heartbeat_at" = NOW()
        WHERE "id" = $1
    `, [
        params.jobDefinitionID
    ])
}