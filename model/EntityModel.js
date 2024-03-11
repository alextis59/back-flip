const _ = require('lodash');

class EntityModel {

    constructor(entity_type, options = {}) {
        this.entity = entity_type;
        this.entities = options.entities || entity_type + 's';
        this.model = _.cloneDeep(options.model || {});
        this.model._model_root = true;
        this.permissions = options.permissions || {};
        this.required_at_creation = options.required_at_creation;
        this.add_at_creation = options.add_at_creation;
        this.reject_on_unauthorized_parameter = options.reject_on_unauthorized_parameter;
    }

    getRequestModel = (req, res, next) => {
        res.locals.entity_model = this;
        next();
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

module.exports = EntityModel;