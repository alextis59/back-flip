const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const {MongoClient, ObjectId} = require("mongodb");
const db = require("../../../../../db/index.js");
const utils = require('side-flip/utils');

describe("db.findEntityFromID", () => {

    // Declare the variables outside the beforeEach block
    let findEntityFromQueryStub;
    let loggerDebugStub;
    let callbackSpy;
    let options;
    
    beforeEach(() => {
        // Reset the stubs and spies before each test case
        sinon.restore();
    
        // Stub the findEntityFromQuery function
        findEntityFromQueryStub = sinon.stub(db, 'findEntityFromQuery');
    
        // Stub the logger.debug function
        loggerDebugStub = sinon.stub(logger, 'debug');
    
        // Create a spy for the callback function
        callbackSpy = sinon.spy();
    
        // Initialize the options object that might be used in test cases
        options = { only: ["name", "properties.property"], without: ["_id"] };
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call the callback with an error when the provided ID is undefined", (done) => {
        const entity_name = 'device';
        const id = undefined; // ID is explicitly undefined
    
        db.findEntityFromID(entity_name, id, (err, result) => {
            try{
                expect(err).to.be.an.instanceOf(Error);
                expect(err.message).to.equal("Invalid parameter: id");
                expect(result).to.be.undefined;
                expect(findEntityFromQueryStub).not.to.have.been.called;
                expect(loggerDebugStub).to.have.been.calledWith("db.findEntityFromID", { inputs: { entity_name, id } });
                done();
            }catch(error){
                done(error);
            }
        }, options);
    });

    it("should call the callback with an error when the provided ID is an empty string", (done) => {
        const emptyId = "";
        
        db.findEntityFromID("entity_name", emptyId, (err, result) => {
            expect(err).to.be.an.instanceOf(Error);
            expect(err.message).to.equal("Invalid parameter: id");
            expect(result).to.be.undefined;
            expect(findEntityFromQueryStub).not.to.have.been.called;
            expect(loggerDebugStub).to.have.been.calledWith("db.findEntityFromID", { inputs: { entity_name: "entity_name", id: emptyId } });
            done();
        }, options);
    });

    it("should call the callback with an error when the provided ID does not match a 24 hexadecimal string", (done) => {
        const invalidIDs = ["12345", "xyz", "1".repeat(25), "a".repeat(11), ""];

        utils.asyncEach(invalidIDs, (invalidID, next) => {
            db.findEntityFromID("device", invalidID, (err, result) => {
                try{
                    expect(err).to.be.an.instanceOf(Error);
                    expect(err.message).to.equal("Invalid parameter: id");
                    expect(result).to.be.undefined;
                    expect(findEntityFromQueryStub).not.to.have.been.called;
                    expect(loggerDebugStub).to.have.been.calledWith("db.findEntityFromID", { inputs: { entity_name: "device", id: invalidID } });
                    next();
                }catch(e){
                    done(e);
                }
            }, options);
        }, () => {
            done();
        }, {keep_order: true});
    });

    it("should convert the ID to a string if it has a toString method", (done) => {
        const mockId = {
            toString: sinon.stub().returns("507f1f77bcf86cd799439011")
        };
    
        db.findEntityFromID("entity", mockId, callbackSpy, options);
    
        setImmediate(() => {
            try {
                expect(findEntityFromQueryStub).to.have.been.calledWith(
                    "entity",
                    { _id: new ObjectId(mockId.toString()) },
                    callbackSpy,
                    options
                );
                expect(loggerDebugStub).to.have.been.calledWith("db.findEntityFromID", { inputs: { entity_name: "entity", id: mockId } });
                done();
            } catch (e) {
                done(e);
            }
        });
    });

    it("should call findEntityFromQuery with the correct entity name, query, callback, and options when the ID is a valid 24 character hexadecimal string", (done) => {
        const validId = "507f1f77bcf86cd799439011";
        const entityName = "device";
    
        db.findEntityFromID(entityName, validId, callbackSpy, options);
    
        const expectedQuery = { _id: new ObjectId(validId) };
        expect(findEntityFromQueryStub).to.have.been.calledOnceWithExactly(entityName, expectedQuery, callbackSpy, options);
        done();
    });

    it("should call findEntityFromQuery with the correct entity name, query, callback, and options when the ID is a valid 12 character hexadecimal string", (done) => {
        const entityId = "507f1f77bcf86cd799439012";
        const entityName = "device";

        db.findEntityFromID(entityName, entityId, callbackSpy, options);

        sinon.assert.calledOnce(findEntityFromQueryStub);
        sinon.assert.calledWith(findEntityFromQueryStub, entityName, { _id: new ObjectId(entityId) }, callbackSpy, options);
        done();
    });

    it("should call findEntityFromQuery with an ObjectId created from the ID when the ID is valid", (done) => {
        const validId = "507f1f77bcf86cd799439011"; // Example of a 24 character hexadecimal ID
        const entityName = "device"; // Example entity name
    
        db.findEntityFromID(entityName, validId, callbackSpy, options);
    
        expect(findEntityFromQueryStub).to.have.been.calledOnce;
        expect(findEntityFromQueryStub.firstCall.args[0]).to.equal(entityName);
        expect(findEntityFromQueryStub.firstCall.args[1]._id).to.be.an.instanceof(ObjectId);
        expect(findEntityFromQueryStub.firstCall.args[1]._id.toString()).to.equal(validId);
        expect(findEntityFromQueryStub.firstCall.args[2]).to.equal(callbackSpy);
        expect(findEntityFromQueryStub.firstCall.args[3]).to.equal(options);
        expect(callbackSpy).to.not.have.been.called;
    
        done();
    });

    it("should pass the options object to findEntityFromQuery if provided", (done) => {
        const entityId = "507f1f77bcf86cd799439011"; // Mocked valid ObjectId
        findEntityFromQueryStub.callsFake((entity_name, query, cb, opts) => {
            expect(opts).to.deep.equal(options); // Additional assertion for options
            cb(null, {}); // Simulate successful db operation
        });
    
        db.findEntityFromID("device", entityId, callbackSpy, options);
    
        expect(findEntityFromQueryStub).to.have.been.calledWith(
            "device",
            { _id: new ObjectId(entityId) },
            sinon.match.func,
            options
        );
        expect(callbackSpy).to.have.been.calledOnce;
        done();
    });

    it("should call findEntityFromQuery with undefined options when no options are provided", (done) => {
        const entityId = new ObjectId().toString();
        findEntityFromQueryStub.callsFake((entity_name, query, cb, options) => {
            cb(null, { result: "mocked result" }); // Call the callback directly with mocked result
        });

        db.findEntityFromID("device", entityId, callbackSpy);

        setImmediate(() => {
            try {
                expect(findEntityFromQueryStub).to.have.been.calledWith(
                    "device",
                    { _id: sinon.match.instanceOf(ObjectId) },
                    sinon.match.func,
                    undefined
                );
                expect(callbackSpy).to.have.been.calledWith(null, { result: "mocked result" }); // Ensure that the callback is called with the expected result
                done();
            } catch (error) {
                done(error);
            }
        });
    });

});