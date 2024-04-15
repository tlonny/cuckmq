export type DaemonStart = {
    eventType : "daemon-start"
}

export type DaemonStopSignalSend = {
    eventType : "daemon-stop-signal-send"
}

export type DaemonStop = {
    eventType : "daemon-stop"
}

export type WorkerJobDequeue = {
    eventType : "worker-job-dequeue"
    jobID : number
    jobDefinitionName: string
}

export type WorkerJobFinalizeSuccess = {
    eventType : "worker-job-finalize-success",
    jobID : number
    jobDefinitionName: string
}

export type WorkerJobFinalizeFailureOrphaned = {
    eventType : "worker-job-finalize-failure-orphaned",
    jobID : number
    jobDefinitionName: string
}

export type WorkerJobError = {
    eventType : "worker-job-error",
    jobID : number
    jobDefinitionName: string
    error : any
}

export type OrchestratorJobRepeat = {
    eventType : "orchestrator-job-repeat",
    jobID : number,
    jobDefinitionName : string
}

export type OrchestratorJobDefinitionInitialize = {
    eventType : "orchestrator-job-definition-initialize"
    jobDefinitionName : string
}

export type OrchestratorJobDefinitionHeartbeat = {
    eventType : "orchestrator-job-definition-heartbeat"
    jobDefinitionName : string
}

export type OrchestratorJobFinalizeFailureTimeout = {
    eventType : "orchestrator-job-finalize-failure-timeout"
    jobID : number
    jobDefinitionName : string
}

export type OrchestratorJobFinalizeFailureUnmetDependencies = {
    eventType : "orchestrator-job-finalize-failure-unmet-dependencies"
    jobID : number
    jobDefinitionName : string
}

export type OrchestratorJobFinalizeFailureNoAttemptsRemaining = {
    eventType : "orchestrator-job-finalize-failure-no-attempts-remaining",
    jobID : number
    jobDefinitionName: string
}

export type OrchestratorFinalizedJobSweep = {
    eventType : "orchestrator-finalized-job-sweep"
    jobID : number
    jobDefinitionName : string
}

export type OrchestratorStaleJobDefinitionSweep = {
    eventType : "orchestrator-stale-job-definition-sweep"
    jobDefinitionName : string
}

export type Event = 
    DaemonStart |
    DaemonStopSignalSend |
    DaemonStop |
    WorkerJobDequeue | 
    WorkerJobError |
    WorkerJobFinalizeSuccess |
    WorkerJobFinalizeFailureOrphaned |
    OrchestratorJobDefinitionInitialize |
    OrchestratorJobDefinitionHeartbeat |
    OrchestratorJobRepeat |
    OrchestratorJobFinalizeFailureTimeout |
    OrchestratorJobFinalizeFailureUnmetDependencies |
    OrchestratorJobFinalizeFailureNoAttemptsRemaining |
    OrchestratorFinalizedJobSweep |
    OrchestratorStaleJobDefinitionSweep