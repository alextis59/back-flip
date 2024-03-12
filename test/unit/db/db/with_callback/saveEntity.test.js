const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const correlator = require("correlation-id");
const db = require("../../../../../db/index.js");

describe("db.saveEntity", () => {

    // Declare the mocked functions stubs and the parameters variables
    let getCollectionStub;
    let replaceOneStub;
    let collectionMock;
    let entity_name;
    let entity;
    
    beforeEach(() => {
        // Set the values for the parameters
        entity_name = 'testEntity';
        entity = { _id: 'testId', data: 'testData' };
    
        // Create a stub for the logger.debug function
        sinon.stub(logger, 'debug');
    
        // Mock the MongoDB collection and its replaceOne method
        replaceOneStub = sinon.stub().resolves({ result: 'replaceOneResult' });
        collectionMock = {
            replaceOne: replaceOneStub
        };
    
        // Stub the getCollection method of the db module
        getCollectionStub = sinon.stub(db, 'getCollection').resolves(collectionMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call getCollection with the correct entity_name", (done) => {
        db.saveEntity(entity_name, entity, (err) => {
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            done();
        });
    });

    it("should return an error through the callback when getCollection encounters an error", (done) => {
        const error = new Error("Failed to get collection");
        getCollectionStub.rejects(error);
    
        db.saveEntity(entity_name, entity, (err) => {
            expect(err.message).to.equal("Database error: saveEntity");
            done();
        });
    });

    it("should call replaceOne on the collection with the correct _id and entity object when getCollection succeeds", (done) => {
        let expectedUpdate = Object.assign({last_modified: sinon.match.date}, entity);
        db.saveEntity(entity_name, entity, (err, result) => {
            try{
                expect(err).to.be.null;
                expect(result).to.deep.equal({ result: 'replaceOneResult' });
                expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
                expect(replaceOneStub).to.have.been.calledOnceWith({ _id: entity._id }, expectedUpdate);
                done();
            }catch(e){
                done(e);
            }
        });
    });

    it("should return the result through the callback when replaceOne resolves successfully", (done) => {
        let expectedUpdate = Object.assign({last_modified: sinon.match.date}, entity);
        db.saveEntity(entity_name, entity, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal({ result: 'replaceOneResult' });
            expect(getCollectionStub).to.have.been.calledOnceWithExactly(entity_name);
            expect(replaceOneStub).to.have.been.calledOnceWithExactly({ _id: entity._id }, expectedUpdate);
            expect(logger.debug).to.have.been.calledOnceWith("db.saveEntity", { inputs: { entity_name } });
            done();
        });
    });

    it("should return an error through the callback when replaceOne is rejected", (done) => {
        const replaceOneError = new Error("ReplaceOne failed");
        replaceOneStub.rejects(replaceOneError);
    
        db.saveEntity(entity_name, entity, (err) => {
            expect(err.message).to.equal("Database error: saveEntity");
            done();
        });
    });

});