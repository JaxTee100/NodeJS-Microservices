require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const logger = require('./utils/logger');
const proxy = require('express-http-proxy');
const errorHandler = require('./middleware/errorHandler');
const { validateToken } = require('./middleware/auth-middleware');


const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);


app.use(helmet());
app.use(cors());
app.use(express.json());

//rate limiting
const rateLimitter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,//maximum number of requests
    standardHeaders: true,//include headers in the response
    legacyHeaders: false, //i dont want to include legacy headers
    handler: (req, res) => {
        logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            message: 'Too many requests',
        });
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    })
});

app.use(rateLimitter);

app.use((req,res,next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
    next();
});



//create the proxy
//below is the options for the proxy to be created
const proxyOptions = {
    proxyReqPathResolver: (req) => {
        return req.originalUrl.replace(/^\/v1/, "/api");
    },
    proxyErrorHandler: (err, res, next) =>{
        logger.error(`Proxy error: ${err.message}`);
        res.status(500).json({
            message: `Internal server error coming from proxy block`,
            error: err.message,
        });
    }
}

//setting up of proxy for all authentication route

app.use('/v1/auth', proxy(
    process.env.IDENTITY_SERVICE_URL,
    {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            proxyReqOpts.headers["Content-Type"] = "application/json";
            return proxyReqOpts;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Identity Service: ${proxyRes.statusCode}`);
            return proxyResData;
        }
    }
) );

//setting up proxy for our post service
app.use('/v1/posts', validateToken, proxy(
    process.env.POST_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) =>{
            proxyReqOpts.headers['Content-type'] = 'application/json';
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
            return proxyReqOpts;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Post Service: ${proxyRes.statusCode}`);
            return proxyResData;
        }

    }
))


//proxy setup for media-service
app.use('/v1/media', validateToken, proxy(
    process.env.MEDIA_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) =>{
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
            if(!srcReq.headers["content-type"].startsWith("multipart/form-data")){
                proxyReqOpts.headers["Content-Type"] = "application/json";
            }
            return proxyReqOpts;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Media Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
        parseReqBody: false

    }
))

app.use('/v1/search', validateToken, proxy(
    process.env.SEARCH_SERVICE_URL, {
        ...proxyOptions,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) =>{
            proxyReqOpts.headers["Content-Type"] = "application/json";
            proxyReqOpts.headers['x-user-id'] = srcReq.user.userId;
                
            return proxyReqOpts;
        },
        userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
            logger.info(`Response received from Search Service: ${proxyRes.statusCode}`);
            return proxyResData;
        },
        parseReqBody: false

    }
))



app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway listening on port ${PORT}`);
    logger.info(`Identity service is running on port ${process.env.IDENTITY_SERVICE_URL}`);
    logger.info(`Post service is running on port ${process.env.POST_SERVICE_URL}`);
    logger.info(`Media service is running on port ${process.env.MEDIA_SERVICE_URL}`);
    logger.info(`Search service is running on port ${process.env.SEARCH_SERVICE_URL}`);

    logger.info(`Redis Url  ${process.env.REDIS_URL}`);
})
