const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const db = require("../../../../../db/index.js");

describe("db.findEntitiesFromPropertyValues", () => {

    let findEntitiesFromQueryStub;
    let callbackStub;
    let entityName;
    let property;
    let valueList;
    let options;
    
    beforeEach(() => {
        // Stub the findEntitiesFromQuery function
        findEntitiesFromQueryStub = sinon.stub(db, 'findEntitiesFromQuery');
    
        // Create a stub for the callback function
        callbackStub = sinon.stub();
    
        // Initialize the parameters that will be used in the tests
        entityName = 'testEntity';
        property = 'testProperty';
        valueList = ['value1', 'value2'];
        options = { only: ["name", "properties.property"], without: ["_id"] };
    
        // Stub the logger.debug function to prevent actual logging during tests
        sinon.stub(logger, 'debug');
    });

    afterEach(() => {
        sinon.restore();
    });

    it("it should call findEntitiesFromQuery with correct entity name, query object, callback, and options when all parameters are provided", (done) => {
        db.findEntitiesFromPropertyValues(entityName, property, valueList, callbackStub, options);
    
        const expectedQueryObject = { [property]: { $in: valueList } };
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnce;
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(
            entityName,
            expectedQueryObject,
            callbackStub,
            options
        );

        done();
    });

    it("it should call findEntitiesFromQuery with correct entity name, query object, and callback when options parameter is not provided", (done) => {
        db.findEntitiesFromPropertyValues(entityName, property, valueList, callbackStub);
    
        const expectedQuery = { [property]: { $in: valueList } };
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnceWithExactly(entityName, expectedQuery, callbackStub, undefined);
    
        callbackStub();
        done();
    });

    it("it should call findEntitiesFromQuery with correct entity name and query object containing the property with an $in operator and the provided value list", (done) => {
        db.findEntitiesFromPropertyValues(entityName, property, valueList, callbackStub, options);
    
        const expectedQuery = {};
        expectedQuery[property] = { $in: valueList };
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(entityName, expectedQuery, callbackStub, options);
    
        done();
    });

    it("it should pass the callback function as is to findEntitiesFromQuery", (done) => {
        db.findEntitiesFromPropertyValues(entityName, property, valueList, callbackStub, options);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledOnceWithExactly(
            entityName,
            { [property]: { $in: valueList } },
            callbackStub,
            options
        );
    
        done();
    });

    it("it should pass undefined options to findEntitiesFromQuery when the options parameter is not provided", (done) => {
        db.findEntitiesFromPropertyValues(entityName, property, valueList, callbackStub);
    
        expect(findEntitiesFromQueryStub).to.have.been.calledWith(entityName, { [property]: { $in: valueList } }, callbackStub, undefined);
    
        done();
    });

});