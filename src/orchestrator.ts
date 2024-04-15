import { Config } from "./config"
import { Daemon, DaemonEventHandler } from "./daemon"
import { deleteJob } from "./query/delete-job"
import { updateJobFinalizeState } from "./query/update-job-finalize-state"
import { getFinalizeableJob } from "./query/get-finalizeable-job"
import { Timer, sleep, transaction } from "./utils"
import { getSweepableJob } from "./query/get-sweepable-job"
import { insertJob } from "./query/insert-job"
import { deleteJobDefinition } from "./query/delete-job-definition"
import { getSweepableJobDefinition } from "./query/get-sweepable-job-definition"
import { updateJobDefinitionHeartbeatState } from "./query/update-job-definition-heartbeat-state"
import { JobDefinition } from "./job-definition"
import { getRepeatableJobDefinition } from "./query/get-repeatable-job"
import { updateJobDefinitionRepeatState } from "./query/update-job-definition-repeat-state"
import { updateJobDefinitionReleaseState } from "./query/update-job-definition-release-state"

export type OrchestratorConstructorParams = {
    config : Config
    repeatIntervalMs? : number
    heartbeatIntervalMs? : number
    finalizeIntervalMs? : number
    cleanIntervalMs? : number
    staleJobDefinitionSweepThresholdMs? : number
    finalizedJobSweepThresholdMs? : number
    name? : string
    eventHandler? : DaemonEventHandler
}

const defaultHeartbeatIntervalMs = 60 * 1000
const defaultRepeatIntervalMs = 30 * 1000
const defaultCleanIntervalMs = 60 * 1000 * 5
const defaultStaleJobDefinitionSweepThresholdMs = 60 * 60 * 1000
const defaultFinalizedJobSweepThresholdMs = 12 * 60 * 60 * 1000
const defaultName = "anon"

export class Orchestrator extends Daemon {
    private config : Config
    private repeatTimer : Timer
    private heartbeatTimer : Timer
    private cleanTimer : Timer
    private staleJobDefinitionSweepThresholdMs : number
    private finalizedJobSweepThresholdMs : number
    private jobDefinitions : { jobDefinitionID : number, jobDefinition : JobDefinition }[]

    constructor({
        config,
        repeatIntervalMs = defaultRepeatIntervalMs,
        heartbeatIntervalMs = defaultHeartbeatIntervalMs,
        cleanIntervalMs = defaultCleanIntervalMs,
        staleJobDefinitionSweepThresholdMs = defaultStaleJobDefinitionSweepThresholdMs,
        finalizedJobSweepThresholdMs = defaultFinalizedJobSweepThresholdMs,
        name = defaultName,
        eventHandler
    } : OrchestratorConstructorParams) {
        super(`${name}-orchestrator`, eventHandler)
        this.config = config
        this.repeatTimer = new Timer(repeatIntervalMs)
        this.heartbeatTimer = new Timer(heartbeatIntervalMs)
        this.cleanTimer = new Timer(cleanIntervalMs)
        this.staleJobDefinitionSweepThresholdMs = staleJobDefinitionSweepThresholdMs
        this.finalizedJobSweepThresholdMs = finalizedJobSweepThresholdMs
        this.jobDefinitions = []
    }

    private async initialize() {
        for(const jobDefinition of this.config.getJobDefinitions()) {
            this.jobDefinitions.push({
                jobDefinitionID: await jobDefinition.initialize(),
                jobDefinition
            })
        }
    }

    private async finalizeJobs() {
        while(!this.getShouldStop()) {
            const affectedJob = await transaction(this.config.getPool())(async client => {
                const queryConfig = {
                    schema: this.config.getSchema(),
                    handle: client
                }
                const job = await getFinalizeableJob(queryConfig)()
                if(job) {
                    if(job.timeout) {
                        this.onEvent({
                            eventType: "orchestrator-job-finalize-failure-timeout",
                            jobID: job.jobID,
                            jobDefinitionName: job.jobDefinitionName
                        })
                    } else if(job.noAttemptsRemaining) {
                        this.onEvent({
                            eventType: "orchestrator-job-finalize-failure-no-attempts-remaining",
                            jobID: job.jobID,
                            jobDefinitionName: job.jobDefinitionName
                        })
                    } else if(job.unmetDependencies) {
                        this.onEvent({
                            eventType: "orchestrator-job-finalize-failure-unmet-dependencies",
                            jobID: job.jobID,
                            jobDefinitionName: job.jobDefinitionName
                        })
                    }

                    await updateJobFinalizeState(queryConfig)({
                        isSuccess: false,
                        jobID: job.jobID
                    })
                }
                return !!job
            })

            if(!affectedJob) {
                break
            }
        }
    }

    private async sweepFinalizedJobs() {
        while(!this.getShouldStop()) {
            const affectedJob = await transaction(this.config.getPool())(async client => {
                const queryConfig = {
                    schema: this.config.getSchema(),
                    handle: client
                }
                const job = await getSweepableJob(queryConfig)({ 
                    finalizedJobSweepThresholdMs: this.finalizedJobSweepThresholdMs 
                })

                if(job) {
                    await deleteJob(queryConfig)({ jobID: job.jobID })
                    this.onEvent({
                        eventType: "orchestrator-finalized-job-sweep",
                        jobID: job.jobID,
                        jobDefinitionName: job.jobDefinitionName
                    })
                }

                return !!job
            })

            if(!affectedJob) {
                break
            }
        }
    }

    private async sweepStaleJobDefinitions() {
        while(!this.getShouldStop()) {
            const affectedJobDefinition = await transaction(this.config.getPool())(async client => {
                const queryConfig = {
                    schema: this.config.getSchema(),
                    handle: client
                }
                const jobDefinition = await getSweepableJobDefinition(queryConfig)({
                    staleJobDefinitionSweepThresholdMs: this.staleJobDefinitionSweepThresholdMs
                })

                if(jobDefinition) {
                    await deleteJobDefinition(queryConfig)({ jobDefinitionID: jobDefinition.jobDefinitionID })
                    this.onEvent({
                        eventType: "orchestrator-stale-job-definition-sweep",
                        jobDefinitionName: jobDefinition.jobDefinitionName
                    })
                }

                return !!jobDefinition
            })

            if(!affectedJobDefinition) {
                break
            }
        }
    }

    private async heartbeat() {
        if(!this.heartbeatTimer.hasElapsed()) {
            return
        }

        this.heartbeatTimer.reset()

        const queryConfig = {
            schema: this.config.getSchema(),
            handle: this.config.getPool()
        }
        for(const { jobDefinitionID, jobDefinition } of this.jobDefinitions) {
            await updateJobDefinitionHeartbeatState(queryConfig)({ jobDefinitionID })
            this.onEvent({ 
                eventType: "orchestrator-job-definition-heartbeat",
                jobDefinitionName: jobDefinition.getName()
            })
        }
    }

    private async repeatJobs() {
        if(!this.repeatTimer.hasElapsed()) {
            return
        }

        this.repeatTimer.reset()
        while(!this.getShouldStop()) {
            const affectedJobDefinition = await transaction(this.config.getPool())(async client => {
                const queryConfig = {
                    schema: this.config.getSchema(),
                    handle: client
                }
                const jobDefinitionRow = await getRepeatableJobDefinition(queryConfig)()

                if(jobDefinitionRow) {
                    await updateJobDefinitionRepeatState(queryConfig)({ 
                        jobDefinitionID: jobDefinitionRow.jobDefinitionID
                    })

                    const jobID = await insertJob(queryConfig)({
                        jobDefinitionID: jobDefinitionRow.jobDefinitionID,
                        payload: {},
                        numAttempts: jobDefinitionRow.numAttempts,
                        delayMs: 0
                    }).then(result => result.jobID)

                    this.onEvent({
                        eventType: "orchestrator-job-repeat",
                        jobID: jobID,
                        jobDefinitionName: jobDefinitionRow.jobDefinitionName
                    })
                }

                return !!jobDefinitionRow
            })
            
            if(!affectedJobDefinition) {
                break
            }
        }
    }

    private async clean() {
        if(!this.cleanTimer.hasElapsed()) {
            return
        }

        this.cleanTimer.reset()
        await this.finalizeJobs()
        await this.sweepFinalizedJobs()
        await this.sweepStaleJobDefinitions()
    }

    async run() {
        await this.initialize()
        while(!this.getShouldStop()) {
            await this.heartbeat()
            await this.repeatJobs()
            await this.clean()
            await sleep(50)
        }
    }
}