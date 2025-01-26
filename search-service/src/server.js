require('dotenv').config();
const express = require('express'); 
const mongoose = require('mongoose');
const redis = require('ioredis');
const cors = require('cors');
const helmet = require('helmet');
const searchRoutes = require('./routes/search-routes');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const {rateLimit} = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlePostCreated, postDeleted } = require('./eventHandlers/searchEventHandler');


const app = express();

const PORT = process.env.PORT || 3004


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


app.use('/api/search', searchRoutes);


app.use(errorHandler);


//implement redis cache and add rate limiting



async function startServer(){
    try {
        await connectToRabbitMQ();

        //consume the  post events or subscribe to the event
        await consumeEvent('post.created', handlePostCreated);

        //consume the delete event from the post service
        await consumeEvent('post.deleted', postDeleted);

        app.listen(PORT, () => {
            logger.info(`Search Service  running on port ${PORT}`);
        })
    } catch (error) {
        logger.error('failed to connect to server', error);
        process.exit(1)
    }
}

startServer();