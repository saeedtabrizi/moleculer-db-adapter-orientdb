/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
'use strict';

import { Context, ServiceBroker, ServiceSchema } from 'moleculer';
import orientjs from 'orientjs';
import { OrientDBAdapter, OrientDbServiceSchema } from '../../src';

// tslint:disable-next-line: no-var-requires
import DbService from 'moleculer-db';

describe('Test MyService', () => {
    const serverOpts = {
        host: 'localhost',
        port: 2424,
        username: 'root',
        password: 'root',
    };
    const databaseOpts: orientjs.DatabaseOptions = {
        name: 'TestDB',
        type: 'graph',
        storage: 'memory',
    };
    const classOpts = {
        name: 'Person',
        parentName: 'V',
        isAbstract: false,
        ifnotexist: true,
        sequences: {
            id: { name: 'seq_Person_id' },
        },
        indexes: [
            {
                name: 'idx_unique_Person_id',
                class: 'Person',
                type: 'UNIQUE',
                ifnotexist: true,
                properties: ['id'],
            },
        ],
        properties: {
            id: {
                type: 'Integer',
                default: 'uuid()',
                // readonly: true,
                custom: { alias: '_id' },
                ifnotexist: true,
            },
            firstname: {
                type: 'String',
                ifnotexist: true,
                min: 1,
                max: 50,
                mandatory: true,
            },
            lastname: { type: 'String', ifnotexist: true, min: 1, max: 50 },
            title: { type: 'String', ifnotexist: true, min: 2, max: 15 },
            gender: {
                type: 'String',
                ifnotexist: true,
                min: 1,
                max: 1,
                mandatory: true,
                regexp: 'M|F',
            },
            age: { type: 'Short', ifnotexist: true, min: 0, max: 200, default: 0 },
            credit: { type: 'Long', ifnotexist: true, min: 0, default: 0 },
            rowid: {
                type: 'String',
                ifnotexist: true,
                default: 'uuid()',
                readonly: true,
                custom: { alias: '_rowid' },
            },
            createdAt: {
                ifnotexist: true,
                type: 'DateTime',
            },
        },
    };
    const broker = new ServiceBroker();
    const adapter = new OrientDBAdapter<typeof p1>(serverOpts);
    const serviceSchema: OrientDbServiceSchema<any> = {
        name: 'db-adapter-orientdb',
        mixins: [DbService],
        adapter,
        database: databaseOpts,
        dataClass: classOpts as any,
        actions: {
            test: async (ctx: Context<any>) => {
                ctx.broker.logger.info(`Test action was called with name: '${ctx.params.name}' parameter`);
                return `Hello ${ctx.params.name || 'Anonymous'}`;
            },
        },
    };
    const service = broker.createService(serviceSchema);
    const p1: any = { firstname: 'saeed', age: 18, gender: 'M' };
    const p2: any = { firstname: 'sara', age: 15, gender: 'F' };
    const p3: any = { firstname: 'majid', age: 25, gender: 'M' };
    beforeAll(async () => await broker.start());
    afterAll(async () => {
        service.schema.database = databaseOpts;
        service.schema.dataClass = classOpts;
        adapter.init(broker, service);
        await adapter.clear();
        await broker.stop();
        return;
    });

    beforeEach(async () => {
        service.schema.database = databaseOpts;
        service.schema.dataClass = classOpts;
        adapter.init(broker, service);
        await adapter.clear();
        return;
    });

    describe('DbService Adapter Methods', () => {
        it('should be created', () => {
            expect(adapter).toBeDefined();
            expect(adapter.opts[0]).toBe(serverOpts);

            expect(adapter.init).toBeInstanceOf(Function);
            expect(adapter.connect).toBeInstanceOf(Function);
            expect(adapter.disconnect).toBeInstanceOf(Function);
            expect(adapter.find).toBeInstanceOf(Function);
            expect(adapter.findOne).toBeInstanceOf(Function);
            expect(adapter.findById).toBeInstanceOf(Function);
            expect(adapter.findByIds).toBeInstanceOf(Function);
            expect(adapter.count).toBeInstanceOf(Function);
            expect(adapter.insert).toBeInstanceOf(Function);
            expect(adapter.insertMany).toBeInstanceOf(Function);
            expect(adapter.updateMany).toBeInstanceOf(Function);
            expect(adapter.updateById).toBeInstanceOf(Function);
            expect(adapter.removeMany).toBeInstanceOf(Function);
            expect(adapter.removeById).toBeInstanceOf(Function);
            expect(adapter.clear).toBeInstanceOf(Function);
            expect(adapter.beforeSaveTransformID).toBeInstanceOf(Function);
            expect(adapter.afterRetrieveTransformID).toBeInstanceOf(Function);
        });

        it("throw error in init if 'database' is not defined", () => {
            expect(() => {
                service.schema.database = undefined;
                adapter.init(broker, service);
                service.schema.database = databaseOpts;
            }).toThrow('Missing `database` definition in schema of service!');
        });

        it("throw error in init if 'dataClass' is not defined", () => {
            expect(() => {
                service.schema.database = databaseOpts;
                service.schema.dataClass = undefined;
                adapter.init(broker, service);
                service.schema.dataClass = classOpts;
            }).toThrow('Missing `dataClass` definition in schema of service!');
        });
        it('should call init', () => {
            service.schema.database = databaseOpts;
            service.schema.dataClass = classOpts;
            adapter.init(broker, service);
            expect(adapter.broker).toBe(broker);
            expect(adapter.service).toBe(service);
        });

        it("should call 'count' in adapter and return 1 ", async () => {
            await adapter.insert(p1);
            const c = await adapter.count();
            expect(c).toEqual(1);
        });
        it("should call 'count' and return 1", async () => {
            await adapter.insert(p1);
            const c = await adapter.count();
            expect(c).toEqual(1);
        });

        it("should call 'count' and return 2", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await adapter.count({ search: 'M', searchFields: 'gender' });
            expect(c).toEqual(2);
        });

        it("should call 'find' and return single object", async () => {
            await adapter.insert(p1);
            const c = await adapter.find();
            expect(c).toHaveLength(1);
        });

        it("should call 'find' and return 3 object", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await adapter.find();
            expect(c).toHaveLength(3);
        });

        it("should call 'find' and return 2 object", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await adapter.find({
                search: 'saeed',
                searchFields: 'firstname',
            });
            expect(c).toHaveLength(1);
        });

        it("should call 'find' by query object and return two objects", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await adapter.find({
                query: {
                    $or: [{ $and: [{ firstname: 'saeed' }, { age: { $gt: 18 } }] }, { age: { $lte: 18 } }],
                },
            });
            expect(c).toHaveLength(2);
        });

        it("should call 'find' by query object IN clause and return two objects", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await adapter.find({
                query: {
                    age: { $in: [18, 25] },
                },
            });
            expect(c).toHaveLength(2);
        });

        it("should call 'create' and return single object", async () => {
            const c = await adapter.insert(p1);
            expect(c).toBeDefined();
            expect(c.firstname).toBe(p1.firstname);
        });

        it("should call 'update' and return single object", async () => {
            const c1 = await adapter.insert(p1);
            const c2 = await adapter.updateById<any>(c1.id, {
                $set: { ...p1, firstname: 'samad' },
            });
            expect(c1).toBeDefined();
            expect(c2).toBeDefined();
            expect(c1.firstname).not.toEqual(c2.firstname);
            expect(c2.firstname).toEqual('samad');
        });
        it("should call 'remove' and return single object", async () => {
            const c1 = await adapter.insert(p1);
            const c2 = await adapter.insert(p2);
            const r1 = await adapter.removeById(c1.id);
            const r2 = await adapter.count();
            expect(c1).toBeDefined();
            expect(r1).toBeDefined();
            expect(r2).toEqual(1);
        });
    });
    describe('DbService Actions', () => {
        it("should return with 'Hello Anonymous'", () => {
            return broker.call('db-adapter-orientdb.test').then(res => {
                expect(res).toBe('Hello Anonymous');
            });
        });

        it("should return with 'Hello John'", () => {
            return broker.call('db-adapter-orientdb.test', { name: 'John' }).then(res => {
                expect(res).toBe('Hello John');
            });
        });
        it("should call 'count' and return 1", async () => {
            await adapter.insert(p1);
            const c = await broker.call('db-adapter-orientdb.count');
            expect(c).toEqual(1);
        });

        it("should call 'count' and return 2", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await broker.call('db-adapter-orientdb.count', {
                search: 'M',
                searchFields: 'gender',
            });
            expect(c).toEqual(2);
        });

        it("should call 'find' and return single object", async () => {
            await adapter.insert(p1);
            const c = await broker.call('db-adapter-orientdb.find');
            expect(c).toHaveLength(1);
        });

        it("should call 'find' and return 3 object", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await broker.call('db-adapter-orientdb.find');
            expect(c).toHaveLength(3);
        });

        it("should call 'find' and return 2 object", async () => {
            await adapter.insert(p1);
            await adapter.insert(p2);
            await adapter.insert(p3);
            const c = await broker.call('db-adapter-orientdb.find', {
                search: 'saeed',
                searchFields: 'firstname',
            });
            expect(c).toHaveLength(1);
        });

        it("should call 'create' and return single object", async () => {
            const c = await broker.call<any, any>('db-adapter-orientdb.create', p1);
            expect(c).toBeDefined();
            expect(c.firstname).toBe(p1.firstname);
        });

        it("should call 'get' and return single object", async () => {
            const c1 = await broker.call<any, any>('db-adapter-orientdb.create', p1);
            expect(c1).toBeDefined();
            expect(c1.firstname).toBe(p1.firstname);
            const c2 = await broker.call<any, any>('db-adapter-orientdb.create', p2);
            expect(c2).toBeDefined();
            expect(c2.firstname).toBe(p2.firstname);
            const c3 = await broker.call<any, any>('db-adapter-orientdb.get', { id: c1.id });
            expect(c3).toBeDefined();
            expect(c3.id).toBe(c1.id);
            expect(c3.firstname).toBe(c1.firstname);
            const c4 = await broker.call<any, any>('db-adapter-orientdb.get', { id: c2.id });
            expect(c4).toBeDefined();
            expect(c4.id).toBe(c2.id);
            expect(c4.firstname).toBe(c4.firstname);
        });

        it("should call 'update' and return single object", async () => {
            const c1 = await broker.call<any, any>('db-adapter-orientdb.create', p1);
            const c2 = await broker.call<any, any>('db-adapter-orientdb.update', {
                ...p1,
                id: c1.id,
                firstname: 'samad',
            });
            expect(c1).toBeDefined();
            expect(c2).toBeDefined();
            expect(c1.firstname).not.toEqual(c2.firstname);
            expect(c2.firstname).toEqual('samad');
        });
        it("should call 'remove' and return single object", async () => {
            const c1 = await broker.call<any, any>('db-adapter-orientdb.create', p1);
            const c2 = await broker.call<any, any>('db-adapter-orientdb.create', p2);
            const r1 = await broker.call<any, any>('db-adapter-orientdb.remove', { id: c1.id });
            const r2 = await broker.call('db-adapter-orientdb.count');
            expect(c1).toBeDefined();
            expect(r1).toBeDefined();
            expect(r1.id).toEqual(c1.id);
            expect(r2).toEqual(1);
        });
    });
});
