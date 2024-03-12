const _ = require('lodash'),
    utils = require('side-flip/utils');

function isRouter(obj){
    return obj && obj.toString && obj.toString().includes('function router');
}

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

        function processArgs(...args){
            let processed_args = [],
                current_middleware_list = [];
            for (let arg of args) {
                if(typeof arg !== 'function' && current_middleware_list.length){
                    processed_args.push(self.asyncWrap(current_middleware_list));
                    current_middleware_list = [];
                }
                if(typeof arg === 'string' || isRouter(arg)){
                    processed_args.push(arg);
                }else if(typeof arg === 'function'){
                    current_middleware_list.push(arg);
                }else{
                    processed_args.push(arg);
                }
            }
            if(current_middleware_list.length){
                processed_args.push(self.asyncWrap(current_middleware_list));
            }
            return processed_args;
        }

        router.use = (...args) => {
            _use.call(router, ...processArgs(...args));
        }

        router.get = (...args) => {
            _get.call(router, ...processArgs(...args));
        }

        router.post = (...args) => {
            _post.call(router, ...processArgs(...args));
        }

        router.put = (...args) => {
            _put.call(router, ...processArgs(...args));
        }

        router.delete = (...args) => {
            _delete.call(router, ...processArgs(...args));
        }

        return router;

    }

}

module.exports = self;