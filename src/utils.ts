import { Pool, PoolClient } from "pg"

type PromiseResolveFn = (arg?: any) => void
type TransactionCallback<T> = (client : PoolClient) => Promise<T>

export class Semaphore {
    private count : number
    private initialCount : number
    private queue : PromiseResolveFn[]

    constructor(count : number) {
        this.count = count
        this.initialCount = count
        this.queue = []
    }

    getInitialCount = () => {
        return this.initialCount
    }

    acquire = async () => {
        while(this.count === 0) {
            await new Promise(resolve => {
                this.queue.push(resolve)
            })
        }
        this.count -= 1
    }

    release = () => {
        this.count += 1
        if(this.queue.length > 0) {
            const resolve = this.queue.shift() as PromiseResolveFn
            resolve()
        }
    }
}

export class Timer {

    startMs : number
    intervalMs : number

    constructor(intervalMs : number) {
        this.intervalMs = intervalMs
        this.startMs = 0
    }

    hasElapsed = () : boolean => {
        return Date.now() - this.startMs >= this.intervalMs
    }

    reset = () => {
        this.startMs = Date.now()
    }

}

export const sleep = (ms : number) => new Promise(resolve => setTimeout(resolve, ms))

export const max = (num1 : number, num2 : number) => {
    return num1 > num2 ? num1 : num2
}

export const transaction = (pool : Pool) => async <T>(callback : TransactionCallback<T>) => {
    const client = await pool.connect()
    await client.query("BEGIN TRANSACTION")
    try {
        const result = await callback(client)
        await client.query("COMMIT TRANSACTION")
        return result
    } catch(err) {
        await client.query("ROLLBACK TRANSACTION")
        throw err
    } finally {
        await client.release()
    }
}