const _                         = require('lodash'),
      moment                    = require('moment'),
      logger                    = require('../log'),
      { MongoClient, ObjectId } = require('mongodb'),
      utils                     = require('../utils'),
      tracking               = require('./tracking');


const self = {

    client,
    db,
    db_uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/',
    db_name: '',
    service_name: 'unknown',
    add_projection_fields: [],
    default_sort,

    /**
     * Get current utc Date object
     * @returns {Date} Current utc Date object
     */
    getNow: () => {
        return moment().utc().toDate();
    },

    /**
     * Initialize database connection
     * @param {Object} options - Database options
     */
    initialize: (options = {}) => {
        if(options.uri){
            self.db_uri = options.uri;
        }
        if(options.name){
            self.db_name = options.name;
        }
        if(options.service){
            self.service_name = options.service;
        }
        if(options.add_projection_fields){
            self.add_projection_fields = options.add_projection_fields;
        }
        if(options.default_sort){
            self.default_sort = options.default_sort;
        }
        
        let tracking_options = options.tracking || {};
        if(tracking_options.enabled){
            tracking.initialize(self, tracking_options);
        }
        
        // TO DO : db caching options
    },

    /**
     * Connect to database
     * @param {Object} options - Database connection options
     */
    connect: async (options = {}) => {
        while(self.connecting_db){
            await utils.wait(100);
        }
        if(self.db){
            return self.db;
        }
        self.connecting_db = true;

        try{
            self.client = await MongoClient.connect(self.db_uri, { connectTimeoutMS: options.connection_timeout || 1000 });
            self.db = self.client.db(self.db_name);
    
            self.client.on('close', () => {
                logger.error(`Database connection closed`);
                self.db = null;
            });

            await self.db.command({ ping: 1 });
            self.connecting_db = false;
            return self.db;
        }catch(err){
            logger.error(`Database connection failed: ${err.message}`);
            self.db = null;
            self.connecting_db = false;
            throw err;
        }
    },

    /**
     * Disconnect from database
     */
    disconnect: async () => {
        if(self.client){
            await self.client.close();
        }
        self.db = null;
    },

    /**
     * Check database connection
     */
    checkConnection: async () => {
        if(self.db){
            try{
                await self.db.command({ ping: 1 });
                return true;
            }catch(err){
                logger.error(`Database connection failed: ${err.message}`);
                self.db = null;
                return false;
            }
        }else{
            return false;
        }
    },

    /**
     * Get the MongoDB collection reference of the entity_name
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     */
    getCollection: async (entity_name) => {
        await self.connect();
        return self.db.collection(entity_name);
    },

    /*** EVENT HANDLING ***/

    event_listeners: {},

    onEventSubscribe: (event_name, cb) => {
        if(!self.event_listeners[event_name]){
            self.event_listeners[event_name] = [];
        }
        self.event_listeners[event_name].push(cb);
    },

    onEventUnsubscribe: (event_name, cb) => {
        if(self.event_listeners[event_name]){
            self.event_listeners[event_name] = _.filter(self.event_listeners[event_name], (listener) => {
                return listener !== cb;
            });
        }
    },

    onEvent: (event_name, data) => {
        if(self.event_listeners[event_name]){
            for(let cb of self.event_listeners[event_name]){
                cb(data);
            }
        }
    },

    /*** DB UTILS ***/

    /**
     * Build attribute project to filter object properties in a query
     * @param options
     * @returns {{}} Attributes projection
     */
    _buildProjection: (options) => {
        const projection = {};
        if(options.only && options.only.length) {
            for(let field of options.only){
                projection[field] = 1;
            }
            for(let field of self.add_projection_fields){
                projection[field] = 1;
            }
        }
        if(options.without && options.without.length) {
            for(const without of options.without) {
                if(!self.add_projection_fields.includes(without)){
                    projection[without] = 0;
                }
            }
        }
        return projection;
    },

    /*** GENERIC CRUD METHODS ***/

    /**
     * Create an entity object
     * @see createEntities(entity_name: string, list: [Object])
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} obj Entity object to create in collection
     */
    createEntity: async (entity_name, obj, options = {}) => {
        return await self.createEntities(entity_name, [obj], cb, options);
    },

    /**
     * Create entities objects from list
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {[{}]} entities List of entity objects to create in collection
     */
    createEntities: async (entity_name, entities, options = {}) => {
        logger.debug("db.createEntities", { inputs: { entity_name, entities } });
        if(!options.no_creation_date){
            let now = self.getNow();
            for(let item of entities){
                item.creation_date = now;
            }
        }
        let collection = await self.getCollection(entity_name);
        let result = await collection.insertMany(entities);
        _.map(entities, (entity, index) => {
            entity._id = result.insertedIds[index];
        });
        self.onEvent("create", { entity_name, entities, result, options });
        return result;
    },

    /**
     * Save an entity (with its full object)
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} entity Entity object to save in collection
     */
    saveEntity: async (entity_name, entity) => {
        logger.debug("db.saveEntity", { inputs: { entity_name } });
        let collection = await self.getCollection(entity_name);
        let data = _.cloneDeep(entity);
        data.last_modified = self.getNow();
        let result = await collection.replaceOne({ _id: entity._id }, data);
        self.onEvent("update", { entity_name, entity_id: entity._id.toString(), update: data, result });
        return result;
    },

    /**
     * Update an entity corresponding to a query (execute a partial update corresponding to the given object)
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity object to update
     * @param {{}} obj Update to apply to the entity object
     */
    updateEntityFromQuery: async (entity_name, query, obj, options = {}) => {
        logger.debug("db.updateEntity", { inputs: { entity_name, query } });
        if(options.data_flattening){
            obj = utils.getFlattenedObject(obj);
        }
        let update = { $set: obj };
        if(options.delete_null_fields){
            let delete_fields = {};
            for(let prop in obj){
                if(obj[prop] === null){
                    delete_fields[prop] = "";
                    delete obj[prop];
                }
            }
            if(Object.keys(delete_fields).length > 0){
                update = { $set: obj, $unset: delete_fields };
            }
        }
        update.$set.last_modified = self.getNow();
        let update_options = {};
        if(options.upsert){
            update_options.upsert = true;
        }
        let collection = await self.getCollection(entity_name);
        let result = await collection.updateOne(query, update, update_options);
        self.onEvent("update", { entity_name, query, update: obj, result });
        return result;
    },

    /**
     * Update an entity
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} id Entity id
     * @param {{}} obj Update to apply to the entity object
     */
    updateEntity: async (entity_name, id, obj, options = {}) => {
        logger.debug("db.updateEntity", { inputs: { entity_name, id } });
        return await self.updateEntityFromQuery(entity_name, { _id: (id instanceof ObjectId) ? id : new ObjectId(id) }, obj, cb, options);
    },

    /**
     * Delete an entity corresponding to a query
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity object to delete
     * @param {{}} options Options
     */
    deleteEntityFromQuery: async (entity_name, query, options = {}) => {
        logger.debug("db.deleteEntityFromQuery", { inputs: { entity_name, query } });
        await tracking.beforeEntityDelete(entity_name, query, options);
        let collection = await self.getCollection(entity_name);
        let result = await collection.deleteOne(query);
        self.onEvent("delete", { entity_name, query, result });
        return result;
    },

    /**
     * Delete entities corresponding to a query
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entities objects to delete
     * @param {{}} options Options
     */
    deleteEntitiesFromQuery: async (entity_name, query, options = {}) => {
        logger.debug("db.deleteEntitiesFromQuery", { inputs: { entity_name, query } });
        await tracking.beforeEntitiesDelete(entity_name, query, options);
        let collection = await self.getCollection(entity_name);
        let result = await collection.deleteMany(query);
        self.onEvent("delete", { entity_name, query, result });
        return result;
    },

    /**
     * Delete an entity
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} id Entity id
     * @param {{}} options Options
     */
    deleteEntity: async (entity_name, id, options) => {
        logger.debug("db.deleteEntity", { inputs: { entity_name, id } });
        return await self.deleteEntityFromQuery(entity_name, { _id: (id instanceof ObjectId) ? id : new ObjectId(id) }, options);
    },

    /*** GETTERS ***/

    /**
     * Get entity corresponding to a query
     * You can specify which attributes to include or exclude using only or without list of properties
     * Property path is supported (e.g. "properties.property")
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity object
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntityFromQuery: async (entity_name, query, options = { only: [], without: [] }) => {
        logger.debug("db.findEntityFromQuery", { inputs: { entity_name, query } });
        let collection = await self.getCollection(entity_name);
        let item = await collection.findOne(query, { projection: self._buildProjection(options) });
        return item;
    },

    /**
     * Get entity from its ID
     * You can specify which attributes to include or exclude using only or without list of properties
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} id Entity id
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntityFromID: async (entity_name, id, options) => {
        logger.debug("db.findEntityFromID", { inputs: { entity_name, id } });
        id = (id && id.toString) ? id.toString() : id;
        if(!id || (!id.match(/^[0-9a-fA-F]{24}$/) && !id.match(/^[0-9a-fA-F]{12}$/))) {
            return null;
        }
        return await self.findEntityFromQuery(entity_name, { _id: new ObjectId(id) }, options);
    },

    /**
     * Get entity from a given property and its value
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} property Property name
     * @param value Property value
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntityFromProperty: async (entity_name, property, value, options) => {
        logger.debug("db.findEntityFromProperty", { inputs: { entity_name, property, value } });
        return await self.findEntityFromQuery(entity_name, {[property]: value}, options);
    },

    /**
     * Get all entities corresponding to a db query
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity objects
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntitiesFromQuery: async (entity_name, query, options = {}) => {
        logger.debug("db.findEntitiesFromQuery", { inputs: { entity_name, query } });
        options.only = options.only || [];
        options.without = options.without || [];
        options.sort = options.sort || self.default_sort;
        let collection = await self.getCollection(entity_name);
        let items = await collection.find(query, { projection: self._buildProjection(options), sort: options.sort }).toArray();
        return items;
    },

    /**
     * Get entity list from an id list
     * @param entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {[]} id_list List of ids
     * @param options Query options
     */
    findEntitiesFromIdList: async (entity_name, id_list, options) => {
        logger.debug("db.findEntitiesFromIdList", { inputs: { entity_name, id_list } });
        let object_id_list = [];
        for(let id of id_list){
            id = (id && id.toString) ? id.toString() : id;
            if(id && (id.match(/^[0-9a-fA-F]{24}$/) || id.match(/^[0-9a-fA-F]{12}$/))) {
                object_id_list.push(new ObjectId(id));
            }
        }
        return await self.findEntitiesFromPropertyValues(entity_name, '_id', object_id_list, options);
    },

    /**
     * List all entities
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findAllEntities: async (entity_name, options) => {
        logger.debug("db.findAllEntities", { inputs: entity_name });
        return await self.findEntitiesFromQuery(entity_name, {}, options);
    },

    /**
     * Get all entities from a given property and its value
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} property Property name
     * @param value Property value
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntitiesFromProperty: async (entity_name, property, value, options) => {
        logger.debug("db.findEntitiesFromProperty", { inputs: { entity_name, property, value } });
        return await self.findEntitiesFromQuery(entity_name, { [property]: value }, options);
    },

    /**
     * Get all entities from a given property and a value list
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} property Property name
     * @param {[]} value_list List of values
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntitiesFromPropertyValues: async (entity_name, property, value_list, options) => {
        logger.debug("db.findEntitiesFromProperty", { inputs: { entity_name, property, value_list } });
        return await self.findEntitiesFromQuery(entity_name, { [property]: {$in: value_list} }, options);
    }

}

module.exports = self;