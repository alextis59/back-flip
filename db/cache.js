const _ = require('lodash');

const self = {

    db: null,

    

    initialize: (db, options) => {
        self.db = db;
        

        
        self.db.onEventSubscribe('create', self.onEntityCreate);
        self.db.onEventSubscribe('update', self.onEntityUpdate);
    },

}

module.exports = self;