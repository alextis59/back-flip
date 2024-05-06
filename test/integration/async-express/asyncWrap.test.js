const { describe } = require('node:test');
const utils = require('side-flip/utils'),
    assert = require('assert'),
    {makeRequest} = require('../../../test_utils/requests');

describe('asyncWrap', () => {

    describe('asyncWrap use on sync middlewares', () => {

        it('should call next', async () => {
            await makeRequest('/async_wrap/sync_call_next');
        });

        it('should wait and call next', async () => {
            await makeRequest('/async_wrap/sync_wait_call_next', {min_duration: 100});
        });

        it('should throw', async () => {
            await makeRequest('/async_wrap/sync_throw', {}, {status_code: 500, body: {err: 'throwError'}});
        });

        it('should call next with error', async () => {
            await makeRequest('/async_wrap/sync_next_throw', {}, {status_code: 500, body: {err: 'nextError'}});
        });

        it('should wait and call next with error', async () => {
            await makeRequest('/async_wrap/sync_wait_next_throw', {}, {status_code: 500, body: {err: 'waitNextError'}, min_duration: 100});
        });

    })

    describe('asyncWrap use on async middlewares', () => {

        it('should return', async () => {
            await makeRequest('/async_wrap/async_return');
        });

        it('should wait and return', async () => {
            await makeRequest('/async_wrap/async_wait_return', {min_duration: 100});
        });

        it('should call next', async () => {
            await makeRequest('/async_wrap/async_call_next');
        });

        it('should wait and call next', async () => {
            await makeRequest('/async_wrap/async_wait_next', {min_duration: 100});
        });

        it('should throw', async () => {
            await makeRequest('/async_wrap/async_throw', {}, {status_code: 500, body: {err: 'asyncThrow'}});
        });

        it('should call next with error', async () => {
            await makeRequest('/async_wrap/async_next_throw', {}, {status_code: 500, body: {err: 'asyncNextThrow'}});
        });

        it('should wait and throw', async () => {
            await makeRequest('/async_wrap/async_wait_throw', {}, {status_code: 500, body: {err: 'asyncWaitThrowError'}, min_duration: 100});
        });

        it('should wait and call next with error', async () => {
            await makeRequest('/async_wrap/async_wait_next_throw', {}, {status_code: 500, body: {err: 'asyncWaitNextThrow'}, min_duration: 100});
        });

    });

    describe('asyncWrap use on mixed middlewares', () => {

        it('should call next', async () => {
            await makeRequest('/async_wrap/mix_call_next');
        });

        it('should wait and call next', async () => {
            await makeRequest('/async_wrap/mix_wait_call_next', {min_duration: 200});
        });

        it('should wait and throw', async () => {
            await makeRequest('/async_wrap/mix_wait_async_throw', {}, {status_code: 500, body: {err: 'asyncThrow'}, min_duration: 100});
        });

        it('should wait and throw', async () => {
            await makeRequest('/async_wrap/mix_async_wait_throw', {}, {status_code: 500, body: {err: 'throwError'}, min_duration: 100});
        });

        it('should wait and call next with error', async () => {
            await makeRequest('/async_wrap/mix_async_wait_next_throw', {}, {status_code: 500, body: {err: 'waitNextError'}, min_duration: 100});
        });

        it('should wait and call next with error', async () => {
            await makeRequest('/async_wrap/mix_wait_async_next_throw', {}, {status_code: 500, body: {err: 'asyncNextThrow'}, min_duration: 100});
        });

    });
    

});