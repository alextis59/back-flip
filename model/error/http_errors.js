

class HttpError extends Error {

    constructor(message, code, json) {
        super(message);
        this.code = code;
        this.name = "HttpError"
        this.json = json;
    }

}

class BadRequestError extends HttpError {

    constructor(message, json) {
        super(message, 400, json);
        this.name = "BadRequestError";
    }

}

class UnauthorizedError extends HttpError {

    constructor(message, json) {
        super(message, 401, json);
        this.name = "UnauthorizedError";
    }

}

class ForbiddenError extends HttpError {

    constructor(message, json) {
        super(message, 403, json);
        this.name = "ForbiddenError";
    }

}

class NotFoundError extends HttpError {

    constructor(message, json) {
        super(message, 404, json);
        this.name = "NotFoundError";
    }

}

class ConflictError extends HttpError {

    constructor(message, json) {
        super(message, 409, json);
        this.name = "ConflictError";
    }

}

class TooManyRequestsError extends HttpError {

    constructor(message, json) {
        super(message, 429, json);
        this.name = "TooManyRequestsError";
    }

}

class InternalServerError extends HttpError {

    constructor(message, json) {
        super(message, 500, json);
        this.name = "InternalServerError";
    }

}

class ServiceNotAvailableError extends HttpError {

    constructor(message, json) {
        super(message, 503, json);
        this.name = "ServiceNotAvailableError";
    }

}

module.exports = {
    HttpError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    TooManyRequestsError,
    InternalServerError,
    ServiceNotAvailableError
}