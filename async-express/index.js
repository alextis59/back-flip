const _ = require('lodash'),
    utils = require('side-flip/utils');

const self = {

    /**
     * Wrapper to handle both async and sync middlewares
     * Call next with errors caught in async middlewares
     * @param  {...any} middlewares 
     * @returns 
     */
    asyncWrap: (...middlewares) => {
        return async (req, res, next) => {
            try {
                let middleware_list = [];
                for (let middleware of middlewares) {
                    if(typeof middleware === 'function'){
                        middleware_list.push(middleware);
                    }else if(_.isArray(middleware)){
                        middleware_list = middleware_list.concat(middleware);
                    }
                }
                for (let middleware of middleware_list) {
                    let mdw_error = null;
                    let next_mdw = (err) => {
                        mdw_error = err;
                    }
                    if (utils.isAsyncFunction(middleware)) {
                        await middleware(req, res, next_mdw);
                    } else {
                        let err = await utils.toAsync(middleware)(req, res);
                        if (err) {
                            mdw_error = err;
                        }
                    }
                    if (mdw_error) {
                        throw mdw_error;
                    }
                }
                next();
            } catch (error) {
                next(error);
            }
        }
    },

    asyncRouter: (router) => {

        let _use = router.use,
            _get = router.get,
            _post = router.post,
            _put = router.put,
            _delete = router.delete;

        router.use = (...args) => {
            let first_arg = args.shift();
            if(typeof first_arg === 'string'){
                _use.call(router, first_arg, self.asyncWrap(args));
            }else{
                args.unshift(first_arg);
                _use.call(router, self.asyncWrap(args));
            }
        }

        router.get = (...args) => {
            let first_arg = args.shift();
            if(typeof first_arg === 'string'){
                _get.call(router, first_arg, self.asyncWrap(args));
            }else{
                args.unshift(first_arg);
                _get.call(router, self.asyncWrap(args));
            }
        }

        router.post = (...args) => {
            let first_arg = args.shift();
            if(typeof first_arg === 'string'){
                _post.call(router, first_arg, self.asyncWrap(args));
            }else{
                args.unshift(first_arg);
                _post.call(router, self.asyncWrap(args));
            }
        }

        router.put = (...args) => {
            let first_arg = args.shift();
            if(typeof first_arg === 'string'){
                _put.call(router, first_arg, self.asyncWrap(args));
            }else{
                args.unshift(first_arg);
                _put.call(router, self.asyncWrap(args));
            }
        }

        router.delete = (...args) => {
            let first_arg = args.shift();
            if(typeof first_arg === 'string'){
                _delete.call(router, first_arg, self.asyncWrap(args));
            }else{
                args.unshift(first_arg);
                _delete.call(router, self.asyncWrap(args));
            }
        }

        return router;

    }

}

module.exports = self;