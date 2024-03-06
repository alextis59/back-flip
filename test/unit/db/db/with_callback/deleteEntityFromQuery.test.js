const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const db_tracking = require("../../../../../db/tracking");
const correlator = require("correlation-id");
const db = require("../../../../../db/index.js");

describe("db.deleteEntityFromQuery", () => {

    // Declare the mocked functions stubs and the parameters variables
    let beforeEntityDeleteStub;
    let getCollectionStub;
    let deleteOneStub;
    let bindIdStub;
    let entity_name;
    let query;
    let deleter_id;
    let options;
    let callback;
    let collection;
    
    beforeEach(() => {
        // Reset the values of parameters
        entity_name = 'entity';
        query = { key: 'value' };
        deleter_id = 'deleter-id';
        options = {test: true};
        callback = sinon.stub();
    
        // Create stubs for the functions that will be mocked
        beforeEntityDeleteStub = sinon.stub(db_tracking, 'beforeEntityDelete');
        getCollectionStub = sinon.stub(db, 'getCollection');
        deleteOneStub = sinon.stub().resolves({ deletedCount: 1 });
        bindIdStub = sinon.stub(correlator, 'bindId').callsFake((id, cb) => cb);
    
        // Mock the behavior of the 'getCollection' to return our stubbed collection
        collection = { deleteOne: deleteOneStub };
        getCollectionStub.resolves(collection);
        beforeEntityDeleteStub.resolves({}); 
    
        // Stub the logger.debug function to avoid console output during tests
        sinon.stub(logger, 'debug');
    
        // Set the db.service_name for the test
        db.service_name = 'test-service';
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call saveBeforeDelete with the correct parameters before attempting to delete an entity", (done) => {
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            console.log(err);
            try {
                expect(err).to.be.null;
                expect(result).to.deep.equal({ deletedCount: 1 });
                expect(beforeEntityDeleteStub).to.have.been.calledOnce;
                expect(beforeEntityDeleteStub).to.have.been.calledWith(entity_name, query, {});
                expect(deleteOneStub).to.have.been.calledOnce;
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("should return an error when beforeEntityDelete fails", (done) => {
        const error = new Error("Failed to save before delete");
        beforeEntityDeleteStub.rejects(error); // Mock saveBeforeDelete to fail with an error
    
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            expect(err).to.be.an.instanceof(Error);
            expect(err.message).to.equal("Failed to save before delete");
            expect(result).to.be.undefined;
    
            expect(getCollectionStub).not.to.have.been.called;
            expect(deleteOneStub).not.to.have.been.called;
    
            done();
        }, options);
    });

    it("should obtain the collection for the specified entity when saveBeforeDelete succeeds", (done) => {
        db.deleteEntityFromQuery(entity_name, query, (err) => {
            expect(err).to.be.null;
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(getCollectionStub).to.have.been.calledAfter(beforeEntityDeleteStub);
            expect(deleteOneStub).to.have.been.calledOnceWith(query);
            done();
        }, options);
    });

    it("should return an error when getting the collection fails", (done) => {
        const error = new Error('Error getting collection');
        getCollectionStub.rejects(error); // Make getCollection fail with an error
    
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            expect(beforeEntityDeleteStub).to.have.been.calledOnceWith(entity_name, query, options).and.to.have.been.calledBefore(getCollectionStub);
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(deleteOneStub).to.not.have.been.called;
            expect(err).to.equal(error, "Callback should be called with the getCollection error");
            expect(result).to.be.undefined;
            done();
        }, options);
    });

    it("should delete the entity using the deleteMany method on the collection when the collection is obtained successfully", (done) => {    
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.have.property('deletedCount', 1);
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(deleteOneStub).to.have.been.calledOnceWith(query);
            expect(beforeEntityDeleteStub).to.have.been.calledOnceWith(entity_name, query, options);
            done();
        }, options);
    });

    it("should return the result from deleteMany when the deletion is successful", (done) => {
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal({ deletedCount: 1 });
            expect(deleteOneStub).to.have.been.calledOnceWith(query);
            expect(beforeEntityDeleteStub).to.have.been.calledOnceWith(entity_name, query, options);
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            done();
        }, options);
    });

    it("should return an error when the deleteMany operation fails", (done) => {
        const expectedError = new Error("Failed to delete");
        deleteOneStub.rejects(expectedError); // Make deleteMany operation fail with an error
    
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            try {
                expect(err).to.equal(expectedError);
                expect(result).to.be.undefined;
                expect(deleteOneStub).to.have.been.calledOnceWith(query);
                expect(beforeEntityDeleteStub).to.have.been.calledOnceWith(entity_name, query, options);
                expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should call the callback with null and the result object on successful deletion", (done) => {
        db.deleteEntityFromQuery(entity_name, query, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(result).to.be.an('object').that.has.property('deletedCount', 1);
                expect(deleteOneStub).to.have.been.calledOnceWith(query);
                expect(beforeEntityDeleteStub).to.have.been.calledOnceWith(entity_name, query, options);
                expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

});