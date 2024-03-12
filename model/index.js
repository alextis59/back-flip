const _ = require('lodash'),
    utils = require('side-flip/utils'),
    EntityHandler = require('./EntityHandler'),
    EntityModel = require('./EntityModel'),
    { InvalidEntityError } = require('./errors');


const self = {

    ENTITY_MODEL_MAP: {},

    registerEntityHandler: (model) => {
        let handler = model;
        if(!model instanceof EntityHandler){
            handler = new EntityHandler(model);
        }
        self.ENTITY_MODEL_MAP[model.entity] = handler;
    },

    /**
     * Returns the corresponding entity model for a given entity type.
     * 
     * @param {string} entity_type - The type of entity to get the model for.
     * @returns {Object} - The entity model for the given entity type.
     */
    getEntityModel: (entity_type) => {
        if(!self.ENTITY_MODEL_MAP[entity_type]){
            throw new InvalidEntityError(entity_type, {entity_type});
        }
        return self.ENTITY_MODEL_MAP[entity_type].model;
    },

    loadRequestEntity: (entity_type) => {
        if(!self.ENTITY_MODEL_MAP[entity_type]){
            throw new InvalidEntityError(entity_type, {entity_type});
        }
        return self.ENTITY_MODEL_MAP[entity_type].loadRequestEntity;
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
     * Checks if the specified property has the required permissions for the given method and user.
     *
     * @param {EntityModel} entity_model - The entity model to check.
     * @param {string} prop - The property to check.
     * @param {object} user - The user object to check.
     * @param {string} method - The method to check.
     * @returns {boolean} A boolean indicating whether the property has the required permissions.
     */
    checkPropertyAccessRight: (entity_model, prop, user, method) => {
        let prop_hierarchy = prop.split("."), 
            current_target = "";
        while(prop_hierarchy.length){
            current_target += (current_target.length > 0 ? "." : "") + prop_hierarchy.shift();
            let current_target_model = entity_model.getModelTarget(current_target);
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
     * @param {string} entity_type - The entity type to use for access rights.
     * @param {object} object - The object to be filtered.
     * @param {object} user - The user object to use for access rights.
     * @param {string} method - The HTTP method to use for access rights.
     * @returns {{data: object, removed: array}} An object containing the filtered data and a list of removed properties.
     */
    getFilteredObjectFromAccessRights: (entity_type, object, user, method) => {
        let entity_model = self.getEntityModel(entity_type),
            flattened_object = utils.getFlattenedObject(object), 
            filtered = {}, 
            removed = [];
        for (let target in flattened_object) {
            if (self.checkPropertyAccessRight(entity_model, target, user, method)) {
                filtered[target] = flattened_object[target];
            } else {
                removed.push(target);
            }
        }
        let processed = {}, result = {};
        for (let target in filtered) {
            if (object.hasOwnProperty(target)) {
                processed[target] = filtered[target];
            } else {
                _.setWith(processed, target, filtered[target], Object);
            }
        }
        for (let target in object) {
            let value = _.get(processed, target);
            if (value !== undefined) {
                result[target] = value;
            }
        }
        return { data: result, removed: removed };
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
            if (requestModel.hasOwnProperty(prop) && self.checkPropertyAccessRight(requestModel, prop, user, 'GET')){
                props.push(prop)
            } 
        }
        return props;
    },

}

module.exports = self;