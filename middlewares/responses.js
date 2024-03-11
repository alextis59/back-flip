
const self = {

    useResponses: (req, res, next) => {

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

    }

}

module.exports = self;
