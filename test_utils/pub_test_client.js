const { MQZClient } = require('../mqz'),
    utils = require('side-flip/utils'),
    moment = require('moment'),
    _ = require('lodash');

class PubTestClient extends MQZClient {

    name = 'PubTestClient';

    received_messages = {};

    consume_action = 'none';

    consume_wait_time = 1000;

    constructor(options) {
        let consume = async (key, msg) => {
            if(options.log_override){
                options.log_override(key, msg);
            }else{
                console.log(moment().format('HH:mm:ss.SSS') + this.name + ' => ' + ': ' + options.service_name + " => consume: " + key, msg);
            }
            this.received_messages[key] = this.received_messages[key] || [];
            this.received_messages[key].push(msg);
            if(this.consume_action === 'throw'){
                throw new Error('consume_action: ' + this.consume_action);
            }else if(this.consume_action === 'wait'){
                await utils.wait(this.consume_wait_time);
            }
            if(options.on_message){
                options.on_message(key, msg);
            }
        }
        options.consumer = consume;
        options.internal_message_consumer = (data) => {
            consume('internal', data);
        }
        super(options);
        if(options.name){
            this.name = options.name;
        }
    }

    setConsumeAction = (action, wait_time = 1000) => {
        this.consume_action = action;
        this.consume_wait_time = wait_time;
    }

    clearReceivedMessages = () => {
        this.received_messages = {};
    }

    getReceivedMessages = (key) => {
        if(key){
            return this.received_messages[key] || [];
        }
        return this.received_messages;
    }

}

module.exports = PubTestClient;