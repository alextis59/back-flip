const utils = require('side-flip/utils'),
    assert = require('assert'),
    control = require('../../../test_utils/control'),
    db = require('../../../db'),
    mqz = require('../../../mqz'),
    PubTestClient = require('../../../test_utils/pub_test_client');

const server_url = process.env.NATS_URL || 'nats://nats:4222';

let client_1, client_2, client_3, client_4, client_list;

describe('mqz.nats_client', () => {

    before(async () => {
        client_1 = new PubTestClient({ name: 'client_1', service_name: 'service_1', url: server_url, queues: [] });
        client_2 = new PubTestClient({ name: 'client_2', service_name: 'service_2', url: server_url, queues: ['Q1', 'Q2'] });
        client_3 = new PubTestClient({ name: 'client_3', service_name: 'service_2', url: server_url, queues: ['Q1', 'Q2'] });
        client_4 = new PubTestClient({ name: 'client_4', service_name: 'service_3', url: server_url, queues: ['Q2', 'Q3'] });
        client_list = [client_1, client_2, client_3, client_4];
        for (let client of client_list) {
            console.log('Initializing client: ' + client.service_name);
            await client.initialize();
            console.log('Client initialized: ' + client.service_name);
        }
        console.log('All clients initialized');
    });

    after(async () => {
        for (let client of client_list) {
            await client.close();
        }
        await db.disconnect();
    });

    it('if a client publish a message on a queue, only one of the scaled service client subscribed to this queue should receive it', async () => {
        let message = { data: 'test-1' };
        await client_1.publish('Q1', message);
        await utils.wait(200);
        await control.checkPubMessageReceived('Q1', { match_count: 0, properties: { data: 'test-1' } }, {client: client_1});
        let count_1 = control.getMatchingPubMessages('Q1', { properties: { data: 'test-1' } }, client_2).length,
            count_2 = control.getMatchingPubMessages('Q1', { properties: { data: 'test-1' } }, client_3).length;
        assert((count_1 === 1 && count_2 === 0) || (count_1 === 0 && count_2 === 1));
    });

    it('if a client publish a message on a queue, only one of the scaled service client subscribed to this queue should receive it as well as the other client subscribed to it', async () => {
        let message = { data: 'test-2' };
        await client_1.publish('Q2', message);
        await utils.wait(200);
        await control.checkPubMessageReceived('Q2', { match_count: 0, properties: { data: 'test-2' } }, {client: client_1});
        let count_1 = control.getMatchingPubMessages('Q2', { properties: { data: 'test-2' } }, client_2).length,
            count_2 = control.getMatchingPubMessages('Q2', { properties: { data: 'test-2' } }, client_3).length;
        assert((count_1 === 1 && count_2 === 0) || (count_1 === 0 && count_2 === 1));
        await control.checkPubMessageReceived('Q2', { match_count: 1, properties: { data: 'test-2' } }, {client: client_4});
    });

    it('if the scaled service receiving the message throw an error, the other service should also receive the message', async () => {
        let message = { data: 'test-3' };
        client_2.setConsumeAction('throw');
        client_3.setConsumeAction('throw');
        await client_1.publish('Q1', message);
        await utils.wait(200);
        await control.checkPubMessageReceived('Q1', { match_count: 1, properties: { data: 'test-3' } }, {client: client_2});
        await control.checkPubMessageReceived('Q1', { match_count: 1, properties: { data: 'test-3' } }, {client: client_3});
    });

    it('if the scaled service receiving the message take too much time to process it, the other service should also receive the message', async () => {
        let message = { data: 'test-4' };
        client_2.setConsumeAction('wait', 2510);
        client_3.setConsumeAction('wait', 2510);
        await client_1.publish('Q1', message);
        await utils.wait(5500);
        await control.checkPubMessageReceived('Q1', { match_count: 1, properties: { data: 'test-4' } }, {client: client_2});
        await control.checkPubMessageReceived('Q1', { match_count: 1, properties: { data: 'test-4' } }, {client: client_3});
        client_2.setConsumeAction('none');
        client_3.setConsumeAction('none');
    });

    it('using global mqz.publish should use the first connected client', async () => {
        try{
            let message = { data: 'test-5' };
            await mqz.publish('Q1', message);
            await utils.wait(200);
            await control.checkPubMessageReceived('Q1', { match_count: 0, properties: { data: 'test-5' } }, {client: client_1});
            let count_1 = control.getMatchingPubMessages('Q1', { properties: { data: 'test-5' } }, client_2).length,
                count_2 = control.getMatchingPubMessages('Q1', { properties: { data: 'test-5' } }, client_3).length;
            assert((count_1 === 1 && count_2 === 0) || (count_1 === 0 && count_2 === 1));
        }catch(err){
            console.log(err);
            throw err;
        }
        
    });

    it('if a client publish a message on the internal service queue, only the client with same service name should receive it', async () => {
        let message = { data: 'test-internal' };
        await client_2.publishInternalMessage(message);
        await utils.wait(200);
        await control.checkPubMessageReceived('internal', { match_count: 0, properties: { data: 'test-internal' } }, {client: client_1});
        await control.checkPubMessageReceived('internal', { match_count: 0, properties: { data: 'test-internal' } }, {client: client_2});
        await control.checkPubMessageReceived('internal', { match_count: 1, properties: { data: 'test-internal' } }, {client: client_3});
        await control.checkPubMessageReceived('internal', { match_count: 0, properties: { data: 'test-internal' } }, {client: client_4});
    });

    it('a client should be able to subscribe to a queue not yet created', async () => {
        await client_2.subscribe('Q4');
        await client_1.publish('Q4', { data: 'test-6' });
        await utils.wait(200);
        await control.checkPubMessageReceived('Q4', { match_count: 1, properties: { data: 'test-6' } }, {client: client_2});
    });

    it('using global mqz.subscribe should wait for a client to be connected', async () => {
        // purge global mqz.client
        mqz.client = null;
        let received = false;
        mqz.subscribe('Q1', (key, data) => {
            if(key === 'Q1' && data.data === 'test-7'){
                received = true;
            }
        });
        // Init new client
        let client_5 = new PubTestClient({ name: 'client_5', service_name: 'service_4', url: server_url, queues: [] });
        await client_5.initialize();
        await client_1.publish('Q1', { data: 'test-7' });
        await utils.wait(200);
        assert(received);
    });

})