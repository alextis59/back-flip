const _ = require('lodash'),
    utils = require('side-flip/utils'),
    { InvalidModelAttributeError } = require('./errors');

class EntityModel {

    constructor(model) {
        this.model = _.cloneDeep(model || {});
        this.model._model_root = true;
    }

    getModel = () => {
        return this.model;
    }

    getModelClone = (as_submodel) => {
        let clone = _.cloneDeep(this.model);
        if(as_submodel){
            delete clone._model_root;
        }
        return clone;
    }

    /**
     * Retrieves a specific target from the model.
     * @param {object} model - The model to retrieve the target from.
     * @param {string} target - The target to retrieve from the model.
     * @returns {object} The retrieved target from the model or null if the target does not exist.
     */
    getModelTarget = (target) => {
        let target_hierarchy = target.split("."), current_model_target = this.model;
        for (let i = 0; i < target_hierarchy.length; i++) {
            let next_target = target_hierarchy[i],
                next_model_target = current_model_target._model_root
                    ? _.get(current_model_target, next_target)
                    : _.get(current_model_target, 'properties.each_prop', _.get(current_model_target, 'properties.' + next_target));
            if (!next_model_target) {
                return null;
            } else {
                current_model_target = next_model_target;
            }
        }
        return current_model_target;
    }

    verifyAgainstModel = (object) => {
        this.verifyModelObject(object, this.model);
    }

    verifyModelValue = (value, model, name = "value") => {
        if (!utils.checkVar(value, model.type, model.control)){
            throw new InvalidModelAttributeError(name, "Invalid value");
        }
        if (model.type === "object" && model.properties) {
            this.verifyModelObject(value, model.properties, name);
        } else if (model.type === "array" && model.items) {
            this.verifyModelArray(value, model.items, name);
        }
    }

    verifyModelObject = (object, model, name) => {
        if (model.each_prop) {
            // For objects containing properties having all the same structure
            let prop_model = model.each_prop;
            for (let prop in object) {
                let target = name ? name + '.' + prop : prop;
                if (prop_model.key_control && !utils.checkVar(prop + "", "string", prop_model.key_control)){
                    throw new InvalidModelAttributeError(target, "Invalid key");
                }
                this.verifyModelValue(object[prop], prop_model, target);
            }
        } else {
            // For objects containing properties with defined key name and different structures
            for (let prop in model) {
                let value = object[prop];
                if(value !== undefined){
                    let prop_model = model[prop];
                    if(value !== null || !prop_model.allow_null){
                        this.verifyModelValue(value, prop_model, name ? name + '.' + prop : prop);
                    }
                }
            }
        }
    }

    verifyModelArray = (array, model, name = "array") => {
        for(let index in array){
            let item = array[index];
            if (!utils.checkVar(item, model.type, model.control)) {
                throw new InvalidModelAttributeError(name, "Invalid item: " + index);
            }
            if (model.type === "object" && model.properties) {
                this.verifyModelObject(item, model.properties, name + "[" + index + "]");
            } else if (model.type === "array" && model.items) {
                this.verifyModelArray(item, model.items, name + "[" + index + "]");
            }
        }
    }

}

module.exports = EntityModel;