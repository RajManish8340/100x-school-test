
declare namespace Express {
    export interface Request {
        userId? : string,
        role? : "student" | "teacher",
    }
}
