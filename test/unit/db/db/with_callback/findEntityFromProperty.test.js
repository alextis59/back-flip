const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const db = require("../../../../../db/index.js");

describe("db.findEntityFromProperty", () => {

    // Declare the mocked functions stubs and the parameters variables
    let findEntityFromQueryStub;
    let loggerDebugStub;
    let callbackStub;
    let entity_name;
    let property;
    let value;
    let options;
    
    beforeEach(() => {
        // Set up the stubs and spies
        findEntityFromQueryStub = sinon.stub(db, 'findEntityFromQuery');
        loggerDebugStub = sinon.stub(logger, 'debug');
        callbackStub = sinon.stub();
    
        // Set the values for the variables
        entity_name = 'testEntity';
        property = 'testProperty';
        value = 'testValue';
        options = { only: ['name'], without: ['_id'] };
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call findEntityFromQuery with the correct entity name, property, and value when no options are provided", (done) => {
        db.findEntityFromProperty(entity_name, property, value, callbackStub);
    
        expect(findEntityFromQueryStub).to.have.been.calledOnceWithExactly(entity_name, { [property]: value }, callbackStub, undefined);
    
        expect(loggerDebugStub).to.have.been.calledOnceWith("db.findEntityFromProperty", { inputs: { entity_name, property, value } });

        done();
    });

    it("should call findEntityFromQuery with the correct entity name, property, value, and only options when only options are provided", (done) => {
        db.findEntityFromProperty(entity_name, property, value, callbackStub, { only: options.only });
    
        expect(findEntityFromQueryStub).to.have.been.calledOnceWith(
            entity_name,
            { [property]: value },
            callbackStub,
            { only: options.only }
        );
    
        expect(loggerDebugStub).to.have.been.calledOnceWith(
            "db.findEntityFromProperty",
            { inputs: { entity_name, property, value } }
        );
    
        done();
    });

    it("should call findEntityFromQuery with the correct entity name, property, value, and without options when without options are provided", (done) => {
        db.findEntityFromProperty(entity_name, property, value, callbackStub, {});
    
        const expectedQuery = {};
        expectedQuery[property] = value;
    
        expect(findEntityFromQueryStub).to.have.been.calledOnceWithExactly(entity_name, expectedQuery, callbackStub, {});
    
        expect(loggerDebugStub).to.have.been.calledOnce;
    
        done();
    });

    it("should call findEntityFromQuery with the correct entity name, property, value, and both only and without options when both options are provided", (done) => {
        db.findEntityFromProperty(entity_name, property, value, callbackStub, options);
    
        expect(findEntityFromQueryStub).to.have.been.calledOnceWith(
            entity_name,
            { [property]: value },
            callbackStub,
            { only: ['name'], without: ['_id'] }
        );
    
        expect(loggerDebugStub).to.have.been.calledOnceWith(
            "db.findEntityFromProperty",
            { inputs: { entity_name, property, value } }
        );
    
        done();
    });

    it("should call the callback with the result from findEntityFromQuery", (done) => {
        const expectedResult = { name: 'Test Entity' };
        const expectedQuery = { [property]: value };
    
        findEntityFromQueryStub.callsFake((entity, query, cb, opts) => {
            cb(null, expectedResult);
        });
    
        db.findEntityFromProperty(entity_name, property, value, callbackStub, options);
    
        expect(findEntityFromQueryStub).to.have.been.calledOnceWithExactly(entity_name, expectedQuery, sinon.match.func, options);
    
        expect(callbackStub).to.have.been.calledOnceWithExactly(null, expectedResult);
    
        done();
    });

});