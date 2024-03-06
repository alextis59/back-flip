const sinon = require("sinon");
const chai = require('chai');
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const { expect, AssertionError } = require('chai');
const db = require("../../../../../db/index.js");

describe("db._buildProjection", () => {

    // Declare the variables outside the beforeEach block
    let optionsWithOnly;
    let optionsWithWithout;
    let optionsWithBoth;
    let optionsWithEmptyArrays;
    let optionsWithInvalidAttributes;
    
    beforeEach(() => {
        // Set the values inside the beforeEach block
        optionsWithOnly = { only: ['name', 'email'] };
        optionsWithWithout = { without: ['password', 'createdAt'] };
        optionsWithBoth = { only: ['name', 'email'], without: ['password', 'createdAt'] };
        optionsWithEmptyArrays = { only: [], without: [] };
        optionsWithInvalidAttributes = { only: [null, ''], without: [null, ''] };
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should return an empty object when both 'only' and 'without' options are not provided", (done) => {
        const options = {}; // options object lacking 'only' and 'without'
        const result = db._buildProjection(options);
        expect(result).to.be.an('object').that.is.empty;
        done();
    });

    it("should return an object with keys set to 1 when 'only' option is provided with valid attributes", (done) => {
        const result = db._buildProjection(optionsWithOnly);
        expect(result).to.have.all.keys('name', 'email');
        expect(result).to.deep.equal({ name: 1, email: 1 });
        done();
    });

    it("should not include a key in the projection if it is present in 'only' option but is an empty string or null", (done) => {
        const validKey = 'name';
        optionsWithInvalidAttributes.only.push(validKey);
        const projection = db._buildProjection(optionsWithInvalidAttributes);
        expect(projection).to.not.have.any.keys('', null);
        expect(projection).to.have.property(validKey, 1);
        done();
    });

    it("should return an object with keys set to 0 when 'without' option is provided with valid attributes", (done) => {
        const projection = db._buildProjection(optionsWithWithout);
        expect(projection).to.have.all.keys(optionsWithWithout.without);
        for (const key of optionsWithWithout.without) {
            expect(projection[key]).to.equal(0);
        }
        done();
    });

    it("should not add a key to the projection if it is present in 'without' option but is an empty string or null", (done) => {
        const projection = db._buildProjection(optionsWithInvalidAttributes);
        expect(projection).to.not.have.any.keys(null, '');
        for (const without of optionsWithInvalidAttributes.without) {
            if (without) {
                expect(projection[without]).to.equal(0);
            }
        }
        done();
    });

    it("should handle both 'only' and 'without' options provided together, respecting their rules and applying 'only' first then excluding 'without' attributes", (done) => {
        const projection = db._buildProjection(optionsWithBoth);
    
        expect(projection).to.have.property('name', 1);
        expect(projection).to.have.property('email', 1);
    
        expect(projection).to.have.property('password', 0);
        expect(projection).to.have.property('createdAt', 0);
    
        expect(projection).to.not.have.property('someOtherAttribute');
    
        done();
    });

    it("should not include any keys in the projection when both 'only' and 'without' options are provided but are empty arrays", (done) => {
        const result = db._buildProjection(optionsWithEmptyArrays);
        expect(result).to.deep.equal({});
        done();
    });

    it("should properly handle the case when 'only' option has valid attributes and 'without' option has invalid attributes (empty strings or null values)", (done) => {
        optionsWithInvalidAttributes = { only: ['name', 'email'], without: [null, ''] };
        const projection = db._buildProjection(optionsWithInvalidAttributes);
    
        expect(projection).to.not.have.any.keys(null, '');
        expect(optionsWithInvalidAttributes).to.deep.equal({ only: ['name', 'email'], without: [null, ''] }); // Check immutability
        done();
    });

});