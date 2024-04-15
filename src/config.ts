import { Pool } from "pg"
import { JobDefinition } from "./job-definition"
import { prepareSchema } from "./query/prepare-schema"

export type ConfigConstructorParams = {
    pool: Pool
    schema?: string,
}

const defaultSchema = "_cuckmq"

export class Config {
    private pool : Pool
    private schema : string
    private jobDefinitions : { [key: string] : JobDefinition<any> }

    constructor({
        pool, 
        schema = defaultSchema
    } : ConfigConstructorParams) {
        this.pool = pool
        this.schema = schema
        this.jobDefinitions = {}
    }

    getJobDefinitions = () => {
        return [...Object.values(this.jobDefinitions)]
    }

    getJobDefinition = (name : string) : JobDefinition<any> | undefined => {
        return this.jobDefinitions[name]
    }

    registerJobDefinition = (jobDefinition : JobDefinition<any>) => {
        this.jobDefinitions[jobDefinition.getName()] = jobDefinition
    }

    getSchema = () => {
        return this.schema
    }

    getPool = () => {
        return this.pool
    }

    prepareSchema = async () => {
        await prepareSchema({
            schema: this.schema,
            handle: this.pool
        })()
    }

}
