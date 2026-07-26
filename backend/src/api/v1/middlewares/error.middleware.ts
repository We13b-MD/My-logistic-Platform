import {Request, Response, NextFunction} from 'express'

export const errorHandler = (err:any, req:Request, res:Response, next:NextFunction) =>{
    console.error('[System Error]', err.stack || err);

    //Determine the status code 

    const statusCode = err.statusCode || 500; 
    
    res.status(statusCode).json({
        status: 'error',
        message: statusCode === 500 ? ' Internal server error' : err.message,
    })
}