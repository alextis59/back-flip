const _ = require('lodash'),
    EntityModel = require('./EntityModel');

class EntityHandler {

    constructor(entity_type, options = {}) {
        this.entity = entity_type;
        this.entities = options.entities_target || entity_type + 's';
        this.model = new EntityModel(options.model);
        this.permissions = options.permissions || {};
        this.required_at_creation = options.required_at_creation;
        this.add_at_creation = options.add_at_creation;
        this.reject_on_unauthorized_parameter = options.reject_on_unauthorized_parameter;
    }

    loadRequestEntity = (req, res, next) => {
        res.locals.entity_handler = this;
        next();
    }

    getModel = () => {
        return this.model.getModel();
    }

    verifyAgainstModel = (object) => {
        this.model.verifyAgainstModel(object);
    }

    setAttributesProcessingMdw(mdw) {
        this.attributesProcessingMdw = mdw;
    }

    setAttributesFormattingMdw(mdw) {
        this.attributesFormattingMdw = mdw;
    }

    setSpecialAccessGrantMdw(mdw) {
        this.specialAccessGrantMdw = mdw;
    }

    setCustomFilterMdw(mdw) {
        this.customFilterMdw = mdw;
    }

}

module.exports = EntityHandler;