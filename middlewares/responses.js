const log = require('../log');

const {HttpError} = require('../model/errors');

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

    catchHttpErrors: (err, req, res, next) => {
        if(err instanceof HttpError){
            res.status(err.code).json({err: err.name, message: err.message, json: err.json});
            return;
        }
        next(err);
    },

    uncaugthError: (err, req, res, next) => {
        log.error('Uncaught error', err);
        res.status(500).json({error: 'Internal Server Error', message: err.message});
    }

}

module.exports = self;
