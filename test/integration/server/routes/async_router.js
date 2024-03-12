const express = require('express'),
    {asyncRouter} = require('../../../../async-express'),
    router = asyncRouter(express.Router()),
    // router = express.Router(),
    async_wrap = require('../middlewares/async_wrap'),
    basic = require('../middlewares/basic');

// Sync middlewares

router.get('/sync_call_next', basic.callNext, basic.sendOk);

router.get('/sync_wait_call_next', basic.waitCallNext, basic.sendOk);

router.get('/sync_throw', basic.throwError, basic.sendOk);

router.get('/sync_next_throw', basic.nextError, basic.sendOk);

router.get('/sync_wait_next_throw', basic.waitNextError, basic.sendOk);

// Async middlewares

router.get('/async_return', async_wrap.asyncReturn, basic.sendOk);

router.get('/async_wait_return', async_wrap.asyncWaitReturn, basic.sendOk);

router.get('/async_call_next', async_wrap.asyncCallNext, basic.sendOk);

router.get('/async_wait_next', async_wrap.asyncWaitNext, basic.sendOk);

router.get('/async_throw', async_wrap.asyncThrow, basic.sendOk);

router.get('/async_next_throw', async_wrap.asyncNextThrow, basic.sendOk);

router.get('/async_wait_throw', async_wrap.asyncWaitThrowError, basic.sendOk);

router.get('/async_wait_next_throw', async_wrap.asyncWaitNextThrow, basic.sendOk);

// Middlewares mix

router.get('/mix_call_next', basic.callNext, async_wrap.asyncCallNext, basic.sendOk);

router.get('/mix_wait_call_next', basic.waitCallNext, async_wrap.asyncWaitNext, basic.sendOk);

router.get('/mix_wait_async_throw', basic.waitCallNext, async_wrap.asyncThrow, basic.sendOk);

router.get('/mix_async_wait_throw', async_wrap.asyncWaitReturn, basic.throwError, basic.sendOk);

router.get('/mix_async_wait_next_throw', async_wrap.asyncWaitReturn, basic.waitNextError, basic.sendOk);

router.get('/mix_wait_async_next_throw', basic.waitCallNext, async_wrap.asyncNextThrow, basic.sendOk);

module.exports = router;