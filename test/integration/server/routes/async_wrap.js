const express = require('express'),
    router = express.Router(),
    {asyncWrap} = require('../../../../async-express'),
    async_wrap = require('../middlewares/async_wrap'),
    basic = require('../middlewares/basic');

// Sync middlewares

router.get('/sync_call_next', asyncWrap(basic.callNext, basic.sendOk));

router.get('/sync_wait_call_next', asyncWrap(basic.waitCallNext, basic.sendOk));

router.get('/sync_throw', asyncWrap(basic.throwError, basic.sendOk));

router.get('/sync_next_throw', asyncWrap(basic.nextError, basic.sendOk));

router.get('/sync_wait_next_throw', asyncWrap(basic.waitNextError, basic.sendOk));

// Async middlewares

router.get('/async_return', asyncWrap(async_wrap.asyncReturn, basic.sendOk));

router.get('/async_wait_return', asyncWrap(async_wrap.asyncWaitReturn, basic.sendOk));

router.get('/async_call_next', asyncWrap(async_wrap.asyncCallNext, basic.sendOk));

router.get('/async_wait_next', asyncWrap(async_wrap.asyncWaitNext, basic.sendOk));

router.get('/async_throw', asyncWrap(async_wrap.asyncThrow, basic.sendOk));

router.get('/async_next_throw', asyncWrap(async_wrap.asyncNextThrow, basic.sendOk));

router.get('/async_wait_throw', asyncWrap(async_wrap.asyncWaitThrowError, basic.sendOk));

router.get('/async_wait_next_throw', asyncWrap(async_wrap.asyncWaitNextThrow, basic.sendOk));

// Middlewares mix

router.get('/mix_call_next', asyncWrap(basic.callNext, async_wrap.asyncCallNext, basic.sendOk));

router.get('/mix_wait_call_next', asyncWrap(basic.waitCallNext, async_wrap.asyncWaitNext, basic.sendOk));

router.get('/mix_wait_async_throw', asyncWrap(basic.waitCallNext, async_wrap.asyncThrow, basic.sendOk));

router.get('/mix_async_wait_throw', asyncWrap(async_wrap.asyncWaitReturn, basic.throwError, basic.sendOk));

router.get('/mix_async_wait_next_throw', asyncWrap(async_wrap.asyncWaitReturn, basic.waitNextError, basic.sendOk));

router.get('/mix_wait_async_next_throw', asyncWrap(basic.waitCallNext, async_wrap.asyncNextThrow, basic.sendOk));

module.exports = router;