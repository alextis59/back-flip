const utils = require('side-flip/utils'),
    logger = require('../log'),
    _ = require('lodash'),
    nats = require('./nats');

function getClient(options = {}) {

    const self = {

        service_id: options.service_id || utils.getRandomHexString(16),

        service_name: options.service_name || 'unknown',

        scaled_consuming: true,

        internal_message_consumer: options.internal_message_consumer || null,

        queues: _.map(options.queues || [], (queue) => {
            return { name: queue };
        }),

        service_queue: "MQZ",

        consumer: options.consumer || function () { },

        client: null,

        published_correlation_ids: {},

        initialize: async (cb = () => { }) => {
            self.scaled_consuming = options.scaled_consuming || false;
            self.service_queue = "MQZ-" + self.service_name;
            self.queues.push({ name: self.service_queue, shared: true });
            self.queues = _.uniqBy(self.queues, 'name');
            let client_options = {
                service_id: self.service_id,
                service_name: self.service_name,
                url: options.url || '',
                queues: self.queues,
                consumer: self.natsConsumer
            };
            self.client = nats.getClient(client_options);
            try {
                await self.client.connect();
                cb();
            } catch (err) {
                cb(err);
                throw err;
            }
        },

        checkConnection: async (cb = () => { }) => {
            try {
                await self.client.checkConnection();
                cb();
            } catch (err) {
                cb(err);
                throw err;
            }
        },

        close: async (cb = () => { }) => {
            try {
                await self.client.close();
                cb();
            } catch (err) {
                cb(err);
                throw err;
            }
        },

        publish: async (routingKey, data, cb = () => { }) => {
            try {
                await self.client.publish(routingKey, data);
                cb();
            } catch (err) {
                cb(err);
                throw err;
            }
        },

        publishInternalMessage: async (data, cb = () => { }) => {
            let msg = {
                type: "internal",
                service_id: self.service_id,
                data: data
            };
            await self.publish(self.service_queue, msg, cb);    
        },

        natsConsumer: async (key, msg_str) => {
            let msg_json = JSON.parse(msg_str);
            try {
                logger.debug("Received message from NATS", { routingKey: key, json: msg_json });
                let result;
                if (key === self.service_queue) {
                    result = self.onMqzMessage(msg_json);
                } else {
                    result = await self.consumer(key, msg_json);
                }
            } catch (err) {
                logger.error("Error processing NATS message", { error: err.message });
                throw err;
            }
        },

        onMqzMessage: (msg) => {
            let type = msg.type;
            if (type === "internal" && msg.service_id !== self.service_id && self.internal_message_consumer) {
                self.internal_message_consumer(msg.data);
            }
        }

    }

    return self;

}

const self = {

    getClient: getClient,

    initialize: async (options, cb) => {
        self.client = getClient(options);
        await self.client.initialize(cb);
    },

    checkConnection: async (cb = () => { }) => {
        if (self.client) {
            await self.client.checkConnection(cb);
        } else {
            let err = new Error("MQZ client not initialized");
            cb(err);
            throw err;
        }
    },

    publish: async (routingKey, data, cb = () => { }) => {
        if (self.client) {
            await self.client.publish(routingKey, data, cb);
        } else {
            let err = new Error("MQZ client not initialized");
            cb(err);
            throw err;
        }
    }

}

module.exports = self;