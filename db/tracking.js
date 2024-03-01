const _ = require('lodash');

const self = {

    db,

    create_collection_name: 'db_create',

    update_collection_name: 'db_update',

    delete_collection_name: 'db_delete',

    entity_tracking: {},

    target_updator_field: 'requestor_id',

    // Attributes that should not be tracked
    global_tracking_blacklist: ['last_modified'],

    initialize: (db, options) => {
        self.db = db;
        if (options.entity_tracking) {
            self.entity_tracking = options.entity_tracking;
        }
        if (options.target_updator_field) {
            self.target_updator_field = options.target_updator_field;
        }
        if (options.global_tracking_blacklist) {
            self.global_tracking_blacklist = self.global_tracking_blacklist.concat(options.global_tracking_blacklist);
        }
        self.db.onEventSubscribe('create', self.onEntityCreate);
        self.db.onEventSubscribe('update', self.onEntityUpdate);
    },

    /**
     * Check if entity is tracked
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @returns {boolean} True if entity is tracked
     */
    isTrackedEntity: (entity_name) => {
        return self.entity_tracking[entity_name] && self.entity_tracking[entity_name].tracking === true;
    },

    /**
     * Filter update object to keep only tracked attributes and obfuscate them if needed
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {Object} data Update object
     * @returns {Object} Filtered update object
     */
    filterTrackedEntityUpdate: (entity_name, data) => {
        let tracking_options = self.entity_tracking[entity_name], filtered = {},
            attr_whitelist = tracking_options.attr_whitelist || [],
            attr_blacklist = self.global_tracking_blacklist.concat(tracking_options.attr_blacklist || []);
        if (attr_whitelist.length > 0) {
            for (let attr of attr_whitelist) {
                if (data[attr] !== undefined) {
                    filtered[attr] = data[attr];
                }
            }
        } else if (attr_blacklist.length > 0) {
            for (let attr in data) {
                if (!attr_blacklist.includes(attr)) {
                    filtered[attr] = data[attr];
                }
            }
        }
        filtered = self.getObfuscatedObject(entity_name, filtered);
        return filtered;
    },

    /**
     * Obfuscate some attributes of an entity if needed
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {Object} data Entity data
     * @returns {Object} Obfuscated entity data
     */
    getObfuscatedObject: (entity_name, data) => {
        let tracking_options = self.entity_tracking[entity_name] || {},
            attr_obfuscation = tracking_options.attr_obfuscation || [],
            obfuscated = _.cloneDeep(data);
        if (attr_obfuscation.length > 0) {
            for (let attr in obfuscated) {
                if (obfuscated[attr] !== null && attr_obfuscation.includes(attr)) {
                    obfuscated[attr] = "*";
                }
            }
        }
        return obfuscated;
    },

    /**
     * Get the delete object to save in database
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {Object} entity Entity data
     * @param {string} requester_id Requester id
     * @returns {Object} Delete object
     */
    getEntityDeleteObj: (entity_name, entity, requester_id) => {
        entity = self.getObfuscatedObject(entity_name, entity);
        return {
            entity_name: entity_name,
            entity_id: entity._id.toString(),
            data: entity,
            requester_id: requester_id,
            deletion_date: self.db.getNow()
        }
    },

    /**
     * Save a backup in database of an entity that needs to be deleted (if tracked, and obfuscate some attributes if needed)
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {Object} query Query to find the entity to delete
     * @param {Object} options Additional options
     */
    beforeEntityDelete: async (entity_name, query, options = {}) => {
        if (self.isTrackedEntity(entity_name)) {
            let entity = await self.db.findEntityFromQuery(entity_name, query),
                requester_id = (options.requester_id || options[self.target_updator_field] || self.db.service_name).toString();
                delete_obj = self.getEntityDeleteObj(entity_name, entity, requester_id);
            return await self.db.createEntity(self.delete_collection_name, delete_obj, {no_creation_date: true});
        }
    },

    /**
     * Save a backup in database of entities that needs to be deleted (if tracked, and obfuscate some attributes if needed)
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {Object} query Query to find the entities to delete
     * @param {Object} options Additional options
     */
    beforeEntityDelete: async (entity_name, query, options = {}) => {
        if (self.isTrackedEntity(entity_name)) {
            let entities = await self.db.findEntitiesFromQuery(entity_name, query),
                requester_id = (options.requester_id || options[self.target_updator_field] || self.db.service_name).toString(),
                delete_obj_list = _.map(entities, (entity) => {
                    return self.getEntityDeleteObj(entity_name, entity, requester_id);
                });
            return await self.db.createEntities(self.delete_collection_name, delete_obj_list, {no_creation_date: true});
        }
    },

    /**
     * Save entity creation in database
     * @param {Object} data Entity creation data
     */
    onEntityCreate: async (data) => {
        let entity_name = data.entity_name;
        if(self.isTrackedEntity(entity_name)) {
            let id_list = _.get(data, 'result.insertedIds', []),
                creation_date = _.get(data, 'entities.0.creation_date', self.db.getNow()),
                requester_id = (data.requester_id || data[self.target_updator_field] || _.get(data, 'options.' + self.target_updator_field) || self.db.service_name).toString(),
                create_obj_list = _.map(id_list, (id) => {
                    return {
                        entity_name: entity_name,
                        entity_id: id.toString(),
                        requester_id: requester_id,
                        creation_date: creation_date
                    }
                });
            await self.db.createEntities(self.create_collection_name, create_obj_list, {no_creation_date: true});
        }
    },

    /**
     * Save entity update in database
     * @param {Object} data Entity update data
     */
    onEntityUpdate: async (data) => {
        let entity_name = data.entity_name;
        if(self.isTrackedEntity(entity_name)) {
            let update = self.filterTrackedEntityUpdate(entity_name, data.update || {});
            if(Object.keys(update).length){
                let entity_id = data.entity_id || _.get(data, 'query._id', null),
                    requester_id = (data.requester_id || data[self.target_updator_field] || _.get(data, 'options.' + self.target_updator_field) || self.db.service_name).toString();
                let update_obj = {
                    entity_name: entity_name,
                    entity_id: entity_id,
                    data: update,
                    requester_id: requester_id,
                    update_date: self.db.getNow()
                };
                await self.db.createEntity(self.update_collection_name, update_obj, {no_creation_date: true});
            }
        }
    }

}

module.exports = self;