const mqz = require('../mqz'),
    utils = require('side-flip/utils'),
    moment = require('moment'),
    _ = require('lodash');

module.exports = (options) => {

    let client_options = Object.assign({}, options);

    let received_messages = {};

    let consume_action = 'none';

    let consume_wait_time = 1000;

    async function consume(key, msg){
        if(options.log_override){
            options.log_override(key, msg);
        }else{
            console.log(moment().format('HH:mm:ss.SSS') + ': ' + options.service_name + " => consume: " + key, msg);
        }
        received_messages[key] = received_messages[key] || [];
        received_messages[key].push(msg);
        if(consume_action === 'throw'){
            throw new Error('consume_action: ' + consume_action);
        }else if(consume_action === 'wait'){
            await utils.wait(consume_wait_time);
        }
        if(options.on_message){
            options.on_message(key, msg);
        }
    }

    client_options.consumer = consume;
    client_options.internal_message_consumer = consume.bind(null, "internal");

    let self = mqz.getClient(client_options);

    self.setConsumeAction = (action, wait_time = 1000) => {
        consume_action = action;
        consume_wait_time = wait_time;
    };

    self.clearReceivedMessages = () => {
        received_messages = {};
    };

    self.getReceivedMessages = (key) => {
        if(key){
            return received_messages[key] || [];
        }
        return received_messages;
    };

    return self;

}