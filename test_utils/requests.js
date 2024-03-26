const axios = require('axios'),
    assert = require('assert'),
    utils = require('side-flip/utils');

const self = {

    base_url: 'http://localhost:3000',

    setBaseUrl: (url) => {
        self.base_url = url;
    },

    makeRequest: async (url, options = {}, expect = {}) => {
        let method = options.method || 'get',
            data = options.data || {},
            headers = options.headers || {},
            expect_code = expect.status_code || 200,
            expect_body = expect.body || null;
            start_time = Date.now();
        if (options.jwt_token) {
            headers.Authorization = 'jwt ' + options.jwt_token;
        }else if (options.bearer_token) {
            headers.Authorization = 'Bearer ' + options.bearer_token;
        }
        let verify_response = (res) => {
            if (options.log_res) {
                console.log(res);
            }

            let end_time = Date.now();
            assert.equal(res.status, expect_code, 'Status code not as expected: ' + res.status + ' instead of ' + expect_code);

            if (expect.min_duration != null) {
                assert.ok(end_time - start_time >= expect.min_duration, 'Request duration less than expected: ' + (end_time - start_time) + ' instead of ' + expect.min_duration);
            }
            if (expect.max_duration != null) {
                assert.ok(end_time - start_time <= expect.max_duration, 'Request duration more than expected: ' + (end_time - start_time) + ' instead of ' + expect.max_duration);
            }
            if (expect_body) {
                let is_match = utils.objectMatchQuery(res.data, expect_body);
                assert.ok(is_match, 'Response body not as expected: ' + JSON.stringify(res.data) + ' instead of ' + JSON.stringify(expect_body));
            }
        }
        try {
            const config = {
                method: method,
                url: self.base_url + url,
                headers: headers,
                data: data
            };

            if (method.toLowerCase() === 'get') {
                // Axios 'GET' requests don't support a body in the request
                // So, we delete the data property for GET requests
                delete config.data;
            }

            const res = await axios(config);

            verify_response(res);
            
            return res.data;
        } catch (err) {

            if(err.response){
                verify_response(err.response);
                return err.response.data;
            }

            throw err;
        }
    }

}

module.exports = self;