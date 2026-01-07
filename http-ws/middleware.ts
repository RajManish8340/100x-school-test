import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from 'jsonwebtoken'

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {

    const token = req.headers.authorization ;

    if(!token) {
        res.status(401).json({
            "success": false,
            "error": "Unauthorized, token missing or invalid"
        })

        return
    }
    try {
        const {role ,userId} = jwt.verify(token, process.env.JWT_PASSWORD!) as JwtPayload ;
        req.role = role ;
        req.userId = userId;
        next();
    } catch (e) {
        res.status(401).json({
            "success": false,
            "error": "Unauthorized, token missing or invalid"
        })
    }
}

export const teacherMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if(!req.role || req.role != "teacher") {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, teacher access required"
        })
        return
    }
    next();
}
