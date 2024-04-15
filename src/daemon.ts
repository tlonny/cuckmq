import { Event } from "./event"
import { sleep } from "./utils"

export type DaemonEventHandler = (params : {
    daemonID : number
    name : string
    event : Event,
    timestamp : Date
}) => void

export type StopCallback = () => void

let daemonID = 0
const snoozeMs = 50

export class Daemon {
    private shouldStop : boolean
    private runPromise : Promise<void> | null
    private name : string
    private daemonID : number
    private eventHandler? : DaemonEventHandler

    constructor(name : string, eventHandler? : DaemonEventHandler) {
        this.shouldStop = false
        this.runPromise = null
        this.name = name
        this.daemonID = daemonID
        this.eventHandler = eventHandler
        daemonID += 1

        this.onEvent({ eventType: "daemon-start" })
        this.runPromise = Promise.resolve()
            .then(() => this.run())
            .then(() => this.onEvent({ eventType: "daemon-stop" }))
    }

    protected getShouldStop() {
        return this.shouldStop
    }

    protected onEvent(event : Event) {
        if(this.eventHandler === undefined)  {
            return
        }

        this.eventHandler({
            daemonID: this.daemonID,
            name: this.name,
            event,
            timestamp: new Date()
        })
    }

    protected run() : Promise<void> {
        throw new Error("Not implemented")
    }

    protected async snooze() {
        await sleep(snoozeMs)
    }

    async join() {
        await this.runPromise
    }
    
    async setShouldStop() {
        this.shouldStop = true
        this.onEvent({ eventType: "daemon-stop-signal-send" })
    }
}
