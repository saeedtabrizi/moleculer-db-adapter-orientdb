"use strict";

import { ServiceBroker, ServiceSchema } from "moleculer";
import OrientDBAdapter from "../../src";

import DbService from "moleculer-db";

describe("Test MyService", () => {
  const broker = new ServiceBroker();
  const serviceSchema: ServiceSchema = {
    name: "db-adapter-orientdb",
    mixins: [DbService],
    adapter: new OrientDBAdapter({ host: "localhost", port: 2424 }),
    database: { name: "TestDB", type: "graph", storage: "memory" },
    dataClass: "Test",
    actions: {
      test: async (ctx) => {
        ctx.broker.logger.info("Test action was called");
        return `Hello ${ctx.params.name || "Anonymous"}`;
      },
    },
  };
  const service = broker.createService(serviceSchema);

  beforeAll(() => broker.start());
  afterAll(() => broker.stop());

  it("should be created", () => {
    expect(service).toBeDefined();
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
