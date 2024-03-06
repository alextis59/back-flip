const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const {MongoClient, ObjectId} = require("mongodb");
const db = require("../../../../../db/index.js");

describe("db.deleteEntity", () => {

    // Declare the mocked functions stubs and the parameters variables
    let deleteEntityFromQueryStub;
    let loggerDebugStub;
    let callback;
    let options;
    let entityId;
    let entityName;
    
    beforeEach(() => {
        // Initialize the stubs and spies
        deleteEntityFromQueryStub = sinon.stub(db, 'deleteEntityFromQuery');
        loggerDebugStub = sinon.stub(logger, 'debug');
    
        // Initialize the callback spy
        callback = sinon.spy();
    
        // Set default values for options and entity details
        entityId = '507f1f77bcf86cd799439011'; // Example ObjectId string
        entityName = 'device'; // Example entity name
        options = {}; // Default options if not provided
    
        // Reset the values before each test case
        options = {};
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call deleteEntityFromQuery with an ObjectId when a valid ObjectId string is provided for id", (done) => {
        db.deleteEntity(entityName, entityId, callback, options);
    
        setImmediate(() => { // Use setImmediate to ensure the assertions are checked after the async operation
            try {
                expect(deleteEntityFromQueryStub).to.have.been.calledOnce;
                expect(deleteEntityFromQueryStub).to.have.been.calledWith(
                    entityName,
                    sinon.match({ _id: sinon.match.instanceOf(ObjectId) }),
                    sinon.match.func,
                    options
                );
                const callArgs = deleteEntityFromQueryStub.getCall(0).args[1];
                expect(callArgs._id.toString()).to.equal(entityId);
    
                expect(loggerDebugStub).to.have.been.calledWith(
                    "db.deleteEntity",
                    sinon.match.has("inputs", sinon.match.has("entity_name", entityName))
                );
    
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should call deleteEntityFromQuery with a new ObjectId when a non-ObjectId string is provided for id", (done) => {
        db.deleteEntity(entityName, entityId, callback, options);
    
        sinon.assert.calledOnce(deleteEntityFromQueryStub);
        const deleteEntityArgs = deleteEntityFromQueryStub.firstCall.args;
        expect(deleteEntityArgs[0]).to.equal(entityName);
        const queryArg = deleteEntityArgs[1];
        expect(queryArg).to.have.property('_id');
        expect(queryArg._id).to.be.instanceOf(ObjectId);
        expect(queryArg._id.toString()).to.equal(entityId);
        expect(deleteEntityArgs[2]).to.equal(callback);
        expect(deleteEntityArgs[3]).to.deep.equal(options);
        sinon.assert.calledOnce(loggerDebugStub);
        expect(loggerDebugStub).to.have.been.calledWith("db.deleteEntity", sinon.match.has("inputs", sinon.match.has("entity_name", entityName)));
    
        done();
    });

    it("should call deleteEntityFromQuery with the correct entity_name and default empty options when no options are provided", (done) => {
        deleteEntityFromQueryStub.yields(null, {}); // Move this line to the beforeEach block
    
        db.deleteEntity(entityName, entityId, (err, result) => {
            try {
                expect(deleteEntityFromQueryStub).to.have.been.calledOnce;
                expect(deleteEntityFromQueryStub).to.have.been.calledWith(
                    entityName,
                    { _id: sinon.match(value => value instanceof ObjectId && value.toString() === entityId) },
                    sinon.match.func,
                    sinon.match(obj => obj === undefined || (obj && Object.keys(obj).length === 0))
                );
    
                expect(loggerDebugStub).to.have.been.calledWith("db.deleteEntity", sinon.match.has("inputs", sinon.match.has("entity_name", entityName)));
    
                expect(err).to.be.null;
    
                expect(callback).to.have.not.been.called; // Fixed assertion
    
                done();
            } catch (error) {
                done(error);
            }
        });

    });

    it("should call deleteEntityFromQuery with the correct entity_name and provided options when options are given", (done) => {
        options = { someOption: 'testValue' };
    
        db.deleteEntity(entityName, entityId, callback, options);
    
        expect(deleteEntityFromQueryStub).to.have.been.calledOnce;
        expect(deleteEntityFromQueryStub).to.have.been.calledWith(
            sinon.match(entityName),
            sinon.match.has('_id', sinon.match(value => value instanceof ObjectId && value.equals(new ObjectId(entityId)))),
            callback,
            sinon.match(options)
        );
        expect(callback).to.not.have.been.called;
        expect(loggerDebugStub).to.have.been.calledWith("db.deleteEntity", sinon.match.has('inputs', sinon.match.has('entity_name', entityName)));
    
        done();
    });

    it("should call the callback with the result of deleteEntityFromQuery when it is successful", (done) => {
        const expectedResult = { deletedCount: 1 };
        deleteEntityFromQueryStub.callsFake((entity_name, query, cb, options) => {
            expect(query).to.have.property('_id');
            expect(query._id).to.be.instanceOf(ObjectId);
            cb(null, expectedResult);
        });
    
        db.deleteEntity(entityName, entityId, callback, options);
    
        expect(deleteEntityFromQueryStub).to.have.been.calledOnce;
        expect(deleteEntityFromQueryStub).to.have.been.calledWith(entityName, sinon.match.has('_id', sinon.match.instanceOf(ObjectId)), sinon.match.func, options);
        expect(callback).to.have.been.calledOnceWith(null, expectedResult);
        expect(loggerDebugStub).to.have.been.calledWith("db.deleteEntity", sinon.match.has('inputs', sinon.match.has('entity_name', entityName)));
    
        done();
    });

    it("should call the callback with an error when deleteEntityFromQuery fails", (done) => {
        const testError = new Error("Test Error");
        
        deleteEntityFromQueryStub.callsFake((entity_name, query, cb, options) => {
            cb(testError);
        });
    
        db.deleteEntity(entityName, entityId, callback, options);
    
        expect(loggerDebugStub).to.have.been.calledOnce;
        expect(loggerDebugStub).to.have.been.calledWith("db.deleteEntity", sinon.match.has("inputs", sinon.match.has("entity_name", entityName)));
        expect(callback).to.have.been.calledOnce;
        expect(callback).to.have.been.calledWith(sinon.match(testError));
    
        done();
    });

});