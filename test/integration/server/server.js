const express = require('express'),
    { asyncWrap, asyncRouter } = require('../../../async-express'),
    async_wrap = require('./routes/async_wrap'),
    async_router = require('./routes/async_router'),
    basic_mdw = require('./middlewares/basic');

const app = express();

// const app = asyncRouter(express());

app.use('/async_wrap', async_wrap);

app.use('/async_router', async_router);

app.use(basic_mdw.catchSendError);

app.listen(3000, () => {
    console.log('Server started on port 3000');
});