const {
    AccessDeniedError,
    NotAuthenticatedError,
    UserLockedError,
    EntityNotFoundError,
    InvalidEntityError,
    InvalidModelAttributeError,
    MissingModelAttributeError,
    InvalidParameterError,
    MissingParameterError,
    ActionNotAllowedError,
    DatabaseError,
    PublisherError,
    ServiceHealthError
} = require('../model/errors');

const error_response_map = [
    {error: AccessDeniedError, code: 403},
    {error: NotAuthenticatedError, code: 401},
    {error: UserLockedError, code: 423},
    {error: EntityNotFoundError, code: 404},
    {error: InvalidEntityError, code: 400},
    {error: InvalidModelAttributeError, code: 400},
    {error: MissingModelAttributeError, code: 400},
    {error: InvalidParameterError, code: 400},
    {error: MissingParameterError, code: 400},
    {error: ActionNotAllowedError, code: 400},
    {error: DatabaseError, code: 500},
    {error: PublisherError, code: 500},
    {error: ServiceHealthError, code: 503}
];

const self = {

    requestSuccess: (req, res, next) => {

        res.success = (data, options = {}) => {
            let code = 200;
            if(req.method === "POST"){
                code = 201;
            }else if(!data){
                code = 204;
            }
            if(options.override_code){
                code = options.override_code;
            }
            if(data){
                res.status(code).json(data);
            } else {
                res.sendStatus(code);
            }
        };

        return next();

    },

    knownErrors: (err, req, res, next) => {
        for(let error_map of error_response_map){
            if(err instanceof error_map.error){
                res.status(error_map.code).json(err.json);
                return;
            }
        }
        next(err);
    },

    uncaugthError: (err, req, res, next) => {
        res.status(500).json({error: 'Internal Server Error', message: err.message});
    }

}

module.exports = self;
