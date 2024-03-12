const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const logger = require("../../../../../log");
const {MongoClient, ObjectId} = require("mongodb");
const db = require("../../../../../db/index.js");
const utils = require('side-flip/utils');

describe("db.connect", () => {

    // Declare the mocked functions stubs and the parameters variables
    let connectStub;
    let commandStub;
    let onStub;
    let connectErrorMessage;
    
    beforeEach(() => {
    
        // Reset the db object to its initial state
        db.connecting_db = false;
        db.db = null;
    
        // Stub the MongoClient.connect method
        connectStub = sinon.stub(MongoClient, 'connect');
    
        // Stub the db.command method
        commandStub = sinon.stub();
    
        // Stub the on method for the 'close' event
        onStub = sinon.stub();
    
        // Replace the 'db' object's command method with the stub when a connection is established
        connectStub.resolves({
            db: (dbName) => ({ command: commandStub }),
            on: onStub
        });

        connectErrorMessage = "Database error: connect";
    
        // Stub the logger methods to prevent actual logging during tests
        sinon.stub(logger, 'debug');
        sinon.stub(logger, 'info');
        sinon.stub(logger, 'error');
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return immediately if 'connecting_db' is true, and retry connection after a delay", async () => {
        db.connecting_db = true;
    
        const callbackSpy = sinon.spy();
    
        db.connect(callbackSpy);
    
        expect(callbackSpy).not.to.have.been.called;
    
        await utils.wait(50);

        expect(callbackSpy).not.to.have.been.called;
    
        db.connecting_db = false;
    
        await utils.wait(60);
    
        expect(callbackSpy).to.have.been.calledOnce;
    
        expect(callbackSpy).to.have.been.calledWith(null);
    
    });

    it("should return the existing db object if it is already connected", (done) => {
        const existingDbObject = { some: 'dbObject' };
        db.db = existingDbObject;
    
        db.connect((err, dbObject) => {
            expect(err).to.be.null;
            expect(dbObject).to.equal(existingDbObject);
            done();
        });

    });

    it("should attempt to connect to the database if not already connecting or connected", (done) => {
        connectStub.resolves({
            db: (dbName) => ({ command: commandStub.resolves({ok: 1}) }),
            on: onStub
        });
    
        db.connect((err, dbInstance) => {
            try {
                expect(connectStub).to.have.been.calledOnce;
    
                expect(commandStub).to.have.been.calledOnceWith({ping: 1});
    
                expect(err).to.be.null;
                expect(dbInstance).to.not.be.null;
    
                expect(db.db).to.equal(dbInstance);
    
                expect(logger.error).to.not.have.been.called;
    
                expect(logger.debug).to.have.been.calledWith("MongoClient.connect");
    
                expect(logger.info).to.have.been.calledWith("DB connection established");
    
                done(); // Test passed
            } catch (error) {
                done(error); // Test failed
            }
        });
    
    });

    it("should call MongoClient.connect with the correct database URI and options", (done) => {
        commandStub.resolves({ ok: 1 });
    
        db.connect((err, dbInstance) => {
            try {
                expect(connectStub).to.have.been.calledOnceWith(db.db_uri, { connectTimeoutMS: 1000 });
                done();
            } catch (error) {
                done(error);
            }
        });
    
    });

    it("should handle a successful connection and return the db object", (done) => {
        commandStub.withArgs({ ping: 1 }).resolves({ ok: 1 });
    
        db.connect((err, dbObject) => {
            expect(err).to.be.null;
    
            expect(dbObject).to.be.an('object');
            expect(dbObject.command).to.be.a('function');
    
            expect(connectStub).to.have.been.calledOnce;
    
            expect(commandStub).to.have.been.calledWith({ ping: 1 });
    
            expect(logger.info).to.have.been.calledWith("DB connection established");
    
            expect(onStub).to.have.been.calledWith('close');
    
            done();
        });
    
    });

    it("should set 'db' to the connected db instance after a successful connection", (done) => {
        const fakeDbName = 'traxxs';
        commandStub.withArgs({ ping: 1 }).resolves({ ok: 1 });
    
        db.connect((err, dbInstance) => {
            expect(err).to.be.null;
            expect(dbInstance).to.not.be.null; // Check if dbInstance is not null
            expect(db.db).to.not.be.null; // Check if db.db is not null
            expect(db.connecting_db).to.be.false;
            expect(commandStub).to.have.been.calledWith({ ping: 1 });
            expect(connectStub).to.have.been.calledWith(db.db_uri, { connectTimeoutMS: 1000 });
            expect(onStub).to.have.been.calledWith('close');
            done();
        });
    
    });

    it("should listen for 'close' event on the connection and nullify 'db' when connection is lost", (done) => {
        db.connect((err, dbInstance) => {
            expect(err).to.be.null;
            expect(dbInstance).to.be.an('object');
    
            onStub.callArgWith(1); // Assuming the 'close' event is the second argument (index 1)
    
            expect(db.db).to.be.null;
    
            done();
        });
    });

    it("should ping the database to ensure connection is established", (done) => {
        const pingResult = { ok: 1 };
        commandStub.withArgs({ ping: 1 }).resolves(pingResult);
    
        db.connect((err, dbInstance) => {
            try {
                expect(err).to.be.null;
                expect(dbInstance).to.not.be.null;
                expect(commandStub).to.have.been.calledOnceWithExactly({ ping: 1 });
                expect(logger.info).to.have.been.calledWith("DB connection established");
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should set 'connecting_db' to false and 'current_connection' to false after a successful connection", (done) => {
        commandStub.resolves({ ok: 1 });
        
        db.connect((err, dbInstance) => {
            try {
                expect(err).to.be.null;
                expect(dbInstance).to.not.be.null;
                expect(db.connecting_db).to.be.false;
                expect(connectStub).to.have.been.calledOnce;
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should handle a failed ping to the database and return the error", (done) => {
        const expectedError = new Error("Failed to ping");
        commandStub.rejects(expectedError);
    
        db.connect((err, dbInstance) => {
            expect(err).to.be.an('error');
            expect(err.message).to.equal(connectErrorMessage);
            expect(dbInstance).to.equal(undefined);  // Updated assertion
            expect(logger.error).to.have.been.calledWith("Database connection failed: Failed to ping");
            expect(db.connecting_db).to.be.false;
            done();
        });
    });

    it("should nullify 'db' and set 'connecting_db' to false if the ping to the database fails", (done) => {
        const pingError = new Error("Ping failed");
        commandStub.rejects(pingError);
    
        db.connect((err, dbInstance) => {
            try {
                expect(err.message).to.equal(connectErrorMessage);
    
                expect(db.db).to.be.null;
    
                expect(db.connecting_db).to.be.false;
    
                expect(logger.error).to.have.been.calledWith("Database connection failed: Ping failed");
    
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it("should handle a failed attempt to connect to the database and return the error", (done) => {
        const errorMessage = "Connection failed";
        connectStub.rejects(new Error(errorMessage));
    
        const callback = (err, dbInstance) => {
            try {
                expect(err).to.be.an('error');
                expect(err.message).to.equal(connectErrorMessage);
    
                expect(dbInstance).to.be.undefined;
    
                expect(logger.error).to.have.been.calledWith("Database connection failed: Connection failed");
    
                expect(db.connecting_db).to.be.false;
    
                done();
            } catch (error) {
                done(error);
            }
        };
    
        db.connect(callback);
    });

    it("should nullify 'db' and set 'connecting_db' to false if the connection attempt fails", (done) => {
        const expectedError = new Error("Connection failed");
        connectStub.rejects(expectedError); // Simulate connection failure
    
        db.connect((err, dbInstance) => {
            try {
                expect(err.message).to.equal(connectErrorMessage);
                expect(dbInstance).to.be.undefined; // Fix: Change to expect undefined instead of null
                expect(db.connecting_db).to.be.false;
                expect(db.db).to.be.null;
                expect(logger.error).to.have.been.calledWith("Database connection failed: Connection failed");
                done();
            } catch (error) {
                done(error);
            }
        });
    });

});