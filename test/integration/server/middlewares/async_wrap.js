const utils = require('side-flip/utils');

const self = {

    asyncReturn: async (req, res) => {
        console.log('async_wrap - asyncReturn');
        return;
    },

    asyncWaitReturn: async (req, res) => {
        console.log('async_wrap - asyncWaitReturn');
        await utils.wait(100);
        return;
    },

    asyncCallNext: async (req, res, next) => {
        console.log('async_wrap - asyncCallNext');
        next();
    },

    asyncWaitNext: async (req, res, next) => {
        console.log('async_wrap - asyncWaitNext');
        await utils.wait(100);
        next();
    },

    asyncThrow: async (req, res) => {
        console.log('async_wrap - asyncThrow');
        throw new Error('asyncThrow');
    },

    asyncNextThrow: async (req, res, next) => {
        console.log('async_wrap - asyncNextThrow');
        next(new Error('asyncNextThrow'));
    },

    asyncWaitThrowError: async (req, res) => {
        console.log('async_wrap - asyncWaitThrowError');
        await utils.wait(100);
        throw new Error('asyncWaitThrowError');
    },

    asyncWaitNextThrow: async (req, res, next) => {
        console.log('async_wrap - asyncWaitNextThrow');
        await utils.wait(100);
        next(new Error('asyncWaitNextThrow'));
    }

}

module.exports = self;