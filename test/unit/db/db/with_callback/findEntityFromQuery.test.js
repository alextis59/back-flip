const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const correlator = require("correlation-id");
const db = require("../../../../../db/index.js");

describe("db.findEntityFromQuery", () => {

    // Declare the mocked functions stubs and the parameters variables
    let getCollectionStub, findOneStub, buildProjectionStub;
    let collection, entityName, query, callback, options;
    
    beforeEach(() => {
        // Reset the values for each test
        entityName = 'testEntity';
        query = { key: 'value' };
        callback = sinon.stub();
        options = { only: ['name'], without: ['_id'] };
    
        // Create stubs for the functions that will be mocked
        getCollectionStub = sinon.stub(db, 'getCollection');
        buildProjectionStub = sinon.stub(db, '_buildProjection');
    
        // Mock the collection to have a findOne method
        findOneStub = sinon.stub().resolves({});
        collection = { findOne: findOneStub };
    
        // Make the getCollection stub call its callback with the mocked collection
        getCollectionStub.resolves(collection);
    
        // Make the _buildProjection stub return a fake projection object
        buildProjectionStub.returns({});
    
        // Stub logger.debug to avoid console output during tests
        sinon.stub(logger, 'debug');
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call getCollection with the correct entity name and a callback function", (done) => {
        db.findEntityFromQuery(entityName, query, (err, result) => {
            try {
                expect(getCollectionStub).to.have.been.calledOnceWith(entityName);
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should return an error when getCollection encounters an error", (done) => {
        const testError = new Error('Error getting collection');
        getCollectionStub.rejects(testError);

        db.findEntityFromQuery(entityName, query, (err) => {
            try {
                expect(err).to.deep.equal(testError);
                expect(buildProjectionStub).not.to.have.been.called;
                expect(findOneStub).not.to.have.been.called;
                expect(logger.debug).to.have.been.called;
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should call _buildProjection with the options provided", (done) => {
        db.findEntityFromQuery(entityName, query, () => {
            expect(buildProjectionStub).to.have.been.calledOnceWithExactly(options);
            done();
        }, options);
    });

    it("should call findOne on the collection with the correct query and projection", (done) => {
        const expectedProjection = { name: 1, _id: 0 };
        buildProjectionStub.returns(expectedProjection);
    
        db.findEntityFromQuery(entityName, query, (err) => {
            try {
                expect(getCollectionStub).to.have.been.calledOnceWithExactly(entityName);
                expect(buildProjectionStub).to.have.been.calledOnceWithExactly(options);
                expect(findOneStub).to.have.been.calledOnceWithExactly(query, { projection: expectedProjection });
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should return the found entity when the query is successful", (done) => {
        const expectedEntity = { name: 'Test Entity' };
        findOneStub.resolves(expectedEntity);
    
        db.findEntityFromQuery(entityName, query, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(result).to.deep.equal(expectedEntity);
                expect(getCollectionStub).to.have.been.calledOnceWithExactly(entityName);
                expect(buildProjectionStub).to.have.been.calledOnceWithExactly(options);
                expect(findOneStub).to.have.been.calledOnceWithExactly(query, { projection: {} });
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should return an error when the findOne query operation fails", (done) => {
        const testError = new Error('Query failed');
        findOneStub.rejects(testError);
    
        db.findEntityFromQuery(entityName, query, (err, result) => {
            try {
                expect(err).to.be.an('error');
                expect(err).to.deep.equal(testError);
                expect(result).to.be.undefined;
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should handle the case where options are not provided by using default empty arrays for 'only' and 'without'", (done) => {
        db.findEntityFromQuery(entityName, query, (err, result) => {
            expect(err).to.be.null;
            expect(result).to.deep.equal({});
            expect(buildProjectionStub).to.have.been.calledOnceWithExactly({ only: [], without: [] });
            expect(findOneStub).to.have.been.calledOnceWithExactly(query, { projection: {} });
            done();
        });
    });

    it("should correctly handle the option to only include specified attributes in the result", (done) => {
        const projection = { name: 1 };
        const expectedResult = { name: 'Test Entity' };
        buildProjectionStub.withArgs(options).returns(projection);
        findOneStub.resolves(expectedResult);
        
        db.findEntityFromQuery(entityName, query, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(result).to.eql(expectedResult);
                expect(buildProjectionStub).to.have.been.calledOnceWithExactly(options);
                expect(getCollectionStub).to.have.been.calledOnceWithExactly(entityName);
                expect(findOneStub).to.have.been.calledOnceWithExactly(query, { projection });
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

    it("should correctly handle the option to exclude specified attributes from the result", (done) => {
        const expectedResult = { name: 'testName' }; // Mock result from findOne without the excluded attribute '_id'
        findOneStub.resolves(expectedResult);
        buildProjectionStub.withArgs(options).returns({ _id: 0 });
    
        db.findEntityFromQuery(entityName, query, (err, result) => {
            try {
                expect(err).to.be.null;
                expect(buildProjectionStub).to.have.been.calledWith(options);
                expect(findOneStub).to.have.been.calledWith(query, { projection: { _id: 0 } });
                expect(result).to.eql(expectedResult);
                done();
            } catch (error) {
                done(error);
            }
        }, options);
    });

});