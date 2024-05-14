const _ = require('lodash'),
    moment = require('moment'),
    logger = require('../log'),
    { MongoClient, ObjectId } = require('mongodb'),
    { DatabaseError, InvalidParameterError } = require('../model/errors'),
    utils = require('side-flip/utils'),
    tracking = require('./tracking'),
    auto_publish = require('./auto_publish');


const self = {

    initialized: false,

    client: null,

    db: null,

    db_uri: 'mongodb://localhost:27017/',

    db_name: '',

    service_name: 'unknown',

    add_projection_fields: [],

    default_sort: undefined,

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
    initialize: async (cb, options = {}) => {
        if(self.initialized){
            return;
        }
        self.initialized = true;
        logger.debug("db.initialize", { inputs: options });
        if(typeof cb === 'object'){
            options = cb;
            cb = undefined;
        }
        if (options.db_uri) {
            self.db_uri = options.db_uri;
        }
        if (options.db_name) {
            self.db_name = options.db_name;
        }
        if (options.service) {
            self.service_name = options.service;
        }
        if (options.add_projection_fields) {
            self.add_projection_fields = options.add_projection_fields;
        }
        if (options.default_sort) {
            self.default_sort = options.default_sort;
        }

        // Tracking options
        let tracking_options = options.tracking || {};
        if (tracking_options.enabled) {
            tracking.initialize(self, tracking_options);
        }

        // TO DO : cache implementation

        // TO DO : auto publish 
        let auto_publish_options = options.auto_publish || {};
        if(auto_publish_options.enabled){
            auto_publish.initialize(self, auto_publish_options);
        }

        return await self.connect(cb, options);
    },

    /**
     * Connect to database
     * @param cb Callback function
     * @param {Object} options - Database connection options
     */
    connect: async (cb, options = {}) => {
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        while (self.connecting_db) {
            await utils.wait(100);
        }
        if (self.db) {
            cb(null, self.db);
            return self.db;
        }
        self.connecting_db = true;

        try {
            logger.debug("MongoClient.connect");
            self.client = await MongoClient.connect(self.db_uri, { connectTimeoutMS: options.connection_timeout || 1000 });
            self.db = self.client.db(self.db_name);

            self.client.on('close', () => {
                logger.error(`Database connection closed`);
                self.db = null;
            });

            await self.db.command({ ping: 1 });
            logger.info("DB connection established");
            self.connecting_db = false;
            cb(null, self.db);
            return self.db;
        } catch (err) {
            logger.error(`Database connection failed: ${err.message}`);
            self.db = null;
            self.connecting_db = false;
            err = new DatabaseError('connect', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Disconnect from database
     */
    disconnect: async (cb) => {
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else {
            cb = () => { };
        }
        try {
            if (self.client) {
                await self.client.close();
                logger.info("DB connection closed");
                self.db = null;
            }
            cb();
        } catch (err) {
            logger.error("DB connection close failed: %s", err.message);
            err = new DatabaseError('disconnect', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Check database connection
     */
    checkConnection: async (cb) => {
        if (self.db) {
            try {
                await self.db.command({ ping: 1 });
                if(typeof cb === 'function'){
                    cb();
                }
                return;
            } catch (err) {
                logger.error(`Database connection failed: ${err.message}`);
                self.db = null;
                err = new DatabaseError('checkConnection', err);
                if(typeof cb === 'function'){
                    cb(err);
                }else{
                    throw err;
                }
            }
        } else {
            let err = new Error("Database not connected");
            err = new DatabaseError('checkConnection', err);
            if(typeof cb === 'function'){
                cb(err);
            }else{
                throw err;
            }
        }
    },

    /**
     * Get the MongoDB collection reference of the entity_name
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     */
    getCollection: async (entity_name, cb) => {
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else {
            cb = () => { };
        }
        try {
            await self.connect();
            let collection = self.db.collection(entity_name);
            cb(null, collection);
            return collection;
        } catch (err) {
            err = new DatabaseError('getCollection', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /*** EVENT HANDLING ***/

    event_listeners: {},

    onEventSubscribe: (event_name, cb) => {
        if (!self.event_listeners[event_name]) {
            self.event_listeners[event_name] = [];
        }
        self.event_listeners[event_name].push(cb);
    },

    onEventUnsubscribe: (event_name, cb) => {
        if (self.event_listeners[event_name]) {
            self.event_listeners[event_name] = _.filter(self.event_listeners[event_name], (listener) => {
                return listener !== cb;
            });
        }
    },

    onEvent: (event_name, data) => {
        if (self.event_listeners[event_name]) {
            for (let cb of self.event_listeners[event_name]) {
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
        if (options.only && options.only.length) {
            for (let field of options.only) {
                if (field) {
                    projection[field] = 1;
                }
            }
            for (let field of self.add_projection_fields) {
                projection[field] = 1;
            }
        }else if (options.without && options.without.length) {
            for (const without of options.without) {
                if (without && !self.add_projection_fields.includes(without)) {
                    projection[without] = 0;
                }
            }
        }
        return projection;
    },

    getObjectId: (id) => {
        if(id && id.toString){
            id = id.toString();
        }
        if(!id || (!id.match(/^[0-9a-fA-F]{24}$/) && !id.match(/^[0-9a-fA-F]{12}$/))){
            throw new InvalidParameterError('id', {id});
        }
        try{
            return (id instanceof ObjectId) ? id : new ObjectId(id);
        }catch(err){
            throw new InvalidParameterError('id', {id});
        }
    },

    /*** GENERIC CRUD METHODS ***/

    /**
     * Create an entity object
     * @see createEntities(entity_name: string, list: [Object])
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} obj Entity object to create in collection
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    createEntity: async (entity_name, obj, cb, options = {}) => {
        logger.debug("db.createEntity", { inputs: { entity_name } });
        return await self.createEntities(entity_name, [obj], cb, options);
    },

    /**
     * Create entities objects from list
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {[{}]} entities List of entity objects to create in collection
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    createEntities: async (entity_name, entities, cb, options = {}) => {
        logger.debug("db.createEntities", { inputs: { entity_name, entities } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        if (!options.no_creation_date) {
            let now = self.getNow();
            for (let item of entities) {
                item.creation_date = now;
            }
        }
        try {
            let collection = await self.getCollection(entity_name);
            let result = await collection.insertMany(entities);
            _.map(entities, (entity, index) => {
                entity._id = result.insertedIds[index];
            });
            self.onEvent("create", { entity_name, entities, result, options });
            cb(null, result);
            return result;
        } catch (err) {
            err = new DatabaseError('createEntities', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Save an entity (with its full object)
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} entity Entity object to save in collection
     */
    saveEntity: async (entity_name, entity, cb) => {
        logger.debug("db.saveEntity", { inputs: { entity_name } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else {
            cb = () => { };
        }
        try {
            let collection = await self.getCollection(entity_name);
            let data = _.cloneDeep(entity);
            data.last_modified = self.getNow();
            let result = await collection.replaceOne({ _id: entity._id }, data);
            self.onEvent("update", { entity_name, entity_id: entity._id.toString(), update: data, result });
            cb(null, result);
            return result;
        } catch (err) {
            err = new DatabaseError('saveEntity', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Update an entity corresponding to a query (execute a partial update corresponding to the given object)
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity object to update
     * @param {{}} obj Update to apply to the entity object
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    updateEntityFromQuery: async (entity_name, query, obj, cb, options = {}) => {
        logger.debug("db.updateEntityFromQuery", { inputs: { entity_name, query } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        try {
            obj = options.data_flattening ? utils.getFlattenedObject(obj) : _.cloneDeep(obj);
            let event_data = _.cloneDeep(obj);
            let update = { $set: obj };
            if (options.delete_null_fields) {
                let delete_fields = {};
                for (let prop in obj) {
                    if (obj[prop] === null) {
                        delete_fields[prop] = "";
                        delete obj[prop];
                    }
                }
                if (Object.keys(delete_fields).length > 0) {
                    update = { $set: obj, $unset: delete_fields };
                }
            }
            update.$set.last_modified = self.getNow();
            let update_options = {};
            if (options.upsert) {
                update_options.upsert = true;
            }
            let collection = await self.getCollection(entity_name);
            let result = await collection.updateOne(query, update, update_options);
            self.onEvent("update", { entity_name, query, update: event_data, result, options });
            cb(null, result);
            return result;
        } catch (err) {
            err = new DatabaseError('updateEntityFromQuery', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Update an entity
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} id Entity id
     * @param {{}} obj Update to apply to the entity object
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    updateEntity: async (entity_name, id, obj, cb, options = {}) => {
        logger.debug("db.updateEntity", { inputs: { entity_name, id } });
        try{
            id = self.getObjectId(id);
        }catch(err){
            if (typeof cb === 'function') {
                cb(err);
                return;
            } else {
                throw err;
            }
        }
        return await self.updateEntityFromQuery(entity_name, { _id: id }, obj, cb, options);
    },

    /**
     * Delete an entity corresponding to a query
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity object to delete
     * @param {{}} options Options
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    deleteEntityFromQuery: async (entity_name, query, cb, options = {}) => {
        logger.debug("db.deleteEntityFromQuery", { inputs: { entity_name, query } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        try {
            await tracking.beforeEntityDelete(entity_name, query, options);
            let collection = await self.getCollection(entity_name);
            let result = await collection.deleteOne(query);
            self.onEvent("delete", { entity_name, query, result, options });
            cb(null, result);
            return result;
        } catch (err) {
            err = new DatabaseError('deleteEntityFromQuery', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Delete entities corresponding to a query
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entities objects to delete
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    deleteEntitiesFromQuery: async (entity_name, query, cb, options = {}) => {
        logger.debug("db.deleteEntitiesFromQuery", { inputs: { entity_name, query } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        try {
            await tracking.beforeEntitiesDelete(entity_name, query, options);
            let collection = await self.getCollection(entity_name);
            let result = await collection.deleteMany(query);
            self.onEvent("delete", { entity_name, query, result, options });
            cb(null, result);
            return result;
        } catch (err) {
            err = new DatabaseError('deleteEntitiesFromQuery', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Delete an entity
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} id Entity id
     * @param {function} cb Callback function
     * @param {{}} options Options
     */
    deleteEntity: async (entity_name, id, cb, options) => {
        logger.debug("db.deleteEntity", { inputs: { entity_name, id } });
        try{
            id = self.getObjectId(id);
        }catch(err){
            if (typeof cb === 'function') {
                cb(err);
                return;
            } else {
                throw err;
            }
        }
        return await self.deleteEntityFromQuery(entity_name, { _id: id }, cb, options);
    },

    /*** GETTERS ***/

    /**
     * Get entity corresponding to a query
     * You can specify which attributes to include or exclude using only or without list of properties
     * Property path is supported (e.g. "properties.property")
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity object
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntityFromQuery: async (entity_name, query, cb, options = { only: [], without: [] }) => {
        logger.debug("db.findEntityFromQuery", { inputs: { entity_name, query } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        try {
            let collection = await self.getCollection(entity_name);
            let item = await collection.findOne(query, { projection: self._buildProjection(options) });
            cb(null, item);
            return item;
        } catch (err) {
            err = new DatabaseError('findEntityFromQuery', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Get entity from its ID
     * You can specify which attributes to include or exclude using only or without list of properties
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} id Entity id
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntityFromID: async (entity_name, id, cb, options) => {
        logger.debug("db.findEntityFromID", { inputs: { entity_name, id } });
        try{
            id = self.getObjectId(id);
        }catch(err){
            if (typeof cb === 'function') {
                cb(err);
                return;
            } else {
                throw err;
            }
        }
        return await self.findEntityFromQuery(entity_name, { _id: id }, cb, options);
    },

    /**
     * Get entity from a given property and its value
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} property Property name
     * @param value Property value
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntityFromProperty: async (entity_name, property, value, cb, options) => {
        logger.debug("db.findEntityFromProperty", { inputs: { entity_name, property, value } });
        return await self.findEntityFromQuery(entity_name, { [property]: value }, cb, options);
    },

    /**
     * Get all entities corresponding to a db query
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {{}} query Query to find the entity objects
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntitiesFromQuery: async (entity_name, query, cb, options = {}) => {
        logger.debug("db.findEntitiesFromQuery", { inputs: { entity_name, query } });
        let throw_error = true;
        if (typeof cb === 'function') {
            throw_error = false;
        } else if (typeof cb === 'object') {
            options = cb;
            cb = () => { };
        } else {
            cb = () => { };
        }
        options.only = options.only || [];
        options.without = options.without || [];
        if (!options.sort && self.default_sort) {
            options.sort = self.default_sort;
        }
        let projection = self._buildProjection(options),
            find_options = { projection };
        if (options.sort) {
            find_options.sort = options.sort;
        }
        if(options.limit){
            find_options.limit = options.limit;
        }
        try {
            let collection = await self.getCollection(entity_name);
            let items = await collection.find(query, find_options).toArray();
            cb(null, items);
            return items;
        } catch (err) {
            err = new DatabaseError('findEntitiesFromQuery', err);
            cb(err);
            if (throw_error) {
                throw err;
            }
        }
    },

    /**
     * Get entity list from an id list
     * @param entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {[]} id_list List of ids
     * @param {function} cb Callback function
     * @param options Query options
     */
    findEntitiesFromIdList: async (entity_name, id_list, cb, options) => {
        logger.debug("db.findEntitiesFromIdList", { inputs: { entity_name, id_list } });
        let object_id_list = [];
        try{
            for (let id of id_list) {
                object_id_list.push(self.getObjectId(id));
            }
        }catch(err){
            if (typeof cb === 'function') {
                cb(err);
                return;
            } else {
                throw err;
            }
        }
        return await self.findEntitiesFromPropertyValues(entity_name, '_id', object_id_list, cb, options);
    },

    /**
     * List all entities
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findAllEntities: async (entity_name, cb, options) => {
        logger.debug("db.findAllEntities", { inputs: entity_name });
        return await self.findEntitiesFromQuery(entity_name, {}, cb, options);
    },

    /**
     * Get all entities from a given property and its value
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} property Property name
     * @param value Property value
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntitiesFromProperty: async (entity_name, property, value, cb, options) => {
        logger.debug("db.findEntitiesFromProperty", { inputs: { entity_name, property, value } });
        return await self.findEntitiesFromQuery(entity_name, { [property]: value }, cb, options);
    },

    /**
     * Get all entities from a given property and a value list
     * @param {string} entity_name Entity name (e.g. 'beacon', 'tracker', 'device', ...)
     * @param {string} property Property name
     * @param {[]} value_list List of values
     * @param {function} cb Callback function
     * @param {{}} options Options (e.g. { only: ["name", "properties.property"], without: ["_id"] })
     */
    findEntitiesFromPropertyValues: async (entity_name, property, value_list, cb, options) => {
        logger.debug("db.findEntitiesFromProperty", { inputs: { entity_name, property, value_list } });
        return await self.findEntitiesFromQuery(entity_name, { [property]: { $in: value_list } }, cb, options);
    }

}

module.exports = self;