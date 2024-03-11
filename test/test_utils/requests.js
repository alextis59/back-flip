const request = require('supertest'),
    assert = require('assert');

const self = {

    base_url: 'http://localhost:3000',

    setBaseUrl: (url) => {
        self.base_url = url;
    },

    makeRequest: async (url, options = {}, cb = () => {}) => {
        let method = options.method || 'get',
            data = options.data || {},
            headers = options.headers || {},
            expect_code = options.statusCode || 200,
            expect_body = options.body || null;
            start_time = Date.now();
        try{
            let req = request(self.base_url);
            if (headers) {
                for (let key in headers) {
                    req.set(key, headers[key]);
                }
            }
            if (method === 'get') {
                req = req.get(url);
            } else if (method === 'post') {
                req = req.post(url).send(data);
            } else if (method === 'put') {
                req = req.put(url).send(data);
            } else if (method === 'delete') {
                req = req.delete(url);
            }
            let res = await req;
            if(options.logRes){
                console.log(res);
            }
            let end_time = Date.now();
            assert.equal(res.status, expect_code, 'Status code not as expected: ' + res.status + ' instead of ' + expect_code);
            if(options.min_duration){
                assert.ok(end_time - start_time >= options.min_duration, 'Request duration less than expected: ' + (end_time - start_time) + ' instead of ' + options.min_duration);
            }
            if(options.max_duration){
                assert.ok(end_time - start_time <= options.max_duration, 'Request duration more than expected: ' + (end_time - start_time) + ' instead of ' + options.max_duration);
            }
            if (expect_body) {
                assert.deepEqual(res.body, expect_body, 'Response body not as expected: ' + JSON.stringify(res.body) + ' instead of ' + JSON.stringify(expect_body));
            }
            cb(res);
            return res;
        }catch(err){
            cb(err);
            throw err;
        }
    }

}

module.exports = self;