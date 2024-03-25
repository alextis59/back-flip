const _ = require('lodash'),
    utils = require('side-flip/utils');

const self = {

    queryMatchCustomizer: (object_value, query_value) => {
        if(_.isEqual(object_value, query_value)) {
            return true;
        }
        if(query_value.$exists != null){
            if(query_value.$exists){
                return object_value !== undefined;
            }else{
                return object_value === undefined;
            }
        }
        if(query_value.$ne != null && !_.isEqual(object_value, query_value.$ne)){
            return true;
        }
        if(query_value.$in != null){
            for(let value of query_value.$in){
                if(_.isEqual(object_value, value)){
                    return true;
                }
            }
        }
        return false;
    },

    getFilledEntityForCheck: (entity, query) => {
        let clone = _.cloneDeep(entity),
            flat_query = utils.getFlattenedObject(query);
        for(let target in flat_query){
            let keys = target.split('.'),
                last = keys.pop();
            if(last.includes('$')){
                let attr_target = keys.join('.');
                if(_.get(clone, attr_target) === undefined){
                    _.set(clone, attr_target, undefined);
                }
            }
        }
        return clone;
    },

    entityMatchQuery: (entity, query) => {
        let target = self.getFilledEntityForCheck(entity, query);
        return _.isMatchWith(target, query, self.queryMatchCustomizer);
    }

}

let devices = [
    { imei: '000000000000011', path: '//Assignable', type: 'xswitch' },
    {
      imei: '000000000000013',
      path: '//company1',
      type: 'xsole',
      error_codes: [Array]
    },
    {
      imei: '000000000000012',
      path: '//company1/sub1',
      type: 'xswitch',
      site: [Object]
    },
    { imei: '000000000000014', path: '//Assignable' },
  ];

// let query = {type: {$ne: "xswitch"}};
// let query = {type: {$in: ["xsole", undefined]}};
let query = {type: {$exists: false}};

console.log(utils.getFlattenedObject(query));

for(let device of devices){
    if(self.entityMatchQuery(device, query)){
        console.log(device.imei);
    }
}