const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const _ = require('lodash');
const db_tracking = require("../../../../../db/tracking");
const correlator = require("correlation-id");
const db = require("../../../../../db/index.js");

describe("db.createEntities", () => {

    // Declare the mocked functions stubs and the parameters variables
    let getNowStub, getCollectionStub, onEventStub, insertManyStub;
    let entity_name, list, cb, options, collectionMock, resultMock, errorMock;
    
    beforeEach(() => {
        // Reset the values for each test case
        entity_name = "testEntity";
        list = [{}, {}]; // Example list with two empty objects
        cb = sinon.spy();
        options = {};
        resultMock = { insertedCount: 2, ops: list, insertedIds: ["1", "2"] };
        errorMock = new Error("Test error");
    
        // Create stubs for the functions that will be mocked
        getNowStub = sinon.stub(db, 'getNow').returns(new Date());
        getCollectionStub = sinon.stub(db, 'getCollection');
        insertManyStub = sinon.stub().resolves(resultMock);
        onEventStub = sinon.stub(db, 'onEvent');
    
        // Mock the collection object that getCollection will provide
        collectionMock = {
            insertMany: insertManyStub
        };
    
        // Define the async getCollection stub to return the collectionMock
        getCollectionStub.resolves(collectionMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call getNow and getCollection with the correct entity_name when creating entities", (done) => {
        db.createEntities(entity_name, list, () => {
            expect(getNowStub).to.have.been.calledOnce;
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            done();
        }, options);
    });

    it("should add a creation_date to each item in the list using the date from getNow", (done) => {
        const now = new Date();
        getNowStub.returns(now); // Ensure getNow returns a consistent date
    
        db.createEntities(entity_name, list, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal(resultMock);
            expect(list[0]).to.have.property('creation_date', now);
            expect(list[1]).to.have.property('creation_date', now);
            expect(getNowStub).to.have.been.calledOnce;
            done();
        });
    });

    it("should add _id attribute to entities list and call onEvent with correct args", (done) => {
        db.createEntities(entity_name, list, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal(resultMock);
            expect(list).to.deep.equal([
                { creation_date: getNowStub.returnValues[0], _id: "1"}, 
                { creation_date: getNowStub.returnValues[0], _id: "2"}
            ]);
            expect(onEventStub).to.have.been.calledOnceWith('create', {entity_name, entities: list, options: {}, result: resultMock});
            expect(getCollectionStub).to.have.been.calledWith(entity_name);
            expect(insertManyStub).to.have.been.calledWith(list);
            done();
        });
    });

    it("should call the callback with an error if getCollection encounters an error", (done) => {
        getCollectionStub.rejects(errorMock);
    
        db.createEntities(entity_name, list, (err) => {
            expect(err.message).to.equal("Database error: createEntities");
            done();
        });
    });

    it("should call insertMany on the collection with the list of items if getCollection succeeds", (done) => {
        db.createEntities(entity_name, list, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal(resultMock);
            expect(getCollectionStub).to.have.been.calledOnceWith(entity_name);
            expect(insertManyStub).to.have.been.calledOnceWith(list);
            done();
        });
    });

    it("should call the callback with null and the result of insertMany when insertMany resolves successfully", (done) => {
        db.createEntities(entity_name, list, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(result).to.deep.equal(resultMock);
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("should call the callback with an error when insertMany is rejected", (done) => {
        insertManyStub.rejects(errorMock);
    
        db.createEntities(entity_name, list, (err) => {
            expect(err.message).to.equal("Database error: createEntities");
            done();
        }, options);
    });

});