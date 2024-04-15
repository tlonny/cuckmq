import { Config } from "./config"
import { insertJob } from "./query/insert-job"
import { insertJobDependency } from "./query/insert-job-dependency"
import { upsertJobDefinition } from "./query/upsert-job-definition"
import { max, transaction } from "./utils"

type EmptyObject = {
    [key : string] : never
}

export type JobID = number

export type JobDefinitionDeferConfigParams<T extends object> = {
    payload : T,
    dependencies? : JobID[]
    delayMs? : number
}

export type JobDefinitionConstructorParams<T extends object> = {
    config : Config,
    name : string
    channel? : string
    jobFunction : (params : T) => Promise<void>
    numAttempts? : number
    repeatIntervalMs? : T extends EmptyObject ? (number | null) : null
    releaseIntervalMs? : number
    lockIntervalMs? : number
    timeoutIntervalMs? : number
}

const defaultChannel = "_default"
const defaultNumAttempts = 1
const defaultDelayMs = 0
const defaultReleaseIntervalMs = 0
const defaultLockIntervalMs = 60 * 1000
const defaultTimeoutIntervalMs = 12 * 60 * 60 * 1000

export class JobDefinition<T extends object = EmptyObject> {
    private config : Config
    private name : string
    private channel : string
    private jobFunction : (params : T) => Promise<void>
    private numAttempts : number
    private repeatIntervalMs : (number | null)
    private releaseIntervalMs : number
    private lockIntervalMs : number
    private timeoutIntervalMs : number
    private jobDefinitionID? : number

    constructor({
        config,
        name,
        channel = defaultChannel,
        jobFunction,
        numAttempts = defaultNumAttempts,
        repeatIntervalMs = null,
        releaseIntervalMs = defaultReleaseIntervalMs,
        lockIntervalMs = defaultLockIntervalMs,
        timeoutIntervalMs = defaultTimeoutIntervalMs
    } : JobDefinitionConstructorParams<T>) {
        this.config = config
        this.name = name
        this.channel = channel
        this.jobFunction = jobFunction
        this.numAttempts = numAttempts
        this.repeatIntervalMs = repeatIntervalMs
        this.releaseIntervalMs = releaseIntervalMs
        this.lockIntervalMs = lockIntervalMs
        this.timeoutIntervalMs = timeoutIntervalMs
    }

    getName() {
        return this.name
    }

    getChannel() {
        return this.channel
    }

    getNumAttempts() {
        return this.numAttempts
    }

    getRepeatIntervalMs() {
        return this.repeatIntervalMs
    }
    
    getTimeoutIntervalMs() {
        return this.lockIntervalMs
    }

    async initialize() : Promise<number> {
        const queryConfig = {
            schema: this.config.getSchema(),
            handle: this.config.getPool()
        }
        if(this.jobDefinitionID === undefined) {
            this.jobDefinitionID = await upsertJobDefinition(queryConfig)({
                name: this.name,
                channel: this.channel,
                repeatIntervalMs: this.repeatIntervalMs ? max(this.repeatIntervalMs, 0) : null,
                releaseIntervalMs: max(this.releaseIntervalMs, 0),
                lockIntervalMs: max(this.lockIntervalMs, 0),
                timeoutIntervalMs: max(this.timeoutIntervalMs, 0),
                numAttempts: max(this.numAttempts, 1)
            }).then(result => result.jobDefinitionID)
        }
        return this.jobDefinitionID
    }

    register() {
        this.config.registerJobDefinition(this)
    }

    async defer({
        payload,
        dependencies = [],
        delayMs = defaultDelayMs
    } : JobDefinitionDeferConfigParams<T>) : Promise<JobID> {
        const jobDefinitionID = await this.initialize()
        const pool = this.config.getPool()

        const jobID = await transaction(pool)(async client => {
            const queryConfig = {
                schema: this.config.getSchema(),
                handle: client
            }
            const jobID = await insertJob(queryConfig)({
                jobDefinitionID,
                payload,
                numAttempts: this.numAttempts,
                delayMs: max(delayMs, 0)
            }).then(result => result.jobID)

            for(const dependency of dependencies) {
                await insertJobDependency(queryConfig)({
                    jobID,
                    jobIDDependency: dependency
                })
            }
            return jobID
        })

        return jobID
    }

    run = (payload : T) => {
        return this.jobFunction(payload)
    }

}