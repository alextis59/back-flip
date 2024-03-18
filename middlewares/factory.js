const _ = require('lodash'),
    utils = require('side-flip/utils'),
    model = require('../model'),
    log = require('../log'),
    generic = require('./generic');

const self = {

    /**
     * Executes a list of middlewares sequentially on the given request and response objects.
     * @param {Object} req - The request object.
     * @param {Object} res - The response object.
     * @param {Array} middlewares_list - The list of middlewares to be executed.
     */
    executeMiddlewares: async (req, res, ...args) => {
        middlewares_list = [];
        for (let i = 0; i < args.length; i++) {
            if (_.isArray(args[i])) {
                middlewares_list = middlewares_list.concat(args[i]);
            } else {
                middlewares_list.push(args[i]);
            }
        }
        if (middlewares_list.length === 0) {
            return;
        }
        // for (let middleware of middlewares_list) {
        //     await utils.toAsync(middleware)(req, res);
        // }
        for (let middleware of middlewares_list) {
            let mdw_error = null;
            let next_mdw = (err) => {
                mdw_error = err;
            }
            if (utils.isAsyncFunction(middleware)) {
                await middleware(req, res, next_mdw);
            } else {
                let err = await utils.toAsync(middleware)(req, res);
                if (err) {
                    mdw_error = err;
                }
            }
            if (mdw_error) {
                throw mdw_error;
            }
        }
    },

    getCheckSendEntity: (entity_type) => {
        let middlewares = [
            model.loadRequestEntity(entity_type),
            generic.checkRequestAccessRight,
            generic.getFromID,
            generic.checkEntityAccessRight,
            generic.format,
            generic.send
        ];
        return async (req, res) => {
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    getCheckSendAllEntities: (entity_type, filter) => {
        return async (req, res) => {
            let middlewares = [
                model.loadRequestEntity(entity_type),
                generic.checkRequestAccessRight,
                generic.getAll
            ];
            if (filter) {
                res.locals.filter = filter;
                middlewares.push(generic.filterEntitiesAccess);
            }
            middlewares.push(generic.format);
            middlewares.push(generic.send);
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Return a middleware function that checks and processes the creation of an entity up until database creation 
     * to allow insertion of additional processing before the entity is created.
     * @param {string} entity_type 
     * @returns {function} A middleware function that checks and processes the creation of an entity.
     */
    checkAndProcessEntityCreate: (entity_type, save_in_database = true) => {
        let middlewares = [
            model.loadRequestEntity(entity_type),
            generic.checkRequestAccessRight,
            generic.getRequestAttributes,
            generic.checkRequestAttributes,
            generic.processAttributes
        ];
        if (save_in_database) {
            middlewares.push(generic.createEntity);
        }
        return async (req, res) => {
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Return a middleware function that checks and processes the update of an entity up until database update
     * to allow insertion of additional processing before the entity is updated.
     * @param {string} entity_type 
     * @returns {function} A middleware function that checks and processes the update of an entity.
     */
    checkAndProcessEntityUpdate: (entity_type, save_in_database = true) => {
        let middlewares = [
            model.loadRequestEntity(entity_type),
            generic.checkRequestAccessRight,
            generic.getFromID,
            generic.checkEntityAccessRight,
            generic.getRequestAttributes,
            generic.checkRequestAttributes,
            generic.processAttributes
        ];
        if (save_in_database) {
            middlewares.push(generic.updateEntity);
        }
        return async (req, res) => {
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Return a middleware function that checks and processes the deletion of an entity up until database deletion
     * to allow insertion of additional processing before the entity is deleted.
     * @param {string} entity_type
     * @returns {function} A middleware function that checks and processes the deletion of an entity.
     */
    checkAndProcessEntityDelete: (entity_type, save_in_database = true) => {
        let middlewares = [
            model.loadRequestEntity(entity_type),
            generic.checkRequestAccessRight,
            generic.getFromID,
            generic.checkEntityAccessRight
        ];
        if (save_in_database) {
            middlewares.push(generic.deleteEntity);
        }
        return async (req, res) => {
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Generates a middleware for loading the entity model based on the specified entity type.
     * @param {string} entity_type - The type of the entity to be loaded.
     * @returns {function} A middleware function that loads the entity model.
     */
    loadEntityModel: (entity_type) => {
        return async (req, res) => {
            let request_entity = entity_type === "request_entity" ? req.params.entity : entity_type;
            await model.loadRequestEntity(request_entity)(req, res);
        }
    },

    /**
     * Executes a list of middlewares in sequence to get the entity from its ID.
     * @param {string} entity_type - The type of entity to be retrieved.
     * @param {Object} filter - The filter object used to restrict access to the entity.
     * @returns {function} A middleware function that executes the necessary middlewares to retrieve the entity from its ID.
     */
    getEntityFromID: (entity_type, filter) => {
        return async (req, res) => {
            let request_entity = entity_type === "request_entity" ? req.params.entity : entity_type;
            let middlewares = [
                model.loadRequestEntity(request_entity),
                generic.getFromID
            ];
            if (filter) {
                res.locals.filter = filter;
                middlewares.push(generic.filterEntityAccess);
            }
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Generates a middleware function that checks if a user has access to a given entity.
     * @param {string} entity_type - The entity type to check access for.
     * @returns {function} A middleware function that checks access and executes a list of middlewares if allowed.
     */
    checkEntityAccess: (entity_type) => {
        return async (req, res) => {
            await self.executeMiddlewares(req, res, model.loadRequestEntity(entity_type), generic.checkEntityAccessRight);
        }
    },

    /**
     * Generates a middleware function that checks if a user has access to given entities.
     * @param {string} entity_type - The entity type to be checked.
     * @returns {Function} A middleware function that checks the access rights for the given entity type.
     */
    checkEntitiesAccess: (entity_type) => {
        return async (req, res) => {
            await self.executeMiddlewares(req, res, model.loadRequestEntity(entity_type), generic.checkEntitiesAccessRight);
        }
    },

    /**
     * Generates a middleware function to handle entity access based on the given entity and filter.
     * @param {string} entity_type - The entity type to be checked for access.
     * @param {Object} filter - The filter object to be applied to the entity.
     * @returns {Function} A middleware function that handles entity access.
     */
    getAndCheckEntityAccess: (entity_type, filter) => {
        return async (req, res) => {
            log.debug("FactoryMiddleware - getAndCheckEntityAccess : " + entity_type);
            let request_entity = entity_type === "request_entity" ? req.params.entity : entity_type;
            log.debug("Request entity : " + request_entity);
            let middlewares = [
                model.loadRequestEntity(request_entity),
                generic.getFromID,
                generic.checkEntityAccessRight
            ];
            if (filter) {
                res.locals.filter = filter;
                middlewares.push(generic.filterEntityAccess);
            }
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Generates a middleware that gets and checks entities access based on the specified entity type.
     * @param {string} entity_type - The entity type to be checked.
     * @param {Object} filter - The filter object or function to be applied to the entities.
     * @returns {function} - The middleware function that gets and checks entities access.
     */
    getAndCheckEntitiesAccess: (entity_type, filter) => {
        return async (req, res) => {
            log.debug("FactoryMiddleware - getAndCheckEntitiesAccess : " + entity_type);
            let request_entity = entity_type === "request_entity" ? req.params.entity : entity_type;
            log.debug("Request entity : " + request_entity);
            let middlewares = [model.loadRequestEntity(request_entity), generic.getEntitiesFromID, generic.checkEntitiesAccessRight];
            if (filter) {
                res.locals.filter = filter;
                middlewares.push(generic.filterEntitiesAccess);
            }
            await self.executeMiddlewares(req, res, middlewares);
        }
    },

    /**
     * Generates a middleware function to get all entities of the specified type.
     * @param {string} entity_type - The type of entity to retrieve.
     * @param {boolean} format - Specifies whether the retrieved entities should be formatted according to the specified model and requestor/user.
     * @param {object} filter - The filter to be applied to the retrieved entities.
     * @returns {function} A middleware function to get all entities of the specified type.
     */
    getAllEntities: (entity_type, format, filter) => {
        return async (req, res) => {
            const middlewares = [
                model.loadRequestEntity(entity_type),
                generic.getAll
            ];
            if (filter) {
                res.locals.filter = filter;
                middlewares.push(generic.filterEntitiesAccess);
            }
            if (format) {
                middlewares.push(generic.format);
            }
            await self.executeMiddlewares(req, res, middlewares);
        }
    }

}

module.exports = self;