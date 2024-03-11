const utils = require('side-flip/utils'),
    assert = require('assert'),
    control = require('../../test_utils/control'),
    db = require('../../../db'),
    mqz = require('../../../mqz'),
    pub_test_client = require('../../test_utils/pub_test_client');

const server_url = process.env.NATS_URL || 'nats://nats:4222';

let client_1, client_2, client_3, client_4, client_list;

describe('mqz.nats_client', () => {

    before((done) => {
        client_1 = pub_test_client({client: 'nats', service_name: 'service_1', url: server_url, queues: [] });
        client_2 = pub_test_client({client: 'nats', service_name: 'service_2', url: server_url, queues: ['Q1', 'Q2'] });
        client_3 = pub_test_client({client: 'nats', service_name: 'service_2', url: server_url, queues: ['Q1', 'Q2'] });
        client_4 = pub_test_client({client: 'nats', service_name: 'service_3', url: server_url, queues: ['Q2', 'Q3'] });
        client_list = [client_1, client_2, client_3, client_4];
        utils.asyncEach(client_list, (client, cb) => {
            console.log('Initializing client: ' + client.service_name);
            client.initialize(() => {
                console.log('Client initialized: ' + client.service_name);
                cb();
            });
        }, () => {
            console.log('Clients initialized');
            done();
        }, {keep_order: true});
    });

    after((done) => {
        for (let client of client_list) {
            client.close();
        }
        db.disconnect(() => {
            done();
        });
    });

    it('if a client publish a message on a queue, only one of the scaled service client subscribed to this queue should receive it', (done) => {
        let message = { data: 'test-1' };
        console.log('TEST0');
        client_1.publish('Q1', message, async (err) => {
            try {
                assert(!err);
                await utils.wait(200);
                assert(await control.checkPubMessageReceived(client_1, 'Q1', { match_count: 0, properties: { data: 'test-1' } }));
                let count_1 = control.getMatchingPubMessages(client_2, 'Q1', { properties: { data: 'test-1' } }).length,
                    count_2 = control.getMatchingPubMessages(client_3, 'Q1', { properties: { data: 'test-1' } }).length;
                assert((count_1 === 1 && count_2 === 0) || (count_1 === 0 && count_2 === 1));
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it('if a client publish a message on a queue, only one of the scaled service client subscribed to this queue should receive it as well as the other client subscribed to it', (done) => {
        let message = { data: 'test-2' };
        client_1.publish('Q2', message, async (err) => {
            try {
                assert(!err);
                await utils.wait(200);
                assert(await control.checkPubMessageReceived(client_1, 'Q2', { match_count: 0, properties: { data: 'test-2' } }));
                let count_1 = control.getMatchingPubMessages(client_2, 'Q2', { properties: { data: 'test-2' } }).length,
                    count_2 = control.getMatchingPubMessages(client_3, 'Q2', { properties: { data: 'test-2' } }).length;
                assert((count_1 === 1 && count_2 === 0) || (count_1 === 0 && count_2 === 1));
                assert(await control.checkPubMessageReceived(client_4, 'Q2', { match_count: 1, properties: { data: 'test-2' } }));
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it('if the scaled service receiving the message throw an error, the other service should also receive the message', (done) => {
        let message = { data: 'test-3' };
        client_2.setConsumeAction('throw');
        client_3.setConsumeAction('throw');
        client_1.publish('Q1', message, async (err) => {
            try {
                assert(!err);
                await utils.wait(200);
                assert(await control.checkPubMessageReceived(client_2, 'Q1', { match_count: 1, properties: { data: 'test-3' } }));
                assert(await control.checkPubMessageReceived(client_3, 'Q1', { match_count: 1, properties: { data: 'test-3' } }));
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it('if the scaled service receiving the message take too much time to process it, the other service should also receive the message', (done) => {
        let message = { data: 'test-4' };
        client_2.setConsumeAction('wait', 2510);
        client_3.setConsumeAction('wait', 2510);
        client_1.publish('Q1', message, async (err) => {
            try {
                assert(!err);
                await utils.wait(5500);
                assert(await control.checkPubMessageReceived(client_2, 'Q1', { match_count: 1, properties: { data: 'test-4' } }));
                assert(await control.checkPubMessageReceived(client_3, 'Q1', { match_count: 1, properties: { data: 'test-4' } }));
                client_2.setConsumeAction('none');
                client_3.setConsumeAction('none');
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    xit('using global mqz.publish should use the first connected client', (done) => {
        let message = { data: 'test-5' };
        mqz.publish('Q1', message, async (err) => {
            console.log(err);
            try {
                assert(!err);
                await utils.wait(200);
                assert(await control.checkPubMessageReceived(client_1, 'Q1', { match_count: 0, properties: { data: 'test-5' } }));
                let count_1 = control.getMatchingPubMessages(client_2, 'Q1', { properties: { data: 'test-5' } }).length,
                    count_2 = control.getMatchingPubMessages(client_3, 'Q1', { properties: { data: 'test-5' } }).length;
                console.log('Count 1 = ' + count_1);
                console.log('Count 2 = ' + count_2);
                assert((count_1 === 1 && count_2 === 0) || (count_1 === 0 && count_2 === 1));
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    it('if a client publish a message on the internal service queue, only the client with same service name should receive it', (done) => {
        let message = { data: 'test-internal' };
        client_2.publishInternalMessage(message, async (err) => {
            try {
                assert(!err);
                await utils.wait(200);
                assert(await control.checkPubMessageReceived(client_1, 'internal', { match_count: 0, properties: { data: 'test-internal' } }));
                assert(await control.checkPubMessageReceived(client_2, 'internal', { match_count: 0, properties: { data: 'test-internal' } }));
                assert(await control.checkPubMessageReceived(client_3, 'internal', { match_count: 1, properties: { data: 'test-internal' } }));
                assert(await control.checkPubMessageReceived(client_4, 'internal', { match_count: 0, properties: { data: 'test-internal' } }));
                done();
            } catch (error) {
                done(error);
            }
        });
    })

})