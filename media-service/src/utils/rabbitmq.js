const amqp = require('amqplib')
const logger = require('./logger');




let connection = null;
let channel = null;

const EXCHANGE_NAME = 'facebook_events'


async function connectToRabbitMQ(){
    try {
        connection = await amqp.connect(process.env.RABBITMQ_URL);
        console.log(process.env.RABBITMQ_URL)
        channel=await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', {durable : false});
        logger.info(`connected to rabbitmq at ${process.env.RABBITMQ_URL}`);
        return channel;
    } catch (error) {
        logger.error(`Error connecting to rabbitmq ${process.env.RABBITMQ_URL}, error: ${error.message}`)
    }
}

async function publishEvent(routingKey, message){
    if(!channel){
        await connectToRabbitMQ();

    }
    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
    logger.info(`event published: ${routingKey}`)
}

async function consumeEvent(routingKey, callback){
    if(!channel){
        await connectToRabbitMQ();

    }

    const q = await channel.assertQueue("", {exclusive : true});
    await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);
    channel.consume(q.queue, (msg) => {
        if(msg!==null){
            const content = JSON.parse(msg.content.toString());
            callback(content);
            channel.ack(msg)
        }
    })
    logger.info(`subscribed to the event: ${routingKey}`)
}
module.exports = { connectToRabbitMQ, publishEvent, consumeEvent}