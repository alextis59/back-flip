const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const correlator = require("correlation-id");
const db = require("../../../../../db/index.js");

describe("db.findEntitiesFromQuery", () => {

    // Declare the mocked functions stubs and the parameters variables
    let getCollectionStub;
    let _buildProjectionStub;
    let collectionFindStub;
    let toArrayStub;
    
    // Parameters for testing
    let entityName;
    let query;
    let callback;
    let options;
    
    beforeEach(() => {
        // Stub the getCollection method
        getCollectionStub = sinon.stub(db, 'getCollection');
        
        // Stub the _buildProjection method
        _buildProjectionStub = sinon.stub(db, '_buildProjection');
        
        // Create a fake collection object with a stub for the find method
        const collection = {
            find: sinon.stub()
        };
        collectionFindStub = collection.find;
        toArrayStub = sinon.stub().resolves([]);
        collectionFindStub.returns({ toArray: toArrayStub });
        _buildProjectionStub.returns({});
        
        // Set the getCollection stub to call the callback with the fake collection
        getCollectionStub.resolves(collection);
        
        // Initialize parameters for testing
        entityName = 'testEntity';
        query = { key: 'value' };
        callback = sinon.stub();
        options = {};
    });

    afterEach(() => {
        db.default_sort = undefined;
        sinon.restore();
    });

    it("should call getCollection with the correct entity name", (done) => {
        db.findEntitiesFromQuery(entityName, query, callback, options);
    
        expect(getCollectionStub).to.have.been.calledOnceWith(entityName);
    
        done();
    });

    it("should handle an error when getCollection fails", (done) => {
        const expectedError = new Error("Failed to get collection");
        getCollectionStub.rejects(expectedError);
    
        db.findEntitiesFromQuery(entityName, query, (err) => {
            try {
                expect(err.message).to.equal("Database error: findEntitiesFromQuery");
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should call _buildProjection with the options provided", (done) => {
        options = { only: ["name", "properties.property"], without: ["_id"] };
    
        db.findEntitiesFromQuery(entityName, query, (err) => {
            expect(err).to.be.null;
            expect(_buildProjectionStub).to.have.been.calledOnce;
            expect(_buildProjectionStub).to.have.been.calledWith(options);
            done();
        }, options);
    });

    it("should use an empty array for options.only if not provided", (done) => {
        db.findEntitiesFromQuery(entityName, query, (err) => {
            console.log(err);
            expect(err).to.be.null;
            expect(_buildProjectionStub).to.have.been.calledOnceWithExactly({ only: [], without: [] });
            expect(collectionFindStub).to.have.been.calledOnceWithExactly(query, {
                projection: {}
            });
            done();
        });
    });

    it("should use an empty array for options.without if not provided", (done) => {
        db.findEntitiesFromQuery(entityName, query, (err) => {
            expect(_buildProjectionStub).to.have.been.calledOnceWithExactly({
                only: [],
                without: []
            });
            expect(collectionFindStub).to.have.been.calledOnceWithExactly(query, {
                projection: {}
            });
            done();
        });
    });

    it("should use a default sort option if not provided", (done) => {
        db.default_sort = { path: 1 };
        db.findEntitiesFromQuery(entityName, query, (err, result) => {
            try {
                expect(err).to.be.null;

                expect(getCollectionStub).to.have.been.calledOnceWith(entityName);
    
                expect(_buildProjectionStub).to.have.been.calledOnceWith({ only: [], without: [], sort: { path: 1 } });
    
                expect(collectionFindStub).to.have.been.calledOnceWith(query, {
                    projection: {},
                    sort: { path: 1 } // This is the default sort option
                });
    
                expect(toArrayStub).to.have.been.calledOnce;

                expect(result).to.deep.equal([]);
    
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should call the MongoDB collection's find method with the correct query and options", (done) => {
        const expectedProjection = { a: 1, b: 1 };
        _buildProjectionStub.returns(expectedProjection);
        options = { only: ['a', 'b'], sort: {path: 1} };
    
        db.findEntitiesFromQuery(entityName, query, (err, result) => {
            try{
                expect(err).to.be.null;
                expect(result).to.deep.equal([]);
                expect(getCollectionStub).to.have.been.calledOnceWithExactly(entityName);
                expect(_buildProjectionStub).to.have.been.calledOnceWithExactly(options);
                expect(collectionFindStub).to.have.been.calledOnceWithExactly(query, { projection: expectedProjection, sort: {path: 1}});
                expect(toArrayStub).to.have.been.calledOnce;
                done();
            }catch(e){
                done(e);
            }
        }, options);
    });

    it("should handle the successful retrieval of entities from the collection", (done) => {
        const expectedEntities = [{ id: 1, name: 'Entity1' }, { id: 2, name: 'Entity2' }];
        toArrayStub.resolves(expectedEntities);
    
        db.findEntitiesFromQuery(entityName, query, (err, entities) => {
            try {
                expect(err).to.be.null;
    
                expect(entities).to.deep.equal(expectedEntities);
    
                expect(getCollectionStub).to.have.been.calledWith(entityName);
    
                expect(_buildProjectionStub).to.have.been.calledWith({ only: [], without: [] });
    
                expect(collectionFindStub).to.have.been.calledWith(query, { projection: {} });
    
                expect(toArrayStub).to.have.been.calledOnce;
    
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should handle an error when the collection's toArray method fails", (done) => {
        const toArrayError = new Error("Error in toArray");
        toArrayStub.rejects(toArrayError);
    
        db.findEntitiesFromQuery(entityName, query, (err) => {
            try {
                expect(err.message).to.equal("Database error: findEntitiesFromQuery");
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

});