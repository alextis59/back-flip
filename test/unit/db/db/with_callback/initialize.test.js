const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const db_tracking = require("../../../../../db/tracking");
const db = require("../../../../../db/index.js");

xdescribe("db.initialize", () => {

    let dbTrackingInitializeStub;
    let originalEnv;
    
    beforeEach(() => {
        // Save the original process.env to restore it later
        originalEnv = { ...process.env };
    
        // Create a stub for the db_tracking.initialize method
        dbTrackingInitializeStub = sinon.stub(db_tracking, 'initialize');
    
        // Reset the db object to its original state
        db.db_uri = process.env.MONGODB_URL || 'mongodb://db/';
        db.db_name = 'traxxs';
        db.service_name = 'unknown';
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call db_tracking.initialize with the db object when initialize is invoked", (done) => {
        db.initialize();
    
        expect(dbTrackingInitializeStub).to.have.been.calledOnceWithExactly(db);
    
        done();
    });

    it("should set db_uri to the default MONGODB_URL from the environment if no uri is provided", (done) => {
        const defaultMongoDbUrl = "mongodb://default_env_db/";
        process.env.MONGODB_URL = defaultMongoDbUrl;
    
        db.db_uri = process.env.MONGODB_URL || 'mongodb://db/';
        db.db_name = 'traxxs';
        db.service_name = 'unknown';
    
        db.initialize();
    
        expect(dbTrackingInitializeStub).to.have.been.calledWith(db);
    
        expect(db.db_uri).to.equal(defaultMongoDbUrl);
    
        process.env = originalEnv;
    
        done();
    });

    it("should set db_uri to the provided uri with '/traxxs' replaced with '/' when a uri is provided", (done) => {
        const newUri = "mongodb://somehost:27017/traxxs";
    
        db.initialize(newUri, 'testService');
    
        expect(db_tracking.initialize).to.have.been.calledOnceWith(db);
        expect(db.db_uri).to.equal(newUri.replace('/traxxs', '/'));
        expect(db.service_name).to.equal('testService');
        done();
    });

    it("should keep the db_name as 'traxxs' after initialization", (done) => {
        db.initialize(null, null);
    
        expect(db.db_name).to.equal('traxxs');
        expect(dbTrackingInitializeStub).to.have.been.calledOnceWithExactly(db);
        done();
    });

    it("should set service_name to 'unknown' if no service name is provided", (done) => {
        db.initialize(db.db_uri, null);
    
        expect(dbTrackingInitializeStub).to.have.been.calledOnceWith(db);
    
        expect(db.service_name).to.equal('unknown');
    
        done();
    });

    it("should set service_name to the provided service name when a service name is provided", (done) => {
        const service = "testService";
    
        db.initialize(null, service);
    
        expect(db.service_name).to.equal(service);
        done();
    });

});