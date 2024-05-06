const logger = require('../log'),
    _ = require('lodash'),
    utils = require('side-flip/utils'),
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

class NatsClient {

    service_id;

    service_name;

    url;

    queues;

    consumer;

    connecting = false;

    connecting_ts;

    connected = false;

    client;

    nc;

    jsm;

    js;

    locker_kv;

    initializeStreams = {};

    streams = [];

    constructor(options = {}) {
        this.service_id = options.service_id;
        this.service_name = options.service_name;
        this.url = options.url;
        this.queues = options.queues || [];
        this.consumer = options.consumer || (() => {});
    }

    connect = async () => {
        if (this.connected) {
            return;
        }
        while (this.connecting) {
            await utils.wait(100);
        }
        this.connecting = true;

        try {
            await Promise.race([
                this.connectNats(),
                utils.timeout(CONNECTION_TIMEOUT)
            ]);
            logger.info("-> nats.connection: connection established");
            this.connected = true;
            this.connecting = false;
            this.handleDisconnect();
        } catch (e) {
            logger.error("-> nats.connection: connection error");
            logger.error(e.message);
            this.connecting = false;
            await utils.wait(RECONNECT_WAIT_TIME);
            return this.connect();
        }
    }

    handleDisconnect = async () => {
        try {
            let err = await this.nc.closed();
            this.onDisconnect(err);
        }catch(err){
            logger.error("Error handling NATS disconnect:", err);
        }
    }

    connectNats = async () => {
        this.nc = await nats.connect({ servers: this.url });
        this.jsm = await this.nc.jetstreamManager();
        this.js = await this.nc.jetstream();
        this.locker_kv = await this.js.views.kv("lock", { history: 1 });
        for (let queue of this.queues) {
            await this.subscribe(queue.name, queue.shared);
        }
    }

    checkConnection = async () => {
        if (this.connected) {
            // Check if NATS connection is active
            if (!this.nc || this.nc.isClosed()) {
                throw new Error('NATS connection is closed.');
            }
            // Ping the NATS server to ensure it's responsive
            await this.nc.flush();
            // Checking each stream status
            for(let stream of this.streams){
                await this.jsm.streams.info(stream);
            }
        } else {
            let error = new Error("MQZ Client not connected");
            throw error;
        }
    }

    onDisconnect = async (err) => {
        this.connected = false;
        if (err) {
            logger.error("-> nats.connection: closed event received");
            logger.error(err.message);
            await utils.wait(RECONNECT_WAIT_TIME);
            this.connect();
        } else {
            logger.info("-> nats.connection: manual closed event received");
        }
    }

    initializeStream = async (name, options = {}) => {
        while (this.initializeStreams[name]) {
            await utils.wait(50);
        }
        if (this.streams.indexOf(name) !== -1) {
            return;
        }
        this.initializeStreams[name] = true;
        let stream = _.cloneDeep(DEFAULT_STREAM_CONFIG);
        stream.name = name;
        stream.subjects = [name];
        Object.assign(stream, options);
        try {
            await this.jsm.streams.add(stream);
        } catch (e) {
            if (e.message === 'stream name already in use with a different configuration') {
                await this.jsm.streams.update(name, stream);
            } else {
                throw e;
            }
        }
        logger.info("-> nats.connection: stream initialized", { stream: stream.name });
        this.streams.push(name);
        this.initializeStreams[name] = false;
    }

    purgeStreams = async () => {
        for (let stream of this.streams) {
            await this.jsm.streams.purge(stream);
        }
    }

    subscribe = async (queue, shared) => {
        let c,
            consumer_name = shared ? this.service_id : this.service_name,
            consumer_options = {
                ...DEFAULT_CONSUMER_OPTIONS,
                durable_name: consumer_name
            };
        try {
            await this.initializeStream(queue);
            await this.jsm.consumers.update(queue, consumer_name, consumer_options);
            c = await this.js.consumers.get(queue, consumer_name);
        } catch (e) {
            if (e.message === 'consumer not found') {
                await this.jsm.consumers.add(queue, consumer_options);
                c = await this.js.consumers.get(queue, consumer_name);
            } else {
                throw e;
            }
        }
        this.loopConsumer(queue, c);
    }

    loopConsumer = async (queue, c) => {
        const messages = await c.consume();
        for await (const m of messages) {
            try {
                await this.consumer(queue, sc.decode(m.data));
                m.ack();
            } catch (e) {
                logger.error("-> nats.connection: consumer error", { error: e.message });
                //console.log(e);
                m.nak();
            }
        }
    }

    publish = async (queue, data) => {
        logger.debug("nats.publish", { queue, data });
        await this.connect();
        await this.initializeStream(queue);
        let message = sc.encode(JSON.stringify(data));
        await this.js.publish(queue, message);
    }

    close = async () => {
        if (this.nc) {
            await this.nc.close();
        }
    }

    printInfo = async () => {
        logger.debug('NATS Streams:');
        const streams = await this.jsm.streams.list().next();
        streams.forEach((si) => {
            logger.debug(si);
        });
    }

}

module.exports = NatsClient;
