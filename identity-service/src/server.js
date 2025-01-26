require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express'); 
const logger = require('./utils/logger');
const helmet = require('helmet');
const cors = require('cors');
const {RateLimiterRedis} = require('rate-limiter-flexible');
const Redis = require('ioredis');
const {rateLimit} = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const router = require('./routes/identity-service');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;


//connect to database

mongoose.connect(process.env.MONGO_URL)
.then(() => logger.info('connected to mongodb'))
.catch((error) => logger.error('error connecting to mongodb', error));

//redis client
const redisClient = new Redis(process.env.REDIS_URL);




//middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req,res,next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
    next();
});


//DDOS protection and rate limiting

const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'middleware',
    points: 10, // 10 requests
    duration: 1, // per 1 second by IP
})

app.use((req, res, next) => {
    rateLimiter.consume(req.ip)
    .then(() => {
        logger.warn(`Rate limit for ${req.ip}`);
        next();
    })
    .catch(() => {
        res.status(429).json({
            message: 'Too many requests',
        });
    });
})



//Ip based rate limiting for sensitive endpoints
const sensitiveEndpoints = rateLimit({
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


//apply rate limiting to sensitive endpoints
app.use('/api/auth/register', sensitiveEndpoints);

//Routes
app.use('/api/auth', router)


//error handling
app.use(errorHandler);


//start server
app.listen(PORT, () => {
    logger.info(`Identity Service  running on port ${PORT}`);
})

//unhandle promise rejections

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);

})