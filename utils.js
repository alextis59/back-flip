

const self = {

    timeout: (ms) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject(new Error("Request timed out"));
            }, ms);
        });
    },

    wait: (ms) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    },

    /**
     * Flattens a given object and returns a new object with the flattened structure.
     * @param {object} object - The object to be flattened.
     * @param {string} prefix - Optional prefix to be added to the flattened keys.
     * @returns {object} - The flattened object.
     */
    getFlattenedObject: (object, prefix = "") => {
        let result = {};
        for (let prop in object) {
            let value = object[prop];
            if (value != null && value.constructor === Object) {
                if (Object.keys(value).length === 0) {
                    // Handling the empty object case
                    result[prefix + prop] = {};
                } else {
                    let sub_result = utils.getFlattenedObject(value, prefix + prop + ".");
                    for (let sub_prop in sub_result) {
                        result[sub_prop] = sub_result[sub_prop];
                    }
                }
            } else {
                result[prefix + prop] = value;
            }
        }
        return result;
    },

}

module.exports = self;