const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const db = require("../../../../../db/index.js");

describe("db.findAllEntities", () => {

    // Declare the mocked functions stubs and the parameters variables
    let findEntitiesFromQueryStub;
    let callbackStub;
    let entityName;
    let options;
    
    beforeEach(() => {
        // Create stubs for the findEntitiesFromQuery function and the callback
        findEntitiesFromQueryStub = sinon.stub(db, 'findEntitiesFromQuery');
        callbackStub = sinon.stub();
    
        // Set the values for the variables
        entityName = 'testEntity';
        options = { only: ["name", "properties.property"], without: ["_id"] };
    
        // Set up the logger to avoid side effects
        sinon.stub(logger, 'debug');
    });

    afterEach(() => {
        sinon.restore();
    });

    it("it should call findEntitiesFromQuery with an empty object as the query when no options are provided", (done) => {
        db.findAllEntities(entityName, callbackStub);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnceWithExactly(entityName, {}, callbackStub, undefined);

        done();
    });

    it("it should call findEntitiesFromQuery with the provided entity name and an empty query object", (done) => {
        db.findAllEntities(entityName, callbackStub, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnceWithExactly(entityName, {}, callbackStub, options);
    
        done();
    });

    it("it should pass the callback function to findEntitiesFromQuery without modification", (done) => {
        db.findAllEntities(entityName, callbackStub, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(entityName, {}, callbackStub, options);
    
        if (findEntitiesFromQueryStub.called) {
            const callbackArgs = findEntitiesFromQueryStub.firstCall.args[2];
            callbackArgs(null, []); // Simulate successful callback invocation
            expect(callbackStub).to.have.been.calledWith(null, []); // Verify callback was called with expected args
            done(); // Signal that the asynchronous operation has completed
        }
    });

    it("it should call findEntitiesFromQuery with the provided options when options are given", (done) => {
        db.findAllEntities(entityName, callbackStub, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(entityName, {}, callbackStub, options);
    
        done();
    });

    it("it should handle the case where options are not provided by using an empty object as default", (done) => {
        db.findAllEntities(entityName, callbackStub);
        
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(entityName, {}, callbackStub, undefined);
        
        findEntitiesFromQueryStub.callArgWith(2, null, []); // Simulate success with empty result
        
        expect(callbackStub).to.have.been.calledWith(null, []);
        
        done();
    });

});