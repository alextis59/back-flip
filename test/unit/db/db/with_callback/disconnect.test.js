const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const db = require("../../../../../db/index.js");

describe("db.disconnect", () => {

    // Declare the variables that will be used in the beforeEach block and tests
    let loggerInfoStub;
    let loggerErrorStub;
    let clientCloseStub;
    
    beforeEach(() => {
        // Reset the db object to its original state
        db.db = null;
        db.client = null;
    
        // Create stubs for the logger methods
        loggerInfoStub = sinon.stub(logger, "info");
        loggerErrorStub = sinon.stub(logger, "error");
    
        // Create a stub for the client's close method, if needed
        if (db.client) {
            clientCloseStub = sinon.stub(db.client, "close");
        }
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should call the callback without an error when 'self.client' is undefined", (done) => {
        const callback = sinon.spy();
    
        db.disconnect(callback);
    
        expect(loggerInfoStub).not.to.have.been.called;
        expect(loggerErrorStub).not.to.have.been.called;
    
        expect(callback).to.have.been.calledOnce;
        expect(callback).to.have.been.calledWithExactly();
        done();
    });

    it("should close the database connection and call the callback without an error when 'self.client' is defined", (done) => {
        db.client = { close: () => {} };
        clientCloseStub = sinon.stub(db.client, "close").resolves();
    
        const callback = sinon.spy();
    
        db.disconnect(callback);
    
        clientCloseStub().then(() => {
            expect(loggerInfoStub).to.have.been.calledWith("DB connection closed");
            expect(callback).to.have.been.calledOnce;
            expect(callback).to.have.been.calledWithExactly();
            expect(db.db).to.be.null;
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it("should set 'self.db' to null after successfully closing the database connection", (done) => {
        db.client = { close: () => {} };
        clientCloseStub = sinon.stub(db.client, "close").resolves();
    
        db.disconnect((err) => {
            expect(err).to.be.undefined;
            expect(db.db).to.be.null;
            expect(loggerInfoStub).to.have.been.calledWith("DB connection closed");
            done();
        });
    });

    it("should call the callback with an error when closing the database connection fails", (done) => {
        const fakeError = new Error("Failed to close connection");
        db.client = { close: () => {} };
        clientCloseStub = sinon.stub(db.client, "close").rejects(fakeError);
    
        const callback = (err) => {
            expect(loggerErrorStub).to.have.been.calledWith("DB connection close failed: %s", fakeError.message);
            expect(err).to.equal(fakeError);
            done();
        };
    
        db.disconnect(callback);
    });

});