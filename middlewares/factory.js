const _ = require('lodash'),
    utils = require('side-flip/utils'),
    model = require('../model'),
    log = require('../log'),
    generic = require('./generic');

const self = {

    GENERIC_CRUD_MIDDLEWARES: {
        GET: [generic.checkRequestAccessRight, generic.getFromID, generic.checkEntityAccessRight, generic.format, generic.send],
        POST: [generic.checkRequestAccessRight, generic.getRequestAttributes, generic.checkRequestAttributes, generic.processAttributes, generic.checkEntityAccessRight, generic.createEntity],
        PUT: [generic.checkRequestAccessRight, generic.getFromID, generic.checkEntityAccessRight, generic.getRequestAttributes, generic.checkRequestAttributes, generic.processAttributes, generic.updateEntity],
        DELETE: [generic.checkRequestAccessRight, generic.getFromID, generic.checkEntityAccessRight, generic.deleteEntity]
    },

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
        for(let middleware of middlewares_list){
            await utils.toAsync(middleware)(req, res);
        }
    },

    /**
     * Handles CRUD operations for a given entity type by executing a sequence of middlewares.
     * @param {string} entity_type - The entity type.
     * @returns {function} A middleware function that handles CRUD operations for the specified entity type.
     */
    crudHandling: (entity_type, target) => {
        const middlewares = [model.getRequestModel(entity_type)];
        return function (req, res, next) {
            const exec_middlewares = middlewares.concat(factory.GENERIC_CRUD_MIDDLEWARES[req.method]);
            factory.executeMiddlewares(req, res, next, exec_middlewares);
        }
    },

}

module.exports = self;