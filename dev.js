const _ = require('lodash');

const self = {

    queryMatchCustomizer: (object_value, query_value) => {
        console.log(object_value, query_value);
        if(_.isEqual(object_value, query_value)) {
            console.log('TEST1');
            return true;
        }
        if(query_value.$ne != null && !_.isEqual(object_value, query_value.$ne)){
            console.log('TEST2');
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

    entityMatchQuery: (entity, query) => {
        return _.isMatchWith(entity, query, self.queryMatchCustomizer);
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
    }
  ];

let query = {type: {$ne: "xswitch"}};

for(let device of devices){
    if(self.entityMatchQuery(device, query)){
        console.log(device.imei);
    }
}