function handleErrorData(error, data){
    if(data){
        if(typeof data === 'object'){
            Object.assign(error.json, data);
        }else{
            error.json.data = data;
        }
    }
}

class AccessDeniedError extends Error {
    constructor(reason, data) {
        let msg = `Access denied`;
        if (reason) {
            msg += ` - ${reason}`;
        }
        super(msg);
        this.name = 'AccessDeniedError';
        this.json = {
            error: this.name,
            message: msg,
            reason: reason
        }
        handleErrorData(this, data);
    }
}

class NotAuthenticatedError extends Error {
    constructor(data) {
        let msg = `Not authenticated`;
        super(msg);
        this.name = 'NotAuthenticatedError';
        this.json = {
            error: this.name,
            message: msg
        }
        handleErrorData(this, data);
    }
}

class UserLockedError extends Error {
    constructor(data) {
        let msg = `User locked`;
        super(msg);
        this.name = 'UserLockedError';
        this.json = {
            error: this.name,
            message: msg
        }
        handleErrorData(this, data);
    }
}

class EntityNotFoundError extends Error {
    constructor(entity_type, data) {
        let msg = `${entity_type} not found`;
        super(msg);
        this.name = 'EntityNotFoundError';
        this.json = {
            error: this.name,
            message: msg,
            entity_type: entity_type
        }
        handleErrorData(this, data);
    }
}

class InvalidModelAttributeError extends Error {
    constructor(attribute, data) {
        let msg = `Invalid attribute: ${attribute}`;
        super(msg);
        this.name = 'InvalidModelAttributeError';
        this.json = {
            error: this.name,
            message: msg,
            attribute: attribute
        }
        handleErrorData(this, data);
    }
}

class MissingModelAttributeError extends Error {
    constructor(attribute, data) {
        let msg = `Missing attribute: ${attribute}`;
        super(msg);
        this.name = 'MissingModelAttributeError';
        this.json = {
            error: this.name,
            message: msg,
            attribute: attribute
        }
        handleErrorData(this, data);
    }
}

class InvalidParameterError extends Error {
    constructor(parameter_name, data) {
        let msg = `Invalid parameter: ${parameter_name}`;
        super(msg);
        this.name = 'InvalidParameterError';
        this.json = {
            error: this.name,
            message: msg,
            parameter_name: parameter_name
        }
        handleErrorData(this, data);
    }
}

class MissingParameterError extends Error {
    constructor(parameter_name, data) {
        let msg = `Missing parameter: ${parameter_name}`;
        super(msg);
        this.name = 'MissingParameterError';
        this.json = {
            error: this.name,
            message: msg,
            parameter_name: parameter_name
        }
        handleErrorData(this, data);
    }
}

class ActionNotAllowedError extends Error {
    constructor(action, data) {
        let msg = `Action not allowed: ${action}`;
        super(msg);
        this.name = 'ActionNotAllowedError';
        this.json = {
            error: this.name,
            message: msg,
            action: action
        }
        handleErrorData(this, data);
    }
}

class DatabaseError extends Error {
    constructor(message, err) {
        let msg = `Database error: ${message}`;
        super(msg);
        this.name = 'DatabaseError';
        this.original_error = err;
        this.json = {
            error: this.name,
            message: msg,
            original_error: err
        }
    }
}

class PublisherError extends Error {
    constructor(message, err) {
        let msg = `Publisher error: ${message}`;
        super(msg);
        this.name = 'PublisherError';
        this.original_error = err;
        this.json = {
            error: this.name,
            message: msg,
            original_error: err
        }
    }
}

class ServiceHealthError extends Error {
    constructor(message, err) {
        let msg = `Service health error: ${message}`;
        super(msg);
        this.name = 'ServiceHealthError';
        this.original_error = err;
        this.json = {
            error: this.name,
            message: msg,
            original_error: err
        }
    }
}

module.exports = {
    AccessDeniedError,
    NotAuthenticatedError,
    UserLockedError,
    EntityNotFoundError,
    InvalidModelAttributeError,
    MissingModelAttributeError,
    InvalidParameterError,
    MissingParameterError,
    ActionNotAllowedError,
    DatabaseError,
    PublisherError,
    ServiceHealthError
}