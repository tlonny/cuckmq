import { Config } from "./config"
import { Daemon, DaemonEventHandler } from "./daemon"
import { getAvailableJob } from "./query/get-available-job"
import { updateJobDefinitionReleaseState } from "./query/update-job-definition-release-state"
import { updateJobFinalizeState } from "./query/update-job-finalize-state"
import { updateJobNumAttemptsState } from "./query/update-job-num-attempts-state"
import { updateJobUnlockState } from "./query/update-job-unlock-state"
import { Semaphore, Timer, max, sleep, transaction } from "./utils"

export type WorkerConstructorParams = {
    config : Config
    channel?: string
    processIntervalMs?: number
    concurrency?: number
    name? : string
    eventHandler? : DaemonEventHandler
}

const defaultName = "anon"
const defaultChannel = "_default"
const defaultConcurrency = 1
const defaultProcessIntervalMs = 1000

export class Worker extends Daemon {
    private config : Config
    private channel : string
    private semaphore : Semaphore
    private processTimer : Timer

    constructor({
        config,
        channel = defaultChannel,
        concurrency = defaultConcurrency,
        processIntervalMs = defaultProcessIntervalMs,
        name = defaultName,
        eventHandler
    } : WorkerConstructorParams) {
        super(`${name}-worker`, eventHandler)
        this.config = config
        this.channel = channel
        this.semaphore = new Semaphore(max(concurrency, 1))
        this.processTimer = new Timer(processIntervalMs)
    }

    private async processJobs() {
        if(!this.processTimer.hasElapsed()) {
            return
        }

        this.processTimer.reset()
        const pool = this.config.getPool()

        while(!this.getShouldStop()) {
            const job = await transaction(pool)(async (client) => {
                const queryConfig = {
                    schema: this.config.getSchema(),
                    handle: client
                }
                const job = await getAvailableJob(queryConfig)({ channel : this.channel })
                if(job) {
                    await updateJobUnlockState(queryConfig)({ jobID : job.jobID })
                    await updateJobDefinitionReleaseState(queryConfig)({ jobDefinitionID: job.jobDefinitionID })
                }

                return job
            })

            if(!job) {
                break
            }

            this.onEvent({
                eventType: "worker-job-dequeue",
                jobID: job?.jobID,
                jobDefinitionName: job?.jobDefinitionName,
            })

            await this.semaphore.acquire()

            const processFn = async () => {
                const queryConfig = {
                    schema: this.config.getSchema(),
                    handle: pool
                }
                try {
                    const jobDefinition = await this.config.getJobDefinition(job.jobDefinitionName)
                    if(!jobDefinition) {
                        await updateJobFinalizeState(queryConfig)({
                            isSuccess: false,
                            jobID: job.jobID
                        })

                        this.onEvent({
                            eventType: "worker-job-finalize-failure-orphaned",
                            jobID : job.jobID,
                            jobDefinitionName : job.jobDefinitionName,
                        })
                        return
                    }

                    await jobDefinition.run(job.payload)
                    await updateJobFinalizeState(queryConfig)({
                        isSuccess: true,
                        jobID: job.jobID
                    })

                    this.onEvent({
                        eventType: "worker-job-finalize-success",
                        jobID : job.jobID,
                        jobDefinitionName : job.jobDefinitionName,
                    })
                } catch (e) {
                    this.onEvent({
                        eventType: "worker-job-error",
                        jobID : job.jobID,
                        jobDefinitionName : job.jobDefinitionName,
                        error: e,
                    })
                    await updateJobNumAttemptsState(queryConfig)({ jobID: job.jobID })
                } finally {
                    this.semaphore.release()
                }
            }

            processFn()
        }

        this.processTimer.reset()
    }

    protected async run(){ 
        while(!this.getShouldStop()) {
            await this.processJobs()
            await sleep(50)
        }

        for(let ix = 0; ix < this.semaphore.getInitialCount(); ix += 1) {
            await this.semaphore.acquire()
        }
    }
}