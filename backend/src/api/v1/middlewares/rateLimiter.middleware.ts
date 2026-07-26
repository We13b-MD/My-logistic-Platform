import rateLimit, {ipKeyGenerator} from "express-rate-limit";
import { Request } from "express";
const userKeyGenerator = (req: Request) => {
    return (req as any).user?.id || ipKeyGenerator(req.ip ?? '');
}


//   1: LOGIN LIMITER (5 reuests per minute per IP/account)

export const loginLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max:5,
    message:{
        status:'error',
        message:'Too many login attemps. Please try again in a minute'
    },
    standardHeaders:true,
    legacyHeaders:false,
});

//Register limiter(5requests per minute)

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message:{
        status:'error',
        message:'Too many accounts created from this IP. please try again in an hour'
    },
    standardHeaders:true,
    legacyHeaders:false,
})

//Password reset limiter(3 requests per hour Ip)

export const passwordResetLimiter = rateLimit({
    windowMs:60 * 60 * 1000,  //1 hour
    max:3,
    message:{
        status:'error',
        message:'Too many password reset requests.Please try again in an hour',
    },
    standardHeaders:true,
    legacyHeaders:false,
});

//General Api limiter(100 requests per minute)

export const generalApiLimiter = rateLimit({
    windowMs:60 * 1000,
    max:100,
    keyGenerator :userKeyGenerator,
    //Limits by user Id, not just Ip
    message:{
        status:'error',
        message:'Rte limit exceeded (100 req/min). Please slow down'
    },
    standardHeaders:true,
    legacyHeaders:false,

})


//5.  DASHBOARD/API LIMITER (300 requests per minute per authenticated user)

export const dashboardReadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max:300,
    keyGenerator:userKeyGenerator,
    message:{
        status:'error',
        message:'Dahboard rate limit exceeded(300 req/min).'
    },
    standardHeaders:true,
    legacyHeaders:false,
})

//6 Vehicle location updates (120 requests per minute)

export const vehicleLocationLimiter = rateLimit({
    windowMs: 60* 1000,
    max:120, // two request per second average
    keyGenerator:userKeyGenerator,
    //limits by driver userId
    message:{
        status:'error',
        message:'Location transmission throttled.  Frequency too high.'
    },
    standardHeaders:true,
    legacyHeaders:false,
})

//7 webhooks limiter(100 requests per minute) (100 requests per minute for trusted systems)


export const webHookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max:1000,
    message:{
        status:'error',
        message:'webhook rate limit exceeded.'
    },
    standardHeaders:true,
    legacyHeaders:false,
})





