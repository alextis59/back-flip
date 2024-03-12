const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const db = require("../../../../../db/index.js");

describe("db.getCollection", () => {

    let connectStub;
    let collectionStub;
    let callbackSpy;
    let entityName;
    
    beforeEach(() => {
        // Stub the connect function
        connectStub = sinon.stub(db, 'connect');
    
        // Spy on callback to check if it's been called with the right arguments
        callbackSpy = sinon.spy();
    
        // Stub the db.collection method that would be called within getCollection
        collectionStub = sinon.stub();
        db.db = { collection: collectionStub };

        connectStub.resolves();
        
        // Set a default entity name for use in tests
        entityName = 'testEntity';
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should invoke the callback with an error when the database connection fails", (done) => {
        const expectedError = new Error("Connection failed");
        connectStub.rejects(expectedError);
    
        db.getCollection(entityName, (err) => {
            try {
                expect(err.message).to.equal("Database error: getCollection");
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should call self.connect once with a callback when trying to get a collection", (done) => {
        collectionStub.returns({}); // Simulate collection method return
    
        db.getCollection(entityName, (err) => {
            expect(connectStub).to.have.been.calledOnce;
            expect(connectStub).to.have.been.calledWith();
            done();
        });
    });

    it("should invoke the callback with the collection when the database connection succeeds and the collection is found", (done) => {
        const mockCollection = {test: 'a'};
        collectionStub.withArgs(entityName).returns(mockCollection);
        
        db.getCollection(entityName, (err, collection) => {
            try {
                expect(err).to.be.null;
                expect(collection).to.equal(mockCollection);
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should pass the correct entity_name to the db.collection method when the database connection succeeds", (done) => {
        collectionStub.returns({test: 'b'}); // Simulate collection method return
    
        db.getCollection(entityName, (err, collection) => {
            try {
                expect(collectionStub).to.have.been.calledWith(entityName);
                done();
            } catch (error) {
                done(error);
            }
        });
    });

});