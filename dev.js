const _ = require('lodash'),
    utils = require('side-flip/utils');



const self = {

    /**
     * Checks if the object value matches the query value based on various query operators.
     * 
     * @param {any} object_value The value to be matched against the query.
     * @param {Object} query_value The query object that specifies the matching criteria.
     * 
     * @returns {boolean} True if the object value matches the query value, false otherwise.
     */
    queryMatchCustomizer: (object_value, query_value) => {
        if(_.isEqual(object_value, query_value)) {
            return true;
        }
        if(query_value.$exists != null){
            if(query_value.$exists){
                return object_value !== undefined;
            }else{
                return object_value === undefined;
            }
        }
        if(query_value.$ne != null && !_.isEqual(object_value, query_value.$ne)){
            return true;
        }
        if(query_value.$in != null){
            for(let value of query_value.$in){
                if(_.isEqual(object_value, value)){
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * Fills an entity with default values based on a query object.
     * 
     * @param {object} entity - The entity to be filled with default values.
     * @param {object} query - The query object that defines the default values.
     * 
     * @returns {object} The filled entity with default values.
     */
    getFilledEntityForCheck: (entity, query) => {
        let clone = _.cloneDeep(entity),
            flat_query = utils.getFlattenedObject(query);
        for(let target in flat_query){
            let keys = target.split('.'),
                last = keys.pop();
            if(last.includes('$')){
                let attr_target = keys.join('.');
                if(_.get(clone, attr_target) === undefined){
                    _.set(clone, attr_target, undefined);
                }
            }
        }
        return clone;
    },

    /**
     * Checks if an entity matches a given query.
     * 
     * @param {Object} entity - The entity to be checked against the query.
     * @param {Object} query - The query to match the entity against.
     * @return {Boolean} True if the entity matches the query, false otherwise.
     */
    entityMatchQuery: (entity, query) => {
        let target = self.getFilledEntityForCheck(entity, query);
        return _.isMatchWith(target, query, self.queryMatchCustomizer);
    },

};

console.log('dev.js loaded')

module.exports = self;