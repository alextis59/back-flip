const utils = require('side-flip/utils'),
    logger = require('../log'),
    _ = require('lodash'),
    correlator = require("correlation-id"),
    correlator_tools = require('../correlator_tools'),
    nats = require('./nats');

const default_locker_options = {
    lock_ack_timeout: 500,
    default_timeout: 1000,
    request_queue: 'LOCK_REQUEST',
    release_queue: 'LOCK_RELEASE',
    ack_queue_prefix: 'LOCK_ACK_',
    grant_queue_prefix: 'LOCK_GRANT_'
}

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
                let current_id = correlator.getId();
                if (!current_id || self.published_correlation_ids[routingKey + current_id]) {
                    let info = current_id ? 'DUPLICATE_ID' : 'NO_ID';
                    await correlator_tools.newId('MQ.PUBLISH-' + info, true);
                }
                await self.setIdAndPublish(routingKey, data);
            } catch (err) {
                cb(err);
                throw err;
            }
        },

        setIdAndPublish: async (routingKey, data) => {
            let id = correlator.getId();
            self.published_correlation_ids[routingKey + id] = true;
            setTimeout(function () {
                delete self.published_correlation_ids[routingKey + id];
            }, 10000);
            data.correlationId = id;
            await self.client.publish(routingKey, data);
        },

        publishInternalMessage: async (data, cb = () => { }) => {
            let msg = {
                type: "internal",
                service_id: self.service_id,
                data: data
            };
            await self.client.publish(self.service_queue, msg, cb);
        },

        natsConsumer: async (key, msg_str) => {
            let msg_json = JSON.parse(msg_str);
            await new Promise((resolve, reject) => {
                correlator.withId(msg_json.correlationId, async () => {
                    try {
                        logger.debug("Received message from NATS", { routingKey: key, json: msg_json });
                        let result;
                        if (key === self.service_queue) {
                            result = self.onMqzMessage(msg_json);
                        } else {
                            result = await self.consumer(key, msg_json);
                        }
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                });
            });
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