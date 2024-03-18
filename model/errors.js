const {
    HttpError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    TooManyRequestsError,
    InternalServerError,
    ServiceNotAvailableError
} = require('./error/http_errors');

function fillJson(json, data){
    if(typeof data === 'object'){
        Object.assign(json, data);
    }else{
        json.data = data;
    }
}

class AccessDeniedError extends ForbiddenError {

    constructor(reason, data) {
        let msg = `Access denied`;
        if (reason) {
            msg += ` - ${reason}`;
        }
        let json = fillJson({reason}, data);
        super(msg, json);
    }

}

class NotAuthenticatedError extends UnauthorizedError {

    constructor(data) {
        let msg = `Not authenticated`,
            json = fillJson({}, data);
        super(msg, json);
        this.name = 'NotAuthenticatedError';
    }

}

class UserLockedError extends TooManyRequestsError {

    constructor(data) {
        let msg = `User locked`,
            json = fillJson({}, data);
        super(msg, json);
        this.name = 'UserLockedError';
    }

}

class EntityNotFoundError extends NotFoundError {

    constructor(entity_type, data) {
        let msg = `${entity_type} not found`,
            json = fillJson({entity_type}, data);
        super(msg, json);
        this.name = 'EntityNotFoundError';
    }

}

class EntityAlreadyExistsError extends ConflictError {

    constructor(entity_type, data) {
        let msg = `${entity_type} already exists`,
            json = fillJson({entity_type}, data);
        super(msg, json);
    }

}

class InvalidEntityError extends BadRequestError {

    constructor(entity_type, data) {
        let msg = `Invalid entity: ${entity_type}`,
            json = fillJson({entity_type}, data);
        super(msg, json);
        this.name = 'InvalidEntityError';
    }

}

class InvalidModelAttributeError extends BadRequestError {

    constructor(attribute, data) {
        let msg = `Invalid attribute: ${attribute}`,
            json = fillJson({attribute}, data);
        super(msg, json);
        this.name = 'InvalidModelAttributeError';
    }

}

class MissingModelAttributeError extends BadRequestError {

    constructor(attribute, data) {
        let msg = `Missing attribute: ${attribute}`,
            json = fillJson({attribute}, data);
        super(msg, json);
        this.name = 'MissingModelAttributeError';
    }

}

class InvalidParameterError extends BadRequestError {

    constructor(parameter, data) {
        let msg = `Invalid parameter: ${parameter}`,
            json = fillJson({parameter}, data);
        super(msg, json);
        this.name = 'InvalidParameterError';
    }

}

class MissingParameterError extends BadRequestError {

    constructor(parameter, data) {
        let msg = `Missing parameter: ${parameter}`,
            json = fillJson({parameter}, data);
        super(msg, json);
        this.name = 'MissingParameterError';
    }

}

class ActionNotAllowedError extends BadRequestError {

    constructor(action, data) {
        let msg = `Action not allowed: ${action}`,
            json = fillJson({action}, data);
        super(msg, json);
        this.name = 'ActionNotAllowedError';
    }

}

class DatabaseError extends InternalServerError {

    constructor(function_name, err) {
        let msg = `Database error: ${message}`,
            json = fillJson({function_name}, err);
        super(msg, json);
        this.name = 'DatabaseError';
        this.original_error = err;
    }

}

class PublisherError extends InternalServerError {
    constructor(function_name, err) {
        let msg = `Publisher error: ${function_name}`,
            json = fillJson({function_name}, err);
        super(msg, json);
        this.name = 'PublisherError';
        this.original_error = err;
    }
}

class ServiceHealthError extends ServiceNotAvailableError {
    constructor(function_name, err) {
        let msg = `Service health error: ${function_name}`,
            json = fillJson({function_name}, err);
        super(msg, json);
        this.name = 'ServiceHealthError';
        this.original_error = err;
    }
}

module.exports = {
    AccessDeniedError,
    NotAuthenticatedError,
    UserLockedError,
    EntityNotFoundError,
    EntityAlreadyExistsError,
    InvalidEntityError,
    InvalidModelAttributeError,
    MissingModelAttributeError,
    InvalidParameterError,
    MissingParameterError,
    ActionNotAllowedError,
    DatabaseError,
    PublisherError,
    ServiceHealthError
}