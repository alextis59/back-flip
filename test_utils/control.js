const db = require('../db'),
    utils = require('side-flip/utils'),
    PubTestClient = require('./pub_test_client'),
    _ = require('lodash'),
    { ObjectId } = require('mongodb');

const self = {

    pub_client: null,

    initPubClient: async (options) => {
        self.pub_client = new PubTestClient(options);
        await self.pub_client.initialize();
    },

    setPubClient: (client) => {
        self.pub_client = client;
    },

    clearReceivedMessages: () => {
        if(self.pub_client && self.pub_client.clearReceivedMessages){
            self.pub_client.clearReceivedMessages();
        }
    },

    getMatchingPubMessages: (key, expect, client) => {
        client = client || self.pub_client;
        if(!client){
            throw new Error('No client provided for pub message check');
        }
        let messages = client.getReceivedMessages(key),
            match_list = [];
        for (let message of messages) {
            let is_match = true;
            if(expect.properties && !utils.objectMatchQuery(message, expect.properties)){
                is_match = false;
            }
            if (is_match) {
                match_list.push(message);
            }
        }
        return match_list;
    },

    checkPubMessageReceived: async (key, expect, options = { max_retry_count: 5, retry_wait_time: 200, debug: false }) => {
        let client = options.client || self.pub_client;
        if(!client){
            throw new Error('No client provided for pub message check');
        }
        if (options.wait_time) {
            await utils.wait(options.wait_time);
        }
        let try_count = 0,
            max_retry_count = options.max_retry_count || 1,
            retry_wait_time = options.retry_wait_time || 200;
        while (try_count < max_retry_count) {
            let match_list = self.getMatchingPubMessages(key, expect, client);
            if (match_list.length === 0 && expect.match_count === 0) {
                return;
            }
            if (match_list.length > 0) {
                if (expect.match_count === undefined || expect.match_count === match_list.length) {
                    return;
                }
            }
            try_count++;
            if (try_count < max_retry_count) {
                await utils.wait(retry_wait_time);
            }
        }
        if(options.debug){
            console.log('TEST : Error on pub message check : ' + JSON.stringify(client.getReceivedMessages(key), null, 2) + ' VS ' + JSON.stringify(expect, null, 2));
        }else{
            console.log('TEST : Error on pub message check, expected: ' + JSON.stringify(expect, null, 2));
        }
        throw new Error('Error on pub message check');
    },

    checkDbEntity: async (entity_name, entity_id_or_query, expect, options = {}) => {
        expect = expect || {};
        let query = entity_id_or_query;
        if(typeof entity_id_or_query == 'string'){
            query = {_id: new ObjectId(entity_id_or_query)};
        }else if(entity_id_or_query._bsontype && entity_id_or_query._bsontype == 'ObjectId'){
            query = {_id: entity_id_or_query};
        }
        let on_error = async (err) => {
            let retry = false,
                current_try_count = options.try_count || 0;
            if(options.retry_count && current_try_count < options.retry_count){
                retry = true;
            }
            if(retry){
                let wait_time = options.retry_wait_time || 100;
                await utils.wait(wait_time);
                return await self.checkDbEntity(entity_name, entity_id_or_query, expect, Object.assign(options || {}, {try_count: current_try_count + 1}));
            }else{
                throw err;
            }
        }
        let entity = await db.findEntityFromQuery(entity_name, query);
        if(!entity){
            if(expect.not_present){
                return;
            }else{
                console.log("checkDbEntity: Error entity not present in db");
                return await on_error(new Error("Entity not present in db"));
            }
        }else{
            if(expect.not_present){
                return await on_error(new Error("Entity present in db"));
            }
            if(expect.properties && !utils.objectMatchQuery(entity, expect.properties)){
                return await on_error(new Error("Error while checking entity properties : expected " + JSON.stringify(expect.properties, null, 2) + " vs " + JSON.stringify(entity, null, 2)));
            }
            return entity;
        }
    }

}

module.exports = self;
