/* eslint-disable @typescript-eslint/explicit-function-return-type */
'use strict';
import 'bluebird';
import { ServiceBroker, ServiceSchema } from 'moleculer';
import { OrientDBAdapter } from '../../src/index';
// tslint:disable-next-line: no-var-requires
import DbService from 'moleculer-db';

// Create Broker Schema
const serviceSchema: ServiceSchema = {
    name: 'db-adapter-orientdb',
    mixins: [DbService],
    adapter: new OrientDBAdapter({ host: 'localhost', port: 2424 }),
    dataClass: 'Test',
    actions: {
        test: ctx => {
            ctx.broker.logger.info('Test action was called');
        },
    },
};

// Create broker
const broker = new ServiceBroker();

// Load my service
const service = broker.createService(serviceSchema);

// Start server
broker.start().then(() => {
    // Call action
    broker
        .call('test', { name: 'John Doe' })
        .then(broker.logger.info)
        .catch(broker.logger.error);
});
