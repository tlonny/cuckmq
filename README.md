<div align="center">
    <img src="logo.png">
</div>

A lightweight, configurable job-queue backed by postgresql, offering an alternative to the redis-backed `bullmq`.

### Core Features:

  - built-in type safety.
  - repeating/scheduled jobs.
  - rate-limited jobs.
  - job dependencies.
  - delayed jobs.
  - retryable jobs.
  - self cleaning. 

## Installation

Install the package with:

```bash
yarn add cuckmq
```

N.B. `pg` is a peer dependency:

```bash
yarn add pg
```

## Usage

To start, we must first create a `Config` object. This contains a mapping of all jobs, a reference to a `pg` connection pool and the name of the schema in which `cuckmq` will work...

```typescript
import { Pool } from "pg"
import { Config } from "cuckmq"

const pool : Pool = getPool()
const config : Config = new Config({ pool })
```

Next, we must ensure that `cuckmq` has the requisite database tables to persist and mutate jobs. This can be done by calling the idempotent function:

```typescript
await config.prepareSchema()
```

### Deferring Jobs

Now lets define our jobs:

```typescript
import { JobDefinition } from "cuckmq"

export const pingJob = new JobDefinition({
    config: config,
    name : "ping",
    jobFunction: async (payload : { message : string }) => {
        console.log(payload.message)
    }
})
```
To add jobs to the job queue, we simply call:

```typescript
await pingJob.defer({ payload: { message: "Hello, World!" }})
```

### Running Jobs

We must instantiate "daemons" in order to ensure oustanding jobs are processed. N.B. make sure job definitions are "registered" by calling `#register()` on each `JobDefinition` prior to constructing any daemons.

```typescript
import { Worker, Orchestrator } from "cuckmq"
import process from "process"
import { pingJob } from "./jobs"

pingJob.register()

// Create Worker daemon(s) and an Orchestrator daemon
// N.B. Daemons will start automatically once created.
const daemons = [
    new Worker({config}),
    new Orchestrator({config})
]

// Request all daemons to gracefully shutdown on SIGINT signal
process.on("SIGINT", () => {
    daemons.forEach(d => d.setShouldStop())
})

// Wait until all daemons have gracefully shutdown.
await Promise.all(daemons.map(d => d.join()))
```

### Repeatable Jobs

`cuckmq` supports repeatable jobs. They can be trivially defined by adding the `repeatIntervalMs` property to job definitions:

```typescript
import { JobDefinition } from "cuckmq"

export const pingScheduledJob = new JobDefinition({
    config: config,
    name : "ping-scheduled",
    repeatIntervalMs: 60_000, // Run every minute
    jobFunction: async (params : {}) => {
        await pingJob.defer({ message : "Scheduled Hello, World!" })
    }
})
```

N.B. you are only able to specify a repeatable job/`repeatIntervalMs` if the type of `params` in the job function is an empty object.

### Advanced Usage

`cuckmq` classes are packed full of various configuration options, these are detailed below:

#### **Config#constructor**

| Parameter | Type | Is Required | Default Value | Description |
| --------- | ---- | ----------- | ------------- | ----------- |
| `pool` | `pg.Pool` | yes | N/A | a `pg` connection pool |
| `schema` | `string` | no | `_cuckmq` | the DB schema under which the database tables are created |


#### **JobDefinition#constructor**

| Parameter | Type | Is Required | Default Value | Description |
| --------- | ---- | ----------- | ------------- | ----------- |
| `config` | `cuckmq.Config` | yes | N/A | the instantiated `cuckmq` config object |
| `name` | `string` | yes | N/A | a unique name for the job definition |
| `channel` | `string` | no | `_default` | an attribute that jobs are tagged with that workers can filter on |
| `numAttempts` | `number` | no | `0` | the number of times a job can be attempted after erroring before being finalized |
| `repeatIntervalMs` | `number` | no | `null` | If defined, the interval between jobs being automatically scheduled |
| `releaseIntervalMs` | `number` | no | `0` | This defines the minimum amount of time that must elapse between jobs being released from the queue. Use this to perform rate limiting for certain jobs.
| `timeoutIntervalMs` | `number` | no | `12 * 60 * 60_000` | This defines the maximum amount of time that a job can exist before it "times out", resulting in the job being "finalized".
| `lockIntervalMs` | `number` | no | `60_000` | The amount of time after a job is dequeued that it remains unavailable to other workers to consume. Ensure this value is larger than the longest possible runtime of your job |
| `jobFunction` | `<T extends object> (T) => Promise<void>` | yes | N/A | The definition of the function to process/perform the job |

#### **Worker#constructor**

| Parameter | Type | Is Required | Default Value | Description |
| --------- | ---- | ----------- | ------------- | ----------- |
| `config` | `cuckmq.Config` | yes | N/A | the instantiated `cuckmq` config object |
| `name` | `string` | no | `anon` | A nickname for your worker daemon |
| `channel` | `string` | no | `_default` | an attribute that jobs are tagged with that workers can filter on |
| `concurrency` | `number` | no | `0` | The number of jobs that a worker can process concurrently |
| `processIntervalMs` | `number` | no | `1000` | The amount of time a worker will sleep after failing to dequeue a job before trying again |
| `eventHandler` | `EventHandler` | no | N/A | A handler to listen to events emitted by the worker |

#### **Orchestrator#constructor**

| Parameter | Type | Is Required | Default Value | Description |
| --------- | ---- | ----------- | ------------- | ----------- |
| `config` | `cuckmq.Config` | yes | N/A | the instantiated `cuckmq` config object |
| `name` | `string` | no | `anon` | A nickname for your scheduler daemon |
| `repeatIntervalMs` | `number` | no | `30_000` | The amount of time the orchestrator will wait after not finding a repeatable job to schedule before trying again |
| `heartbeatIntervalMs` | `number` | no | `60_000` | The amount of time the orchestrator will wait between updating the `heartbeat` state of all registered `JobDefinitions`. |
| `cleanIntervalMs` | `number` | no | `5 * 60_000` | The amount of time the orchestrator will wait between performing a database clean |
| `staleJobDefinitionSweepThresholdMs` | `number` | no | `60_000 * 60` | The maximum amount of time after the last "heartbeat" before the orchestrator considers a job definition as stale and tries to remove it |
| `finalizedJobSweepThresholdMs` | `number` | no | `12 * 60 * 60_000` | The maximum amount of time a finalized job will exist before the orchestrator attempts to remove it |
| `eventHandler` | `EventHandler` | no | N/A | A handler to listen to events emitted by the scheduler |


#### **Events**

All daemons can accept an `eventHandler` which will receive emitted events. The type of the `eventHandler` is:

```typescript
(params : {
    daemonID : number, // A unique daemon ID
    name: string, // The name of the daemon
    event : Event,
    timestamp : Date
}) => void
```

`Event` is a union type, with the field: `eventType` used to differentiate them. The members of the union type are enumerated below:

| Type | Event Type Field | Event |
| ---- | ---------------- | ----------- |
| `DaemonStart` | `daemon-start` | The daemon starts (via `.start()`)
| `DaemonStopSignalSend` | `daemon-stop-signal-send` | The daemon receives the signal to stop (via `.stop()). N.B. the daemon may continue running beyond this point to facilitate a graceful shutdown |
| `DaemonStop` | `daemon-stop` | The daemon stops |
| `WorkerJobDequeue` | `worker-job-dequeue` | A worker daemon pulls a job from the database for processing |
| `WorkerJobFinalizeSuccess` | `worker-job-finalize-success` | A job has been successfully run by the worker |
| `WorkerJobFinalizeFailureOrphaned` | `worker-job-finalize-failure-orphaned` | A job has been finalized because the worker is unable to find an associated `JobDefinition` |
| `WorkerJobError` | `worker-job-error` | A job that a worker tried to run has thrown an error |
| `OrchestratorJobSchedule` | `orchestrator-job-schedule` | The orchestrator has enqueued a scheduled/periodic job to be run |
| `OrchestratorHeartbeat` | `orchestrator-heartbeat` | The orchestrator has updated the heartbeat of at least one scheduled job |






