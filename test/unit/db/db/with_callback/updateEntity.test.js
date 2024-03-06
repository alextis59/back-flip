const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const {MongoClient, ObjectId} = require("mongodb");
const db = require("../../../../../db/index.js");

describe("db.updateEntity", () => {

    // Declare the variables outside the beforeEach block
    let updateEntityFromQueryStub;
    let loggerDebugStub;
    let entityName;
    let entityId;
    let updateObject;
    let updaterId;
    let callback;
    let options;
    
    beforeEach(() => {
        // Set their values inside the beforeEach block
        updateEntityFromQueryStub = sinon.stub(db, "updateEntityFromQuery");
        loggerDebugStub = sinon.stub(logger, "debug");
    
        // Initialize variables with sample data
        entityName = 'device';
        entityId = '507f191e810c19729de860ea'; // Sample string that represents an ObjectId
        updateObject = { status: 'active' };
        updaterId = '123456789';
        callback = sinon.spy();
        options = { requestor_id: updaterId };
    
        // Reset the db service name to 'unknown' before each test
        db.service_name = 'unknown';
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call updateEntityFromQuery with the correct entity name, query object, and update object when id is a string", (done) => {
        db.updateEntity(entityName, entityId, updateObject, callback, options);
    
        const expectedQuery = { _id: new ObjectId(entityId) };
    
        expect(updateEntityFromQueryStub).to.have.been.calledOnceWith(entityName, expectedQuery, updateObject, sinon.match.func, options);
    
        const updateEntityFromQueryCallback = updateEntityFromQueryStub.args[0][3];
        updateEntityFromQueryCallback(null, {}); // Simulate successful update
    
        expect(callback).to.have.been.calledOnce;
    
        done();
    });

    it("should call updateEntityFromQuery with the correct entity name, query object, and update object when id is an instance of ObjectId", (done) => {
        const objectId = new ObjectId(entityId);
        
        db.updateEntity(entityName, objectId, updateObject, callback, options);
        
        expect(updateEntityFromQueryStub).to.have.been.calledOnceWith(
            entityName,
            { _id: objectId },
            updateObject,
            sinon.match.func, // Assert that a function has been passed as the callback
            options
        );
        
        updateEntityFromQueryStub.yield(null, {}); // Simulate the stubbed function calling its callback
        expect(callback).to.have.been.calledOnce;
        
        done();
    });


    it("should handle the case when the callback function is provided, passing it to updateEntityFromQuery", (done) => {
        db.updateEntity(entityName, entityId, updateObject, callback, options);
    
        expect(updateEntityFromQueryStub).to.have.been.calledWith(
            sinon.match(entityName),
            sinon.match({ _id: sinon.match.instanceOf(ObjectId) }),
            sinon.match(updateObject),
            sinon.match.func
        );
    
        const actualCallback = updateEntityFromQueryStub.args[0][3];
        expect(actualCallback).to.equal(callback);
    
        done();
    });

    it("should handle the case when the callback function is not provided", (done) => {
        db.updateEntity(entityName, entityId, updateObject, undefined, options);
    
        expect(updateEntityFromQueryStub).to.have.been.calledOnce;
        expect(updateEntityFromQueryStub).to.have.been.calledWith(
            entityName,
            { _id: new ObjectId(entityId) },
            updateObject,
            undefined, // Check that a function is passed as the callback
            options
        );
    
        expect(loggerDebugStub).to.have.been.calledOnce;
        expect(loggerDebugStub).to.have.been.calledWith("db.updateEntity", { inputs: { entity_name: entityName, id: entityId } });
    
        done();
    });

    it("should correctly convert a string id into an ObjectId before calling updateEntityFromQuery", (done) => {
        db.updateEntity(entityName, entityId, updateObject, callback, options);
    
        process.nextTick(() => {
            try {
                expect(updateEntityFromQueryStub).to.have.been.calledOnce;
    
                const actualQuery = updateEntityFromQueryStub.args[0][1];
    
                const expectedObjectId = new ObjectId(entityId);
    
                expect(actualQuery).to.deep.equal({ _id: expectedObjectId });
    
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should pass the options object to updateEntityFromQuery if provided", (done) => {
        db.updateEntity(entityName, entityId, updateObject, callback, options);
    
        expect(updateEntityFromQueryStub).to.have.been.calledWith(
            sinon.match(entityName),
            sinon.match.has('_id', sinon.match.instanceOf(ObjectId)),
            sinon.match(updateObject),
            sinon.match.func,
            sinon.match(options)
        );
    
        expect(loggerDebugStub).to.have.been.called;
    
        done();
    });

});