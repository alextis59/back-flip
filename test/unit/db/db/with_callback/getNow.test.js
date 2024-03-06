const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const moment = require("moment");
const db = require("../../../../../db/index.js");

describe("db.getNow", () => {


    afterEach(() => {
        sinon.restore();
    });

    it("should return a Date object representing the current UTC time", () => {
        const stub = sinon.stub(moment.prototype, "utc").returns({
            toDate: () => {
                return new Date();
            }
        });
        const result = db.getNow();
        expect(result).to.be.a("Date");
    });

});