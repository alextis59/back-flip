const _ = require('lodash'),
    utils = require('side-flip/utils'),
    { InvalidModelAttributeError } = require('../middlewares/errors');


const self = {

    ENTITY_MODEL_MAP: {},

    registerEntityModel: (model) => {
        self.ENTITY_MODEL_MAP[model.entity] = model;
    },

    /**
     * Returns the corresponding entity model for a given entity type.
     * 
     * @param {string} entity_type - The type of entity to get the model for.
     * @returns {Object} - The entity model for the given entity type.
     */
    getEntityModel: (entity_type) => {
        return _.get(self.ENTITY_MODEL_MAP, entity_type + '.model', {});
    },

    /**
     * Checks if a user has the required permissions (default function).
     * @param {string} permissions - The required permissions for the user. Can be "all" or a combination of permissions separated by "&&" or "||".
     * @param {object} user - The user object to check permissions against.
     * @returns {boolean} - True if the user has the required permissions, false otherwise.
     */
    isAllowed: (permissions, user) => {
        let allowed = false;
        if (permissions) {
            if (permissions === "all" || user.admin) {
                allowed = true;
            } else if (permissions.includes(" && ")) {
                let splitted = permissions.split(" && ");
                allowed = true;
                for (let permission of splitted) {
                    if (!user[permission]) {
                        allowed = false;
                    }
                }
            } else if (permissions.includes(" || ")) {
                let splitted = permissions.split(" || ");
                allowed = false;
                for (let permission of splitted) {
                    if (user[permission]) {
                        allowed = true;
                    }
                }
            } else if (user[permissions]) {
                allowed = true;
            }
        }
        return allowed;
    },

    /**
     * Retrieves a specific target from a given model.
     * @param {object} model - The model to retrieve the target from.
     * @param {string} target - The target to retrieve from the model.
     * @returns {object} The retrieved target from the model or null if the target does not exist.
     */
    getModelTarget: (model, target) => {
        let target_hierarchy = target.split("."), current_model_target = model;
        for (let i = 0; i < target_hierarchy.length; i++) {
            let next_target = target_hierarchy[i],
                next_model_target = current_model_target._model_root
                    ? _.get(current_model_target, next_target)
                    : _.get(current_model_target, 'properties.each_prop', _.get(current_model_target, 'properties.' + next_target));
            if (!next_model_target) {
                return null;
            } else {
                current_model_target = next_model_target;
            }
        }
        return current_model_target;
    },

    /**
     * Checks if the specified property has the required permissions for the given method and user.
     *
     * @param {string} prop - The property to check.
     * @param {object} model - The model object to check.
     * @param {object} user - The user object to check.
     * @param {string} method - The method to check.
     * @returns {boolean} A boolean indicating whether the property has the required permissions.
     */
    checkPropertyAccessRight: (prop, model, user, method) => {
        let prop_hierarchy = prop.split("."), 
            current_target = "";
        while(prop_hierarchy.length){
            current_target += (current_target.length > 0 ? "." : "") + prop_hierarchy.shift();
            let current_target_model = self.getModelTarget(model, current_target);
            if (!current_target_model) {
                return current_target.includes('.');
            } else if (current_target_model.permissions !== undefined && !self.isAllowed(current_target_model.permissions[method], user)) {
                return false;
            }
        }
        return true;
    },

    /**
     * Filters the given object based on the access rights of the specified user and model for the specified method.
     *
     * @param {object} object - The object to be filtered.
     * @param {object} model - The model object to use for access rights.
     * @param {object} user - The user object to use for access rights.
     * @param {string} method - The HTTP method to use for access rights.
     * @returns {{data: object, removed: array}} An object containing the filtered data and a list of removed properties.
     */
    getFilteredObjectFromAccessRights: (object, model, user, method) => {
        let data = {},
            removed = [];
        for (const prop in object) {
            if (object.hasOwnProperty(prop)) {
                if (self.checkPropertyAccessRight(prop, model, user, method)) {
                    if (model[prop].type === "object" && model[prop].properties && !model[prop].properties.each_prop && object[prop] !== null) {
                        let filtered = self.getFilteredObjectFromAccessRights(object[prop], model[prop].properties, user, method);
                        data[prop] = filtered.data;
                        removed = removed.concat(_.map(filtered.removed, (sub_prop) => { return prop + '.' + sub_prop }));
                    } else {
                        data[prop] = object[prop];
                    }
                } else {
                    removed.push(prop);
                }
            }
        }
        return { data: data, removed: removed };
    },

    /**
     * Filters the given data object based on the access rights of the specified user and the given model.
     *
     * @param {object} data - The entity object to filter
     * @param {object} model - The model object to use for access rights.
     * @param {object} user - The user object to use for access rights.
     * @param {string} method - The HTTP method to use for access rights.
     * @returns {{data: object, removed: array}} An object containing the filtered data and an array of removed properties.
     */
    getFilteredEntityDataForUser: (data, model, user, method) => {
        let flattened_object = utils.getFlattenedObject(data), 
            filtered = {}, 
            removed = [];
        for (let target in flattened_object) {
            if (self.checkPropertyAccessRight(target, model, user, method)) {
                filtered[target] = flattened_object[target];
            } else {
                removed.push(target);
            }
        }
        let processed = {}, result = {};
        for (let target in filtered) {
            if (data.hasOwnProperty(target)) {
                processed[target] = filtered[target];
            } else {
                _.setWith(processed, target, filtered[target], Object);
            }
        }
        for (let target in data) {
            let value = _.get(processed, target);
            if (value !== undefined) {
                result[target] = value;
            }
        }
        return { data: result, removed: removed };
    },

    verifyModelValue: (value, model, name = "value") => {
        if (!utils.checkVar(value, model.type, model.control)){
            throw new InvalidModelAttributeError(name, "Invalid value");
        }
        if (model.type === "object" && model.properties) {
            self.verifyModelObject(value, model.properties, name);
        } else if (model.type === "array" && model.items) {
            self.verifyModelArray(value, model.items, name);
        }
    },

    verifyModelObject: (object, model, name) => {
        if (model.each_prop) {
            // For objects containing properties having all the same structure
            let prop_model = model.each_prop;
            for (let prop in object) {
                let target = name ? name + '.' + prop : prop;
                if (prop_model.key_control && !utils.checkVar(prop + "", "string", prop_model.key_control)){
                    throw new InvalidModelAttributeError(target, "Invalid key");
                }
                self.verifyModelValue(object[prop], prop_model, target);
            }
        } else {
            // For objects containing properties with defined key name and different structures
            for (let prop in model) {
                let value = object[prop];
                if(value !== undefined){
                    let prop_model = model[prop];
                    if(value !== null || !prop_model.allow_null){
                        self.verifyModelValue(value, prop_model, name ? name + '.' + prop : prop);
                    }
                }
            }
        }
    },

    verifyModelArray: (array, model, name = "array") => {
        for(let index in array){
            let item = array[index];
            if (!utils.checkVar(item, model.type, model.control)) {
                throw new InvalidModelAttributeError(name, "Invalid item: " + index);
            }
            if (model.type === "object" && model.properties) {
                self.verifyModelObject(item, model.properties, name + "[" + index + "]");
            } else if (model.type === "array" && model.items) {
                self.verifyModelArray(item, model.items, name + "[" + index + "]");
            }
        }
    },

    /**
     * Retrieves a list of allowed properties for the specified entity type based on the specified user's access rights.
     *
     * @param {string} entity_type - The type of entity to retrieve properties for.
     * @param {object} user - The user object to use for access rights.
     * @returns {array} An array of allowed properties for the specified entity type.
     */
    getAllowedPropertiesRetrievalOnEntity: (entity_type, user) => {
        const props = [],
            requestModel = self.getEntityModel(entity_type);
        for (const prop in requestModel) {
            if (requestModel.hasOwnProperty(prop) && self.checkPropertyAccessRight(prop, requestModel, user, 'GET')){
                props.push(prop)
            } 
        }
        return props;
    },

}

module.exports = self;