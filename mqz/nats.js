const logger = require('../log'),
    _ = require('lodash'),
    utils = require('../utils'),
    nats = require('nats');

const RECONNECT_WAIT_TIME = 500;

const CONNECTION_TIMEOUT = 10000;

const DEFAULT_STREAM_CONFIG = {
    max_age: nats.nanos(10 * 1000), // 10 seconds
    duplicate_window: 0
}

const DEFAULT_CONSUMER_OPTIONS = {
    ack_policy: nats.AckPolicy.Explicit,
    ack_wait: nats.nanos(2.5 * 1000), // 2 seconds,
    max_deliver: 2
}

const sc = nats.StringCodec();

function getClient(options){

    const self = {

        service_id: options.service_id,

        service_name: options.service_name,

        url: options.url,

        queues: options.queues || [],

        consumer: options.consumer || function () { },

        connecting: false,

        connecting_ts: null,

        connected: false,

        client: null,

        nc: null,

        initializing_streams: {},

        streams: [],

        connect: async () => {
            if (self.connected) {
                return;
            }
            while (self.connecting) {
                await utils.wait(100);
            }
            self.connecting = true;

            try {
                await Promise.race([
                    self.connectNats(),
                    utils.timeout(CONNECTION_TIMEOUT)
                ]);
                logger.info("-> nats.connection: connection established");
                self.connected = true;
                self.connecting = false;
                self.handleDisconnect();
            } catch (e) {
                logger.error("-> nats.connection: connection error");
                logger.error(e.message);
                console.log(e);
                self.connecting = false;
                await utils.wait(RECONNECT_WAIT_TIME);
                return self.connect();
            }
        },

        handleDisconnect: () => {
            self.nc.closed()
                .then((err) => {
                    self.onDisconnect(err);
                })
                .catch((error) => {
                    logger.error("Error handling NATS disconnect:", error);
                });
        },

        connectNats: async () => {
            self.nc = await nats.connect({ servers: self.url });
            self.jsm = await self.nc.jetstreamManager();
            self.js = await self.nc.jetstream();
            self.locker_kv = await self.js.views.kv("lock", { history: 1 });
            for (let queue of self.queues) {
                await self.subscribe(queue.name, queue.shared);
            }
        },

        checkConnection: async () => {
            if (self.connected) {
                // Check if NATS connection is active
                if (!self.nc || self.nc.isClosed()) {
                    throw new Error('NATS connection is closed.');
                }
                // Ping the NATS server to ensure it's responsive
                await self.nc.flush();
                // Checking each stream status
                for(let stream of self.streams){
                    await self.jsm.streams.info(stream);
                }
            } else {
                let error = new Error("MQZ Client not connected");
                throw error;
            }
        },

        onDisconnect: async (err) => {
            self.connected = false;
            if (err) {
                logger.error("-> nats.connection: closed event received");
                logger.error(err.message);
                await utils.wait(RECONNECT_WAIT_TIME);
                self.connect();
            } else {
                logger.info("-> nats.connection: manual closed event received");
            }
        },

        initializeStream: async (name, options = {}) => {
            while (self.initializing_streams[name]) {
                await utils.wait(50);
            }
            if (self.streams.indexOf(name) !== -1) {
                return;
            }
            self.initializing_streams[name] = true;
            let stream = _.cloneDeep(DEFAULT_STREAM_CONFIG);
            stream.name = name;
            stream.subjects = [name];
            Object.assign(stream, options);
            try {
                await self.jsm.streams.add(stream);
            } catch (e) {
                if (e.message === 'stream name already in use with a different configuration') {
                    await self.jsm.streams.update(name, stream);
                } else {
                    throw e;
                }
            }
            logger.info("-> nats.connection: stream initialized", { stream: stream.name });
            self.streams.push(name);
            self.initializing_streams[name] = false;
        },

        purgeStreams: async () => {
            for (let stream of self.streams) {
                await self.jsm.streams.purge(stream);
            }
        },

        subscribe: async (queue, shared) => {
            let c,
                consumer_name = shared ? self.service_id : self.service_name,
                consumer_options = {
                    ...DEFAULT_CONSUMER_OPTIONS,
                    durable_name: consumer_name
                };
            try {
                await self.initializeStream(queue);
                await self.jsm.consumers.update(queue, consumer_name, consumer_options);
                c = await self.js.consumers.get(queue, consumer_name);
            } catch (e) {
                if (e.message === 'consumer not found') {
                    await self.jsm.consumers.add(queue, consumer_options);
                    c = await self.js.consumers.get(queue, consumer_name);
                } else {
                    throw e;
                }
            }
            self.loopConsumer(queue, c);
        },

        loopConsumer: async (queue, c) => {
            const messages = await c.consume();
            for await (const m of messages) {
                try {
                    await self.consumer(queue, sc.decode(m.data));
                    m.ack();
                } catch (e) {
                    logger.error("-> nats.connection: consumer error", { error: e.message });
                    //console.log(e);
                    m.nak();
                }
            }
        },

        publish: async (queue, data) => {
            logger.debug("nats.publish", { queue, data });
            await self.connect();
            await self.initializeStream(queue);
            let message = sc.encode(JSON.stringify(data));
            await self.js.publish(queue, message);
        },

        close: async () => {
            if (self.nc) {
                await self.nc.close();
            }
        },

        printInfo: async () => {
            logger.debug('NATS Streams:');
            const streams = await self.jsm.streams.list().next();
            streams.forEach((si) => {
                logger.debug(si);
            });
        }
    }

    return self;
}

module.exports = {

    getClient

}
