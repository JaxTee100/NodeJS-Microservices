require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const helmet = require('helmet');
const {rateLimit} = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const logger = require('./utils/logger');
const proxy = require('express-http-proxy');
const errorHandler = require('./middleware/errorHandler');


const app = express();

const PORT = process.env.PORT || 3000;
const redisClient = new Redis(process.env.REDIS_URL);


app.use(helmet());
app.use(cors());
app.use(express.json());

//rate limiting

const rateLimiter = rateLimit({
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


app.use(rateLimiter);

app.use((req,res,next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    next();
});



const proxyOptions = {
    proxyReqPathResolver: (req) => {
      return req.originalUrl.replace(/^\/v1/, "/api");
    },
    proxyErrorHandler: (err, res, next) => {
      logger.error(`Proxy error: ${err.message}`);
      res.status(500).json({
        message: `Internal server error`,
        error: err.message,
      });
    },
  };


app.use((req, res, next) => {
    logger.info('Incoming Headers:', req.headers);
    next();
});



//setting of proxy for  our identity service
app.use(
    "/v1/auth",
    proxy(process.env.IDENTITY_SERVICE_URL, {
      ...proxyOptions,
      proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
        proxyReqOpts.headers["Content-Type"] = "application/json";
        return proxyReqOpts;
      },
      userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
        logger.info(
          `Response received from Identity service: ${proxyRes.statusCode}`
        );
  
        return proxyResData;
      },
    })
  );

//setting up proxy for our post service




app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway is running on port ${PORT}`);
    logger.info(`Identity Service  is running on port ${process.env.IDENTITY_SERVICE_URL}`);
    logger.info(`Redis Url ${process.env.REDIS_URL}`);


})