"use strict";

import { ServiceBroker, ServiceSchema } from "moleculer";
import OrientDBAdapter from "../../src";

import DbService from "moleculer-db";

describe("Test MyService", () => {
  const serverOpts = {
    host: "localhost",
    port: 2424,
    username: "root",
    password: "root",
  };
  const databaseOpts = { name: "TestDB", type: "graph", storage: "memory" };
  const classOpts = {
    name: "Person",
    parentName: "V",
    isAbstract: false,
    ifnotexist: true,
  };
  const broker = new ServiceBroker();
  const adapter = new OrientDBAdapter(serverOpts);
  const serviceSchema: ServiceSchema = {
    name: "db-adapter-orientdb",
    mixins: [DbService],
    adapter,
    database: databaseOpts,
    dataClass: classOpts,
    actions: {
      test: async (ctx) => {
        ctx.broker.logger.info(`Test action was called with name: '${ctx.params.name}' parameter`);
        return `Hello ${ctx.params.name || "Anonymous"}`;
      },
    },
  };
  const service = broker.createService(serviceSchema);

  beforeAll(() => broker.start());
  afterAll(() => broker.stop());

  it("should be created", () => {
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
    }).toThrow("Missing `database` definition in schema of service!");
  });

  it("throw error in init if 'dataClass' is not defined", () => {
    expect(() => {
      service.schema.database = databaseOpts;
      service.schema.dataClass = undefined;
      adapter.init(broker, service);
      service.schema.dataClass = classOpts;
    }).toThrow("Missing `dataClass` definition in schema of service!");
  });

  it("call init", () => {
    service.schema.database = databaseOpts;
    service.schema.dataClass = classOpts;
    adapter.init(broker, service);
    expect(adapter.broker).toBe(broker);
    expect(adapter.service).toBe(service);
  });

  it("should return with 'Hello Anonymous'", () => {
    return broker.call("db-adapter-orientdb.test").then((res) => {
      expect(res).toBe("Hello Anonymous");
    });
  });

  it("should return with 'Hello John'", () => {
    return broker
      .call("db-adapter-orientdb.test", { name: "John" })
      .then((res) => {
        expect(res).toBe("Hello John");
      });
  });
});
