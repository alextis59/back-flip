const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const {MongoClient, ObjectId} = require("mongodb");
const db = require("../../../../../db/index.js");

describe("db.findEntitiesFromIdList", () => {

    let findEntitiesFromPropertyValuesStub;
    let objectIdStub;
    let loggerDebugStub;
    let callback;
    let options;
    
    beforeEach(() => {
        findEntitiesFromPropertyValuesStub = sinon.stub(db, "findEntitiesFromPropertyValues");
        objectIdStub = sinon.stub().callsFake((id) => {
            return { _bsontype: 'ObjectID', id };
        });
        loggerDebugStub = sinon.stub(logger, "debug");
        callback = sinon.stub();
        options = {};
        global.ObjectId = objectIdStub; // Replace ObjectId with a stub
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call findEntitiesFromPropertyValues with an empty array when id_list is empty", (done) => {
        const entity_name = "beacon";
        const id_list = [];
        const mockResult = [{ id: 1, name: "beacon1" }];
        findEntitiesFromPropertyValuesStub.callsFake((entity, property, values, cb) => {
            cb(null, mockResult);
        });

        db.findEntitiesFromIdList(entity_name, id_list, callback, options);

        expect(callback).to.be.calledWith(null, mockResult);
        done();
    });

    it("should call findEntitiesFromPropertyValues with all valid 24-character hex string IDs converted to ObjectIds", (done) => {
        const entity_name = "device";
        const id_list = ["5f43e12b5b21dd1fcb5e459a", "5f43e12b5b21dd1fcb5e459b", "5f43e12b5b21dd1fcb5e459c"];
        const expectedObjectIdList = id_list.filter(id => id.match(/^[0-9a-fA-F]{24}$/)).map(id => new ObjectId(id));
    
        db.findEntitiesFromIdList(entity_name, id_list, callback, options);
    
        expect(findEntitiesFromPropertyValuesStub).to.have.been.calledOnceWithExactly(
            entity_name,
            '_id',
            expectedObjectIdList,
            callback,
            options
        );
        done();
    });

    xit("should ignore invalid IDs and call findEntitiesFromPropertyValues with the remaining valid IDs", (done) => {
        const validId = "507f1f77bcf86cd799439011";
        const invalidId = "invalid";
        const entityName = "device";
        const idList = [validId, invalidId];
    
        const expectedObjectId = new ObjectId(validId);
    
        db.findEntitiesFromIdList(entityName, idList, callback, options);
    
        expect(loggerDebugStub).to.have.been.calledOnceWith("db.findEntitiesFromIdList", { inputs: { entity_name: entityName, id_list: idList } });
    
        expect(findEntitiesFromPropertyValuesStub).to.have.been.calledOnceWith(entityName, '_id', [expectedObjectId], callback, options);
    
        done();
    });

    it("should call findEntitiesFromPropertyValues with the correct entity_name and options", (done) => {
        const entity_name = 'device';
        const id_list = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
        const expectedObjectIdList = id_list.map(id => new ObjectId(id));
    
        db.findEntitiesFromIdList(entity_name, id_list, callback, options);
    
        expect(findEntitiesFromPropertyValuesStub).to.have.been.calledOnce;
        expect(findEntitiesFromPropertyValuesStub).to.have.been.calledWith(
            entity_name,
            '_id',
            sinon.match.array.deepEquals(expectedObjectIdList),
            sinon.match.func,
            options
        );
        done();
    });

    xit("should ignore null or undefined IDs and call findEntitiesFromPropertyValues with the remaining valid IDs", (done) => {
        const idList = [null, undefined, "507f1f77bcf86cd799439011", "5f1f77bcf86cd79943901122"];
        const validIdList = ["507f1f77bcf86cd799439011", "5f1f77bcf86cd79943901122"];
        const validObjectIdList = validIdList.map(id => new ObjectId(id));
    
        idList.forEach((id) => {
            if (id != null) {
                objectIdStub.withArgs(id).returns({ _bsontype: 'ObjectID', id });
            }
        });
    
        db.findEntitiesFromIdList("device", idList, callback, options);
    
        expect(findEntitiesFromPropertyValuesStub).to.have.been.calledOnceWith("device", "_id", validObjectIdList, callback, options);
        expect(loggerDebugStub).to.have.been.calledOnceWith("db.findEntitiesFromIdList", { inputs: { entity_name: "device", id_list: idList } });
    
        done();
    });

});