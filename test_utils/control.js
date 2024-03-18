const db = require('../db'),
    utils = require('side-flip/utils'),
    _ = require('lodash'),
    ObjectId = db.ObjectId;

const self = {

    getMatchingPubMessages: (client, key, expect) => {
        let messages = client.getReceivedMessages(key),
            match_list = [];
        for (let message of messages) {
            let is_match = true;
            if (expect.properties && !self.checkObjectProperties(message, expect.properties)) {
                is_match = false;
            }
            if (is_match) {
                match_list.push(message);
            }
        }
        return match_list;
    },

    checkPubMessageReceived: async (client, key, expect, options = { max_retry_count: 5, retry_wait_time: 200 }) => {
        if (options.wait_time) {
            await utils.wait(options.wait_time);
        }
        let try_count = 0,
            max_retry_count = options.max_retry_count || 1,
            retry_wait_time = options.retry_wait_time || 200;
        while (try_count < max_retry_count) {
            let match_list = self.getMatchingPubMessages(client, key, expect);
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
        console.log('TEST : Error on pub message check : ' + JSON.stringify(client.getReceivedMessages(key), null, 2) + ' VS ' + JSON.stringify(expect, null, 2));
        console.log(JSON.stringify(client.getReceivedMessages(), null, 2));
        throw new Error('Error on pub message check');
    },

    clearObjectProps: (obj, props) => {
        for(let prop of props){
            delete obj[prop];
        }
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
                return await self.checkDbEntity(entity_name, entity_id_or_query, expect, Object.assign({try_count: current_try_count + 1}, options || {}));
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
            let check_entity = entity;
            if(expect.ignore_props){
                check_entity = _.cloneDeep(entity);
                self.clearObjectProps(check_entity, expect.ignore_props);
            }
            if(expect.properties){
                let props = expect.properties;
                for(let prop in props){
                    if(!self.checkValue(props[prop], _.get(check_entity, prop))){
                        return await on_error(new Error("Error while checking entity property " + prop + " : expected " + JSON.stringify(props[prop], null, 2) + " vs " + JSON.stringify(check_entity[prop], null, 2)));
                    }
                }
            }
            if(expect.existing_properties){
                let props = expect.existing_properties;
                for(let prop of props){
                    if(_.get(check_entity, prop) == undefined){
                        return await on_error(new Error("Error while checking entity property " + prop + " : expected to exist"));
                    }
                }
            }
            return entity;
        }
    },

    checkValue: (value, expected_value, options = {}) => {
        let strict = options.strict || true;
        if(strict){
            return _.isEqual(value, expected_value);
        }else{
            if(typeof value == 'object'){
                return self.checkObjectProperties(value, expected_value);   
            }else{
                return _.isEqual(value, expected_value);
            }
        }
    },

    /**
     * Check if the given object is matching the expected values
     * @param {object} object - object to check
     * @param {object} expected_properties - expected values
     * @param {boolean} apply_get - if true, apply lodash get function on object properties
     * @returns {boolean} true if the object is matching the expected values
     */
    checkObjectProperties: (object, expected_properties, options = {}) => {
        let apply_get = options.apply_get || true,
            target = object, 
            check = expected_properties;
        if (apply_get) {
            check = {};
            target = {};
            for (let prop in expected_properties) {
                _.set(check, prop, expected_properties[prop]);
            }
            for (let prop in object) {
                _.set(target, prop, object[prop]);
            }
        }
        return _.find([target], check) != null;
    }

}

module.exports = self;
