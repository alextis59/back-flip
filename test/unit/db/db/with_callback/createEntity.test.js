const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const db = require("../../../../../db/index.js");

describe("db.createEntity", () => {

    let createEntitiesStub;
    let entityName;
    let entityObject;
    let callback;
    let options;
    
    beforeEach(() => {
        // Stub the `createEntities` method
        createEntitiesStub = sinon.stub(db, 'createEntities');
        
        // Set up the variables with default values
        entityName = 'testEntity';
        entityObject = { id: 1, name: 'Test Object' };
        callback = sinon.spy();
        options = { option1: 'value1' };
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call createEntities with the correct entity name and a single object wrapped in an array", () => {
        db.createEntity(entityName, entityObject, callback, options);
    
        expect(createEntitiesStub).to.have.been.calledOnceWithExactly(entityName, [entityObject], callback, options);
    });

    it("should pass the provided callback function to createEntities", () => {
        db.createEntity(entityName, entityObject, callback, options);
    
        expect(createEntitiesStub).to.have.been.calledWith(entityName, [entityObject], callback, options);
    });

    it("should pass the provided options object to createEntities", () => {
        db.createEntity(entityName, entityObject, callback, options);
    
        expect(createEntitiesStub).to.have.been.calledOnceWithExactly(entityName, [entityObject], callback, options);
    });

    it("should handle the case when no callback function is provided by using a default empty function", () => {
        db.createEntity(entityName, entityObject, undefined, options);
    
        expect(createEntitiesStub).to.have.been.calledOnceWith(entityName, [entityObject], sinon.match.func, options);
    
        const actualCallback = createEntitiesStub.args[0][2];
    
        expect(actualCallback).to.be.a('function');
    
        expect(() => actualCallback()).not.to.throw();
    });

    it("should handle the case when no options object is provided by using a default empty object", () => {
        db.createEntity(entityName, entityObject, callback);
    
        expect(createEntitiesStub).to.have.been.calledWith(entityName, [entityObject], callback, sinon.match.object);
        expect(createEntitiesStub.args[0][3]).to.deep.equal({}); // Check that the options parameter is an empty object
    });

});