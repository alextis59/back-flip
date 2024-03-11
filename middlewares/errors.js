class AccessDeniedError extends Error {
    constructor(info = '') {
        let msg = `Access denied`;
        if (info) {
            msg += ` - ${info}`;
        }
        super(msg);
        this.name = 'AccessDeniedError';
    }
}

class EntityNotFoundError extends Error {
    constructor(entity_type, info = '') {
        let msg = `${entity_type} not found`;
        if (info) {
            msg += ` - ${info}`;
        }
        super(msg);
        this.name = 'EntityNotFoundError';
    }
}

class InvalidModelAttributeError extends Error {
    constructor(attribute, info = '') {
        let msg = `Invalid attribute: ${attribute}`;
        if (info) {
            msg += ` - ${info}`;
        }
        super(msg);
        this.name = 'InvalidModelAttributeError';
    }
}

class MissingModelAttributeError extends Error {
    constructor(attribute, info = '') {
        let msg = `Missing attribute: ${attribute}`;
        if (info) {
            msg += ` - ${info}`;
        }
        super(msg);
        this.name = 'MissingModelAttributeError';
    }
}

class InvalidParameterError extends Error {
    constructor(parameter_name, info = '') {
        let msg = `Invalid parameter: ${parameter_name}`;
        if (info) {
            msg += ` - ${info}`;
        }
        this.name = 'InvalidParameterError';
    }
}

class MissingParameterError extends Error {
    constructor(parameter_name, info = '') {
        let msg = `Missing parameter: ${parameter_name}`;
        if (info) {
            msg += ` - ${info}`;
        }
        this.name = 'MissingParameterError';
    }
}



module.exports = {
    AccessDeniedError,
    EntityNotFoundError,
    InvalidModelAttributeError,
    MissingModelAttributeError,
    InvalidParameterError,
    MissingParameterError
}