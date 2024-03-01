let logger = require('../log'),
    utils = require('../utils');

const DEBUG = process.env.DEBUG_LOCKER === 'true';

function debug(msg, json){
    if(DEBUG){
        logger.debug(msg, json);
    }
}

module.exports = (mqz, locker_options = {}) => {

    let self = {

        lockerAckMessage: (msg) => {
            debug('MQZ - Locker : ACK received', {msg: msg});
            let promise = waiting_ack[msg.lock_id];
            if(promise){
                promise();
                delete waiting_ack[msg.lock_id];
            }
        },

        lockerGrantMessage: (msg) => {
            debug('MQZ - Locker : GRANT received', {msg: msg});
            let promise = waiting_grant[msg.lock_id];
            if(promise){
                promise();
                delete waiting_grant[msg.lock_id];
            }
        },

        waitForUnlock: async (key, options = {}) => {
            debug('MQZ - Locker : Wait for unlock request', {key: key, options: options});
            let lock = {
                key: key,
                lock_id: utils.getRandomHexString(16),
                service_id: mqz.service_id,
                service_name: mqz.service_name,
                max_duration: (options.max_duration || locker_options.default_timeout)
            }
            await waitForUnlock(lock);
            debug('MQZ - Locker : key unlocked', {lock: lock});
            let unlock = getUnlocker(lock);
            return unlock;
        },

        getLocker: () => {

            return {

                waitForUnlock: self.waitForUnlock

            }

        }

    };

    async function publish(routingKey, data) {
        return await mqz.publish(routingKey, data);
    }

    let waiting_ack = {}, waiting_grant = {};

    async function waitForUnlock(lock){
        debug('MQZ - Locker : Waiting for unlock', {lock: lock});
        let lockAcked = waitForLockAck(lock),
            lockGranted = waitForLockGrant(lock);
        const err = await requestLock(lock);
        if(err){
            logger.error('Error while requesting lock, starting processing right away', {err: err.message})
            return;
        }
        try{
            await Promise.race([
                utils.timeout(locker_options.lock_ack_timeout),
                lockAcked
            ])
            debug('MQZ - Locker : Lock ack received', {lock: lock});
        }catch(err){
            logger.error('Timeout while waiting for lock ack, starting processing right away', {err: err.message});
            delete waiting_ack[lock.lock_id];
            delete waiting_grant[lock.lock_id];
            return;
        }
        try{
            await Promise.race([
                utils.timeout(lock.max_duration),
                lockGranted
            ])
            debug('MQZ - Locker : Lock granted', {lock: lock});
        }catch(err){
            logger.error('Timeout while waiting for lock grant, starting processing right away', {err: err.message});
            delete waiting_grant[lock.lock_id];
        }
        return;
    }

    async function waitForLockAck(lock){
        let promise = new Promise((resolve, reject) => {
            waiting_ack[lock.lock_id] = resolve;
        });
        return promise;
    }

    async function waitForLockGrant(lock){
        let promise = new Promise((resolve, reject) => {
            waiting_grant[lock.lock_id] = resolve;
        });
        return promise;
    }

    async function requestLock(lock){
        return await publish(locker_options.request_queue, lock);
    }

    async function releaseLock(lock){
        return await publish(locker_options.release_queue, lock);
    }

    function getUnlocker(lock) {
        let lock_timeout = setTimeout(() => {
            logger.error('MQZ - Locker : ERROR ==> unlock timeout : ' + lock.key + '=' + lock.lock_id);
            releaseLock(lock);
        }, lock.max_duration),
            unlocker = () => {
                clearTimeout(lock_timeout);
                releaseLock(lock);
            };
        return unlocker;
    }

    return self;

}