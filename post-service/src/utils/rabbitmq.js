const amqp = require('amqplib');
const logger = require('./logger');

let connection = null;
let channel = null;

const EXCHANGE_NAME = 'facebook_events'


async function connectToRabbitMQ(){
    try {
        connection = await amqp.connect(process.env.RABBITMQ_UR);
        channel=await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', {durable : false});
        logger.info('Connected to rabbitmq');
        return channel;
    } catch (error) {
        logger.error('Error connecting to rabbitmq')
    }
}

async function publishEvent(routingKey, message){
    if(!channel){
        await connectToRabbitMQ();

    }
    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
    logger.info(`event published: ${routingKey}`)
}

module.exports = { connectToRabbitMQ, publishEvent}