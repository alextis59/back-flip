const moment = require('moment'),
    _ = require('lodash'),
    utils = require('side-flip/utils'),
    model = require('../model'),
    db = require('../db'),
    mqz = require('../mqz'),
    { ObjectId } = require('mongodb'),
    log = require('../log'),
    {
        AccessDeniedError,
        EntityNotFoundError,
        MissingModelAttributeError,
        InvalidParameterError,
        MissingParameterError
    } = require('./errors');

const self = {

    requestor_object_target: 'requestor',

    setUserObjectTarget: (target) => {
        self.requestor_object_target = target;
    },

    getRequestor: (res) => {
        return res.locals[self.requestor_object_target] || {};
    },

    getCurrentEntityModel: (res) => {
        return res.locals.entity_model || {};
    },

    entityAccessCheck: async (req, res) => {},

    setEntityAccessCheck: (mdw) => {
        self.entityAccessCheck = mdw;
    },

    getAllEntitiesAccessQueryFilter: (req, res) => {
        return {};
    },

    setEntityAccessQueryFilter: (fn) => {
        self.getAllEntitiesAccessQueryFilter = fn;
    },

    /**
     * Checks the request access right based on the requestor's permissions.
     *
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    checkRequestAccessRight: async (req, res) => {
        log.debug("GenericMiddleware - checkRequestAccessRight");
        const entity_model = self.getCurrentEntityModel(res),
            permissions = _.get(entity_model, 'permissions.' + req.method),
            requestor = self.getRequestor(res);
        if (!model.isAllowed(permissions, requestor)) {
            throw new AccessDeniedError("request-permissions");
        }
    },

    checkEntityAccessRight: async (req, res) => {
        log.debug("GenericMiddleware - checkEntityAccessRight");
        try{
            await self.entityAccessCheck(req, res);
        }catch(err){
            if(err instanceof AccessDeniedError){
                const entity_model = self.getCurrentEntityModel(res);
                if (entity_model.specialAccessGrantMdw) {
                    await entity_model.specialAccessGrantMdw(req, res);
                } else {
                    throw err;
                }
            }else{
                throw err;
            }
        }
    },

    checkEntitiesAccessRight: async (req, res) => {
        const entity_model = self.getCurrentEntityModel(res),
            entity_type = entity_model.entity,
            entity_list = res.locals.entity_list;
        if (entity_list.length) {
            for (let entity of entity_list) {
                res.locals[entity_type] = entity;
                await self.checkEntityAccessRight(req, res);
            }
        }
    },

    /**
     * Middleware function to get request attributes from the request body based on access rights.
     * 
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    getRequestAttributes: async (req, res, next) => {
        log.debug("GenericMiddleware - getRequestAttributes");
        const body = req.body_target ? req.body[req.body_target] : req.body,
            entity_model = self.getCurrentEntityModel(res),
            requestor = self.getRequestor(res);
        const filtered = model.getFilteredObjectFromAccessRights(body, entity_model.model, requestor, req.method);
        if (entity_model.reject_on_unauthorized_parameter && filtered.removed.length > 0) {
            throw new AccessDeniedError();
        }
        res.locals.body_data = filtered.data;
    },

    /**
     * Middleware that checks the request body attributes against the specified model and throws an error if any required attribute is missing.
     *
     * @param {object} req - The Express request object.
     * @param {object} res - The Express response object.
     */
    checkCreationRequestAttributes: async (req, res) => {
        log.debug("GenericMiddleware - checkCreationRequestAttributes");
        const entity_model = self.getCurrentEntityModel(res),
            data = res.locals.body_data;
        // Check mandatory parameters
        const required = entity_model.required_at_creation || [];
        for (let prop of required) {
            if (prop.indexOf(" || ") > -1) {
                const split = prop.split(" || ");
                let one_exist = false;
                for (let p of split) {
                    if (data[p] != null) {
                        one_exist = true;
                    }
                }
                if (!one_exist) {
                    throw new MissingModelAttributeError(prop);
                }
            } else if (data[prop] == null) {
                throw new MissingModelAttributeError(prop);
            }
        }
    },

    /**
     * Middleware that checks the request body attributes against the specified model and throws an error if any attribute is invalid.
     *
     * @param {object} req - The Express request object.
     * @param {object} res - The Express response object.
     */
    checkRequestAttributes: async (req, res) => {
        log.debug("GenericMiddleware - checkRequestAttributes");
        const entity_model = self.getCurrentEntityModel(res),
            data = res.locals.body_data;
        model.verifyModelObject(data, entity_model.model);
    },

    /**
     * Execute the attributes processing middleware if it exists.
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    processAttributes: async (req, res) => {
        log.debug("GenericMiddleware - processAttributes");
        const entity_model = self.getCurrentEntityModel(res);
        if (entity_model.attributesProcessingMdw) {
            await entity_model.attributesProcessingMdw(req, res);
        }
    },

    /**
     * Middleware function to create a new entity in the database.
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    createEntity: async (req, res) => {
        const entity_model = self.getCurrentEntityModel(res),
            requestor = self.getRequestor(res),
            entity_type = entity_model.entity,
            data = res.locals.body_data;
        log.debug("GenericMiddleware - createEntity : " + entity_type);
        if (entity_model.add_at_creation) {
            for (let prop in entity_model.add_at_creation) {
                if(data[prop] === undefined){
                    data[prop] = entity_model.add_at_creation[prop];
                }
            }
        }
        let db_data = _.cloneDeep(data);
        for (let prop in db_data) {
            if(entity_model.model[prop] && entity_model.model[prop].do_not_save){
                delete db_data[prop];
            }
        }
        let result = await db.createEntity(entity_type, db_data, { requestor_id: requestor.id, publish_update: true });
        res.success({ id: result.insertedIds[0].toString() });
    },

    /**
     * Middleware function for updating an entity in the database.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    updateEntity: async (req, res) => {
        log.debug("GenericMiddleware - updateEntity : " + req.entity);
        const entity_model = self.getCurrentEntityModel(res),
            requestor = self.getRequestor(res),
            id = res.locals[entity_type]._id,
            entity_type = entity_model.entity,
            data = res.locals.body_data;
        if (Object.keys(data).length === 0) {
            if (res.locals.do_not_throw_empty_update) {
                return res.success();
            } else {
                throw new InvalidParameterError("body", "body is empty");
            }
        }
        let db_data = _.cloneDeep(data);
        for (let prop in db_data) {
            if(entity_model.model[prop] && entity_model.model[prop].do_not_save){
                delete db_data[prop];
            }
        }
        await db.updateEntity(entity_type, id, db_data, { requestor_id: requestor.id, publish_update: true });
        res.success();
    },

    /**
     * Middleware function to update multiple entities in the database.
     * @param {object} req - Express request object.
     * @param {object} res - Express response object.
     */
    updateEntities: async (req, res) => {
        log.debug("GenericMiddleware - updateEntities : " + req.entity);
        const entity_type = self.getCurrentEntityModel(res).entity,
            entity_list = res.locals.entity_list;
        if (req.entity_list.length === 0) {
            return res.success();
        }
        let on_success = res.success;
        res.locals.do_not_throw_empty_update = true;
        res.success = () => {};
        for(let index in entity_list){
            res.locals[entity_type] = entity_list[index];
            res.locals.body_data = res.locals.update_list[index];
            await self.updateEntity(req, res);
        }
        on_success();
    },

    /**
     * Middleware for deleting an entity from the database and publishing the delete action through MQZ.
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    deleteEntity: async (req, res) => {
        log.debug("GenericMiddleware - delete");
        const entity_type = self.getCurrentEntityModel(res).entity,
            requestor = self.getRequestor(res),
            id = id = res.locals[entity_type]._id;
        await db.deleteEntity(entity_type, id, { requestor_id: requestor.id, publish_update: true });
        res.success();
    },

    /**
     * Retrieves query options for a given entity type based on the user's access rights and query parameters.
     *
     * @param {string} entity_type - The type of entity to retrieve query options for.
     * @param {object} user - The user object to use for access rights.
     * @param {object} query - The query parameters to be used for retrieving options.
     * @returns {object} An object containing the query options, including "only" and "without" properties.
     */
    getQueryOptions: (entity_type, user, query) => {
        let options = {},
            reqOnly = _.filter(_.get(query, 'only', '').split(','), item => !!item),
            reqWithout = _.filter(_.get(query, 'without', '').split(','), item => !!item),
            defaultOnly = model.getAllowedPropertiesRetrievalOnEntity(entity_type, user);
        if(reqOnly.length){
            options.only = reqOnly;
        }else if(!reqWithout.length && defaultOnly.length){
            options.only = defaultOnly;
        }
        if(reqWithout.length){
            options.without = reqWithout;
        }
        return options;
    },

    /**
     * Middleware for retrieving all entities of a given type
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    getAll: async (req, res) => {
        log.debug("GenericMiddleware - getAll : " + req.entity);
        const entity_model = self.getCurrentEntityModel(res),
            entity_type = entity_model.entity,
            requestor = self.getRequestor(res),
            query = self.getAllEntitiesAccessQueryFilter(req, res),
            options = self.getQueryOptions(entity_type, requestor, req.query);
        let entities = await db.findEntitiesFromQuery(entity_type, query, req.method === 'GET' ? options : undefined);
        res.locals[entity_model.entities] = entities;
        res.locals.entity_list = entities;
        if(entity_model.customFilterMdw){
            await entity_model.customFilterMdw(req, res);
        }
    },

    /**
     * Middleware for retrieving an entity from its ID.
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    getFromID: async (req, res) => {
        const entity_model = self.getCurrentEntityModel(res),
            entity_type = entity_model.entity,
            requestor = self.getRequestor(res),
            id = req.params[entity_type + "_id"] || req.params["entity_id"] || req.body[entity_type + "_id"] || req.body["entity_id"],
            options = generic.getQueryOptions(entity_type, requestor, req.query);
        log.debug(`GenericMiddleware - getFromID ==> ${entity_type} : ${id} (only: ${options.only}, without: ${options.without})`);
        let entity = await db.findEntityFromID(entity_type, id, req.method === 'GET' ? options : undefined);
        if(entity){
            res.locals[entity_type] = entity;
            if(entity_model.customFilterMdw){
                await entity_model.customFilterMdw(req, res);
            }
        }else{
            throw new EntityNotFoundError(entity_type, id);
        }
    },

     /**
     * Middleware to retrieve entities from a given list of IDs
     * @param {object} req - The request object
     * @param {object} res - The response object
     */
     getEntitiesFromID: async (req, res) => {
        const entity_model = self.getCurrentEntityModel(res),
            entity_type = entity_model.entity,
            requestor = self.getRequestor(res),
            id_list = req.body[entity_type + '_ids'] || req.body['entity_ids'] || [],
            options = generic.getQueryOptions(entity_type, requestor, req.query);
        if (id_list.length === 0) {
            throw new MissingParameterError(entity_type + '_ids');
        }
        log.debug(`GenericMiddleware - getEntitiesFromID ==> ${entity_type} : ${id_list} (only: ${options.only}, without: ${options.without})`);
        let entities = await db.findEntitiesFromIdList(entity_type, id_list, req.method === 'GET' ? options : undefined);
        if(!entities || entities.length !== id_list.length){
            throw new EntityNotFoundError(entity_type);
        }
        res.locals[entity_model.entities] = entities;
        res.locals.entity_list = entities;
        if(entity_model.customFilterMdw){
            await entity_model.customFilterMdw(req, res);
        }
    },

    /**
     * Middleware function to filter entity access based on control criteria.
     *
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    filterEntityAccess: async (req, res) => {
        log.debug("GenericMiddleware - filterEntityAccess");
        const entity_type = self.getCurrentEntityModel(res).entity,
            requestor = self.getRequestor(res),
            entity = res.locals[entity_type],
            filter = res.locals.filter;
        if(typeof filter === 'function'){
            if(!(await filter(entity, requestor))){
                throw new AccessDeniedError();
            }
        }else if(!utils.entityMatchQuery){
            throw new AccessDeniedError();
        }
    },

    /**
     * Middleware for filtering entities based on the specified control criteria.
     *
     * @param {object} req - The HTTP request object.
     * @param {object} res - The HTTP response object.
     */
    filterEntitiesAccess: async (req, res) => {
        log.debug("GenericMiddleware - filterEntitiesAccess");
        const entities_type = self.getCurrentEntityModel(res).entities,
            requestor = self.getRequestor(res),
            entities = res.locals[entities_type] || res.locals.entity_list || [],
            filter = res.locals.filter,
            filtered = [];
        for(let entity of entities){
            if(typeof filter === 'function'){
                if(await filter(entity, requestor)){
                    filtered.push(entity);
                }
            }else if(utils.entityMatchQuery(entity, filter)){
                filtered.push(entity);
            }
        }
        res.locals[entities_type] = filtered;
        res.locals.entity_list = filtered;
    },

    /**
     * Formats the entity or entities data in the request object according to the specified model and user access rights.
     * @param {object} req - The request object.
     * @param {object} res - The response object.
     */
    format: async (req, res) => {
        log.debug("GenericMiddleware - format");
        const entity_model = self.getCurrentEntityModel(res),
            entity_type = entity_model.entity,
            entities_type = entity_model.entities,
            requestor = self.getRequestor(res);
        if(res.locals[entities_type]){
            for(let index in res.locals[entities_type]){
                res.locals[entities_type][index] = model.getFilteredEntityDataForUser(res.locals[entities_type][index], entity_model.model, requestor, "GET");
            }
        }else if(res.locals[entity_type]){
            res.locals[entity_type] = model.getFilteredEntityDataForUser(res.locals[entity_type], entity_model.model, requestor, "GET");
        }
        if(entity_model.attributesFormattingMdw){
            await entity_model.attributesFormattingMdw(req, res);
        }
    },

    /**
     * Sends a successful response with data based on the request entity type.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     */
    send: async (req, res) => {
        log.debug("GenericMiddleware - send");
        const entity_model = self.getCurrentEntityModel(res),
            entity_type = entity_model.entity,
            entities_type = entity_model.entities,
            data = {};
        if (res.locals[entities_type]) {
            data[entities_type] = res.locals[entities_type];
        } else if (res.locals[entity_type]) {
            data[entity_type] = res.locals[entity_type];
        }
        res.success(data);
    },

    /**
     * Clears the body_data property from the res object.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     * @returns {undefined}
     */
    clearBodyData: async (req, res) => {
        log.debug("GenericMiddleware - clearBodyData");
        delete res.locals.body_data;
    }

}

module.exports = self;