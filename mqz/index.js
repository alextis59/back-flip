const utils = require('side-flip/utils'),
    logger = require('../log'),
    _ = require('lodash'),
    NatsClient = require('./nats'),
    { PublisherError } = require('../model/errors');

class MQZClient {

    service_id;

    service_name;

    url;

    internal_message_consumer;

    queues;

    service_queue = "MQZ";

    consumer;

    consumers = {};

    client;

    initialized = false;

    constructor(options = {}) {
        this.service_id = options.service_id || utils.getRandomHexString(16);
        this.service_name = options.service_name || 'unknown';
        this.url = options.url || '';
        this.internal_message_consumer = options.internal_message_consumer || null;
        this.queues = _.map(options.queues || [], (queue) => {
            return { name: queue };
        });
        this.service_queue = "MQZ";
        this.consumer = options.consumer || (() => {});
    }

    initialize = async () => {
        this.service_queue = "MQZ-" + this.service_name;
        this.queues.push({ name: this.service_queue, shared: true });
        this.queues = _.uniqBy(this.queues, 'name');
        let client_options = {
            service_id: this.service_id,
            service_name: this.service_name,
            url: this.url,
            queues: this.queues,
            consumer: this.natsConsumer
        };
        this.client = new NatsClient(client_options);
        try {
            await this.client.connect();
            this.initialized = true;
            if(!self.client){
                self.client = this;
            }
        } catch (err) {
            err = new PublisherError("initialize", err);
            throw err;
        }
    }

    checkConnection = async () => {
        try {
            await this.client.checkConnection();
        } catch (err) {
            err = new PublisherError("checkConnection", err);
            throw err;
        }
    }

    close = async () => {
        try {
            await this.client.close();
        } catch (err) {
            err = new PublisherError("close", err);
            throw err;
        }
    }

    publish = async (routingKey, data) => {
        try {
            await this.client.publish(routingKey, data);
        } catch (err) {
            err = new PublisherError("publish", err);
            throw err;
        }
    }

    publishInternalMessage = async (data) => {
        let msg = {
            type: "internal",
            service_id: this.service_id,
            data: data
        };
        await this.publish(this.service_queue, msg);    
    }

    natsConsumer = async (key, msg_str) => {
        let msg_json = JSON.parse(msg_str);
        try {
            logger.debug("Received message from NATS", { routingKey: key, json: msg_json });
            let result;
            if (key === this.service_queue) {
                result = this.onMqzMessage(msg_json);
            } else {
                result = await this.onMessage(key, msg_json);
            }
        } catch (err) {
            logger.error("Error processing NATS message", { error: err.message });
            err = new PublisherError("natsConsumer", err);
            throw err;
        }
    }

    subscribe = async (key, consumer = () => {}) => {
        if(!_.find(this.queues, { name: key })) {
            await this.client.subscribe(key);
            let queue = { name: key };
            this.queues.push(queue);
        }
        this.consumers[key] = this.consumers[key] || [];
        this.consumers[key].push(consumer);
    }

    onMqzMessage = (msg) => {
        let type = msg.type;
        if (type === "internal" && msg.service_id !== this.service_id && this.internal_message_consumer) {
            this.internal_message_consumer(msg.data);
        }
    }

    onMessage = async (key, msg) => {
        await this.consumer(key, msg);
        let consumers = this.consumers[key] || [];
        for (let consumer of consumers) {
            await consumer(key, msg);
        }
    }

}

const self = {

    MQZClient: MQZClient,

    initialize: async (options) => {
        let client = new MQZClient(options);
        client.initialize();
    },

    awaitClient: async (options = {}) => {
        let timeout = options.timeout || 5000,
            interval = options.wait_interval || 100;
        let start = new Date().getTime();
        while (!self.client || !self.client.initialized) {
            let now = new Date().getTime();
            if (now - start > timeout) {
                throw new PublisherError("awaitClient", new Error("Timeout"));
            }
            await utils.wait(interval);
        }
    },

    checkConnection: async (options) => {
        await self.awaitClient(options);
        await self.client.checkConnection();
    },

    publish: async (routingKey, data, options) => {
        await self.awaitClient(options);
        await self.client.publish(routingKey, data);
    },

    subscription_queue: {},

    subscribe: async (key, consumer, options) => {
        await self.awaitClient(options);
        await self.client.subscribe(key, consumer || (async () => {}));
    }

}

module.exports = self;