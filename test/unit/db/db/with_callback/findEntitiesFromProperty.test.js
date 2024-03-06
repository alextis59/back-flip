const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const db = require("../../../../../db/index.js");

describe("db.findEntitiesFromProperty", () => {

    // Declare the variables outside the beforeEach block
    let findEntitiesFromQueryStub;
    let loggerDebugSpy;
    let callback;
    let entity_name;
    let property;
    let value;
    let options;
    
    beforeEach(() => {
        // Reset the values inside the beforeEach block
        entity_name = 'testEntity';
        property = 'testProperty';
        value = 'testValue';
        options = { only: ["name"], without: ["_id"] };
        callback = sinon.spy();
    
        // Set up the necessary mocks and stubs
        findEntitiesFromQueryStub = sinon.stub(db, 'findEntitiesFromQuery');
        loggerDebugSpy = sinon.spy(logger, 'debug');
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call findEntitiesFromQuery with the correct entity name, property, and value when no options are provided", (done) => {
        db.findEntitiesFromProperty(entity_name, property, value, callback);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(
            entity_name,
            { [property]: value },
            callback
        );
    
        expect(findEntitiesFromQueryStub.args[0][3]).to.be.undefined;

        done();
    });

    it("should call findEntitiesFromQuery with the correct entity name, property, value, and an empty options object when options are explicitly set to an empty object", (done) => {
        options = {};
    
        db.findEntitiesFromProperty(entity_name, property, value, callback, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(
            entity_name,
            { [property]: value },
            callback,
            {}
        );
    
        expect(loggerDebugSpy).to.have.been.calledWith(
            "db.findEntitiesFromProperty",
            { inputs: { entity_name, property, value } }
        );
    
        done();
    });

    it("should call findEntitiesFromQuery with the correct entity name, property, value, and given options when options are provided", (done) => {
        db.findEntitiesFromProperty(entity_name, property, value, callback, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnceWithExactly(entity_name, { [property]: value }, callback, options);
        expect(loggerDebugSpy).to.have.been.calledOnceWith("db.findEntitiesFromProperty", { inputs: { entity_name, property, value } });
    
        done();
    });

    it("should pass the callback function to findEntitiesFromQuery without modification", (done) => {
        db.findEntitiesFromProperty(entity_name, property, value, callback, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnce;
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(
            sinon.match(entity_name),
            sinon.match({ [property]: value }),
            sinon.match.same(callback),
            sinon.match(options)
        );
        
        done();
    });

    it("should construct the query object correctly when a single property and value are given", (done) => {
        db.findEntitiesFromProperty(entity_name, property, value, callback, options);
    
        const expectedQuery = {};
        expectedQuery[property] = value;
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnceWithExactly(
            entity_name,
            expectedQuery,
            callback,
            options
        );
    
        expect(loggerDebugSpy).to.have.been.calledOnceWithExactly(
            "db.findEntitiesFromProperty",
            { inputs: { entity_name, property, value } }
        );
    
        done();
    });

});