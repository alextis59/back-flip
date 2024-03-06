const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const utils = require("side-flip/utils");
const correlator = require("correlation-id");
const db = require("../../../../../db/index.js");

describe("db.updateEntityFromQuery", () => {

    let getCollectionStub, updateOneStub, getFlattenedObjectStub;
    let entity_name, query, obj, cb, options;
    
    beforeEach(() => {
        // Stub the logger.debug to prevent actual logging
        sinon.stub(logger, 'debug');
        
        // Stub the utils.getFlattenedObject function
        getFlattenedObjectStub = sinon.stub(utils, 'getFlattenedObject');
    
        // Stub the db.getCollection function
        getCollectionStub = sinon.stub(db, 'getCollection');

        // Stub the db.onEvent function
        onEventStub = sinon.stub(db, 'onEvent');
        
        // Stub the MongoDB collection's updateOne function
        updateOneStub = sinon.stub();
        getCollectionStub.resolves({ updateOne: updateOneStub });
    
        // Initialize the variables with default values
        entity_name = 'testEntity';
        query = { _id: 'testId' };
        obj = { name: 'testName' };
        cb = sinon.spy();
        options = {};
    
        // Return the original object when getFlattenedObject is called without data flattening
        getFlattenedObjectStub.callsFake(originalObject => originalObject);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call the updateEntityFromQuery with correct arguments and handle MongoDB getCollection error", (done) => {
        const expectedError = new Error("Failed to get collection");
        getCollectionStub.rejects(expectedError);
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            expect(err).to.equal(expectedError);
            expect(result).to.be.undefined;
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(updateOneStub).to.not.have.been.called;
            expect(onEventStub).to.not.have.been.called;
            done();
        });
    });

    it("should call the updateEntityFromQuery with correct arguments and handle MongoDB updateOne error", (done) => {
        const expectedError = new Error('MongoDB updateOne error');
        updateOneStub.rejects(expectedError);
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            try {
                expect(err).to.equal(expectedError);
                expect(result).to.be.undefined;
                expect(getCollectionStub).to.have.been.calledOnceWithExactly(entity_name);
                expect(updateOneStub).to.have.been.calledOnceWithExactly(query, { $set: obj }, {});
                expect(getFlattenedObjectStub).to.not.have.been.called;
                expect(onEventStub).to.not.have.been.called;
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should successfully update an entity without data flattening or deletion of null fields and without upsert option", (done) => {
        const updateOneMockResponse = {
            matchedCount: 1,
            modifiedCount: 1,
            upsertedId: null
        };
        updateOneStub.resolves(updateOneMockResponse);
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(logger.debug).to.have.been.calledWith("db.updateEntity", { inputs: { entity_name, query } });
                expect(getCollectionStub).to.have.been.calledWith(entity_name);
                expect(updateOneStub).to.have.been.calledWith(query, { $set: obj }, {});
                expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
                expect(result).to.deep.equal(updateOneMockResponse);
                done();
            } catch (error) {
                done(error);
            }
        
        }, options);
    });

    it("should successfully update an entity with data flattening and without deletion of null fields or upsert option", (done) => {
        options.data_flattening = true;
        obj = { nested: { name: 'flattenedName' } }; // Example of a nested object to be flattened
        
        const flattenedObj = { 'nested.name': 'flattenedName' };
        getFlattenedObjectStub.withArgs(obj).returns(flattenedObj);
        
        const expectedUpdate = { $set: flattenedObj };
        
        updateOneStub.withArgs(query, expectedUpdate, {}).resolves({ matchedCount: 1, modifiedCount: 1 });
        
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal({ matchedCount: 1, modifiedCount: 1 });
            expect(getFlattenedObjectStub).to.have.been.calledWith(obj);
            expect(updateOneStub).to.have.been.calledWith(query, expectedUpdate, {});
            expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
            done();
        }, options);
    });

    it("should successfully update an entity without data flattening, with deletion of null fields, and without upsert option", (done) => {
        options.delete_null_fields = true;
        options.upsert = false;
        
        obj = { name: 'testName', toBeDeleted: null };
    
        const expectedUpdate = {
            $set: { name: 'testName' },
            $unset: { toBeDeleted: "" }
        };
    
        updateOneStub.resolves({ modifiedCount: 1 });
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal({ modifiedCount: 1 });
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(updateOneStub).to.have.been.calledOnceWith(query, expectedUpdate, {});
            expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
            done();
        
        }, options);
    });

    it("should successfully update an entity with data flattening, deletion of null fields, and without upsert option", (done) => {
        obj = { name: 'testName', level: null };
        options = { data_flattening: true, delete_null_fields: true };
    
        const flattenedObj = { 'name': 'testName', level: null };
        const expectedUpdate = { $set: flattenedObj, $unset: { 'level': "" } };
        getFlattenedObjectStub.returns(flattenedObj);
    
        updateOneStub.resolves({ modifiedCount: 1 });
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            try {
                expect(logger.debug).to.have.been.calledWith("db.updateEntity", { inputs: { entity_name, query } });
                expect(getFlattenedObjectStub).to.have.been.calledOnceWith(obj);
                expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
                expect(updateOneStub).to.have.been.calledOnceWith(query, expectedUpdate, {});
                expect(result).to.deep.equal({ modifiedCount: 1 });
                expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    
    });

    it("should successfully update an entity without data flattening or deletion of null fields but with upsert option", (done) => {
        options.upsert = true;
    
        const expectedUpdate = { $set: obj };
        const expectedUpdateOptions = { upsert: true };
    
        updateOneStub.resolves({ modifiedCount: 1 });
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            try {
                expect(getCollectionStub).to.have.been.calledWith(entity_name);
                expect(updateOneStub).to.have.been.calledWith(query, expectedUpdate, expectedUpdateOptions);
                expect(result).to.deep.equal({ modifiedCount: 1 });
                expect(getFlattenedObjectStub).to.not.have.been.called;
                expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should successfully update an entity with data flattening, without deletion of null fields, but with upsert option", (done) => {
        options.data_flattening = true;
        options.upsert = true;
    
        const flattenedObject = { 'name': 'testName' };
        getFlattenedObjectStub.returns(flattenedObject);
    
        const updateOneResult = { matchedCount: 1, modifiedCount: 1, upsertedId: null };
        updateOneStub.resolves(updateOneResult);
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            expect(getFlattenedObjectStub).to.have.been.calledWith(obj);
            
            const expectedUpdate = { $set: flattenedObject };
            expect(updateOneStub).to.have.been.calledWith(query, expectedUpdate, { upsert: true });
            
            expect(result).to.deep.equal(updateOneResult);
            expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
            
            done();
        }, options);
    });

    it("should successfully update an entity without data flattening, with deletion of null fields, and with upsert option", (done) => {
        obj = { name: 'testName', obsoleteField: null };
        options = { delete_null_fields: true, upsert: true };
    
        const expectedUpdate = {
            $set: { name: 'testName' },
            $unset: { obsoleteField: "" }
        };
        const expectedOptions = { upsert: true };
    
        const updateResult = { modifiedCount: 1 };
        updateOneStub.resolves(updateResult);
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            expect(getCollectionStub).to.have.been.calledWith(entity_name);
            expect(updateOneStub).to.have.been.calledWith(query, expectedUpdate, expectedOptions);
            expect(result).to.deep.equal(updateResult);
            expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
            done();
        }, options);
    });

    it("should successfully update an entity with data flattening, deletion of null fields, and with upsert option", (done) => {
        obj = { name: 'testName', description: null };
        options = { data_flattening: true, delete_null_fields: true, upsert: true };
    
        const flattenedObj = { 'name': 'testName', description: null };
        const expectedUpdate = { $set: flattenedObj, $unset: { description: "" } };
        const expectedUpdateOptions = { upsert: true };
    
        getFlattenedObjectStub.withArgs(obj).returns(flattenedObj);
        updateOneStub.resolves({ matchedCount: 1, modifiedCount: 1, upsertedId: 'testId' });
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            expect(getFlattenedObjectStub).to.have.been.calledOnceWith(obj);
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(updateOneStub).to.have.been.calledOnceWith(query, expectedUpdate, expectedUpdateOptions);
            expect(result).to.deep.equal({ matchedCount: 1, modifiedCount: 1, upsertedId: 'testId' });
            expect(onEventStub).to.have.been.calledWith("update", { entity_name, query, update: obj, result });
            done();
        }, options);
    });

    it("should call the callback with the result of the MongoDB updateOne operation", (done) => {
        const expectedUpdateResult = { matchedCount: 1, modifiedCount: 1 };
        updateOneStub.resolves(expectedUpdateResult);
    
        db.updateEntityFromQuery(entity_name, query, obj, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(result).to.deep.equal(expectedUpdateResult);
                expect(updateOneStub).to.have.been.calledOnceWith(query, { $set: obj }, {});
                done();
            } catch (error) {
                done(error);
            }
        });
    });

});