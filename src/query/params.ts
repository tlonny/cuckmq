import { ClientBase, Pool } from "pg";

export type QueryConfig = {
    handle: Pool | ClientBase,
    schema : string
}