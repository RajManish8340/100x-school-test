import "ws"

declare module "ws" {
    export interface WebSocket {
        user?: {
            userId: string ,
            role : "student"|"teacher"
        }
    }
}