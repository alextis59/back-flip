const { expect } = require('chai');
const sinon = require('sinon');
const { AccessDeniedError } = require('../../../model/errors');
const genericMiddleware = require('../../../middlewares/generic');

describe('checkRequestAccessRight', () => {
  let req, res, entity_handler, model;

  beforeEach(() => {
    req = {};
    res = {
      locals: {
        entity_handler: {
          getRequestPermissions: sinon.stub()
        },
        requestor: {}
      }
    };

    entity_handler = res.locals.entity_handler;
    model = {
      hasRequiredPermissions: sinon.stub()
    };

    genericMiddleware.__set__('model', model);
  });

  it('should pass when requestor has required permissions', async () => {
    entity_handler.getRequestPermissions.returns(['read']);
    model.hasRequiredPermissions.returns(true);

    await genericMiddleware.checkRequestAccessRight(req, res);

    expect(entity_handler.getRequestPermissions.calledOnce).to.be.true;
    expect(model.hasRequiredPermissions.calledOnce).to.be.true;
  });

  it('should throw AccessDeniedError when requestor does not have required permissions', async () => {
    entity_handler.getRequestPermissions.returns(['read']);
    model.hasRequiredPermissions.returns(false);

    try {
      await genericMiddleware.checkRequestAccessRight(req, res);
      throw new Error('Expected AccessDeniedError to be thrown');
    } catch (err) {
      expect(err).to.be.instanceOf(AccessDeniedError);
      expect(err.message).to.equal('request-permissions');
    }

    expect(entity_handler.getRequestPermissions.calledOnce).to.be.true;
    expect(model.hasRequiredPermissions.calledOnce).to.be.true;
  });
});
