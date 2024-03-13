const _ = require('lodash'),
    EntityModel = require('./EntityModel');

class EntityHandler {

    constructor(entity_type, options = {}) {
        this.entity = entity_type;
        this.entities = options.entities_target || entity_type + 's';
        let model = options.model || {};
        this.model = model instanceof EntityModel ? model : new EntityModel(model);
        this.permissions = options.permissions || {};
        this.body_target = options.body_target;
        this.required_at_creation = options.required_at_creation;
        this.add_at_creation = options.add_at_creation;
        this.reject_on_unauthorized_parameter = options.reject_on_unauthorized_parameter || false;
        this.entityAccessCheck = options.entityAccessCheck;
        this.attributesProcessingMdw = options.attributesProcessingMdw;
        this.attributesFormattingMdw = options.attributesFormattingMdw;
        this.customFilterMdw = options.customFilterMdw;
    }

    loadRequestEntity = (req, res, next) => {
        res.locals.entity_handler = this;
        next();
    }

    getModel = () => {
        return this.model.getModel();
    }

    getRequestPermissions = (req) => {
        return this.permissions[req.method];
    }

    setEntityAccessCheckFn(fn) {
        this.entityAccessCheck = fn;
    }

    setAttributesProcessingMdw(mdw) {
        this.attributesProcessingMdw = mdw;
    }

    setAttributesFormattingMdw(mdw) {
        this.attributesFormattingMdw = mdw;
    }

    setCustomFilterMdw(mdw) {
        this.customFilterMdw = mdw;
    }

    verifyAgainstModel = (object) => {
        this.model.verifyAgainstModel(object);
    }

}

module.exports = EntityHandler;