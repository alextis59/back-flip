

const self = {

    catchSendError: (err, req, res, next) => {
        console.log('basic - catchSendError => ', err.message);
        res.status(500).json({err: err.message});
    },

    callNext: (req, res, next) => {
        console.log('basic - callNext');
        next();
    },

    waitCallNext: (req, res, next) => {
        console.log('basic - waitCallNext');
        setTimeout(() => {
            console.log('basic - waitCallNext - next')
            next();
        }, 100);
    },

    sendOk: (req, res) => {
        console.log('basic- sendOk');
        res.status(200).send('OK');
    },

    throwError: (req, res) => {
        console.log('basic - throwError');
        throw new Error('throwError');
    },

    nextError: (req, res, next) => {
        console.log('basic - nextError');
        next(new Error('nextError'));
    },

    waitNextError: (req, res, next) => {
        console.log('basic - waitNextError');
        setTimeout(() => {
            next(new Error('waitNextError'));
        }, 100);
    },

}

module.exports = self;