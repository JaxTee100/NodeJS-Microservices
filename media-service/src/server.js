require('dotenv').config()
const express = require('express');
const mongoose = require('mongoose');
const redis = require('ioredis');
const cors = require('cors');
const helmet = require('helmet');
const mediaRoutes = require('./routes/media-routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const {rateLimit} = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlePostDeleted } = require('./eventHandlers/media-event-handlers');



const app = express();

const PORT = process.env.PORT || 3003;

mongoose.connect(process.env.MONGO_URL)
.then(() => logger.info('connected to mongodb'))
.catch((error) => logger.error('error connecting to mongodb', error));



//redis client
const redisClient = new redis(process.env.REDIS_URL);


//middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req,res,next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
    next();
});



const rateLimitter = rateLimit({
    windowMs: 1 * 60 * 1000, // 15 minutes
    max: 10,//maximum number of requests
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


app.use('/api/media', mediaRoutes);


app.use(errorHandler);

async function startServer(){
    try {
        await connectToRabbitMQ();

        //consume all the events

        await consumeEvent('post.deleted', handlePostDeleted)
        app.listen(PORT, () => {
            logger.info(`Media Service  running on port ${PORT}`);
        })
    } catch (error) {
        logger.error('failed to connect to server', error);
        process.exit(1)
    }
}

startServer();