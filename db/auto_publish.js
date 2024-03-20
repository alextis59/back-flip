const _ = require('lodash'),
    mqz = require('../mqz');

const self = {

    db: null,

    whitelist: [],

    blacklist: [],

    publisher: publish,

    publish_key: "DB",

    initialize: (db, options) => {
        self.db = db;
        if(options.whitelist){
            self.whitelist = options.whitelist;
        }
        if(options.blacklist){
            self.blacklist = options.blacklist;
        }
        if(options.publisher){
            self.publisher = options.publisher;
        }
        if(options.publish_key){
            self.publish_key = options.publish_key;
        }
        db.onEventSubscribe('create', self.onEntityCreate);
        db.onEventSubscribe('update', self.onEntityUpdate);
        db.onEventSubscribe('delete', self.onEntityDelete);
    },

    onEntityCreate: () => {

    },

    onEntityUpdate: () => {

    },

    onEntityDelete: () => {

    }

}

async function publish(data){
    await mqz.publish(self.publish_key, data);
}

module.exports = self;