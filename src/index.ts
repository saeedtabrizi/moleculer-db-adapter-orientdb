/*
 * moleculer-db-adapter-orientdb
 * Copyright (c) 2019 Saeed Tabrizi (https://github.com/SaeedTabrizi/moleculer-db-adapter-orientdb)
 * MIT Licensed
 */

"use strict";

import { EventEmitter } from "events";
import { Service, ServiceBroker } from "moleculer";
import Moleculer = require("moleculer");
import {
  CursorOptions,
  DbAdapter,
  DbService,
  FilterOptions,
  QueryOptions,
} from "moleculer-db";
import * as orientjs from "orientjs";
import { isNumber } from "util";

export interface OrientDbServiceSchema<E>
  extends Moleculer.ServiceSchema {
  adapter: OrientDBAdapter<E>;
  database: orientjs.DatabaseOptions;
  dataClass: {
    name: string;
    parentName?: string;
    isAbstract?: boolean;
    ifnotexist?: boolean;
    sequences?: {
      id: {
        name: string;
      };
    };
    indexes?: orientjs.IndexConfig[];
    properties?: { [name: string]: orientjs.PropertyCreateConfig };
  };
}
// export interface QueryOptions {
//     filter?: string | object;
//     sort?: { [key: string]: "asc" | "desc" };
//     paging?: { page?: number; limit?: number };
//     fields?: string[];
// }
export class OrientDBAdapter<E> implements DbAdapter {
  public opts: any[];
  public broker: ServiceBroker;
  public service: DbService<E>;
  public database: orientjs.ODatabaseSession;
  public dataClass: orientjs.OClass;

  private sequences: { [name: string]: orientjs.OSequence } = {};
  public client: orientjs.OrientDBClient;

  public idField: string = "id";
  /**
   * Creates an instance of OrientDBAdapter.
   * @param {any} opts
   *
   * @memberof OrientDBAdapter
   */
  constructor(...opts: any[]) {
    this.opts = opts;
  }

  /**
   * Initialize adapter
   *
   * @param {ServiceBroker} broker
   * @param {Service} service
   *
   * @memberof OrientDBAdapter
   */
  public init(broker: ServiceBroker, service: Service) {
    this.broker = broker;
    this.service = service as any;
    this.service.schema.settings.idField = "id";

    if (!this.service.schema.database) {
      /* istanbul ignore next */
      throw new Error("Missing `database` definition in schema of service!");
    }

    if (!this.service.schema.dataClass) {
      /* istanbul ignore next */
      throw new Error("Missing `dataClass` definition in schema of service!");
    }
    return this;
  }

  /**
   * Connect to database
   *
   * @returns {Promise}
   *
   * @memberof OrientDBAdapter
   */
  public async connect(): Promise<void> {
    const { database, dataClass } = this.service.schema;
    const dataClient = this.opts[0] || { host: "localhost", port: 2424 };
    const serverCred = {
      username: dataClient.username,
      password: dataClient.password,
    };
    const dbOptions = { ...serverCred, ...database };
    try {
      this.broker.logger.info(
        `Connecting to orientdb on host: '${dataClient.host}' , port : '${dataClient.port}' , username: ${dataClient.username}' , password: ${dataClient.password}' `,
      );
      this.client = await orientjs.OrientDBClient.connect(dataClient);
      const exists = await this.client.existsDatabase(dbOptions);
      if (!exists) {
        await this.client.createDatabase(dbOptions);
      }
      const sessions = await this.client.sessions(database);
      this.database = await sessions.acquire();
      // dbPool.once("close", () => {
      //   this.service.logger.warn("Disconnected from db");
      // });
      let cls;
      try {
        cls = await this.database.class.create(
          dataClass.name,
          dataClass.parentName,
          dataClass.cluster,
          dataClass.isAbstract,
          dataClass.ifnotexist,
        );
        this.service.logger.info(`The Class '${cls.name}' has been created`);
      } catch (error) {
        this.service.logger.error(
          `The Class '${dataClass.name}' not be created`,
        );
      }
      if (dataClass.properties && cls) {
        // tslint:disable-next-line:forin
        for (const key in dataClass.properties) {
          try {
            await cls.property.create({
              name: key,
              ...dataClass.properties[key],
            });
            this.service.logger.info(
              `The Property '${cls.name}.${key}' has been created`,
            );
          } catch (error) {
            this.service.logger.error(
              `The Property '${cls.name}.${key}' not be created`,
            );
          }
        }
      }
      if (dataClass.indexes) {
        for (const item of dataClass.indexes) {
          try {
            await this.database.index.create(item);
          } catch (error) {
            this.service.logger.error(
              `The Index '${item.name}' not be created`,
            );
          }
        }
      }
      if (dataClass.sequences) {
        const ss = Object.entries(dataClass.sequences);
        for (const item of ss) {
          const k = item[0];
          const c: any = item[1];
          let s; //
          try {
            s = await this.database.sequence.get(c.name);
          } catch (error) {
            this.service.logger.info(`The Sequence '${c.name}' not found`);
          }
          if (!s) {
            s = await this.database.sequence.create(c.name, "ORDERED", 1);
            this.service.logger.info(
              `The Sequence '${c.name}' has been created`,
            );
          }
          if (s) {
            this.sequences[k] = s;
            this.service.logger.info(
              `The Sequence '${c.name}' has been attached`,
            );
          }
        }
      }
      this.service.logger.warn(`Connected to "${this.database.name}" db`);
      return;
    } catch (error) {
      this.service.logger.error("Error while connecting to db", error);
      return;
    }
  }

  /**
   * Disconnect from database
   *
   * @returns {Promise}
   *
   * @memberof OrientDBAdapter
   */
  public disconnect(): Promise<void> {
    if (this.client) {
      return this.client.close();
    }
    return Promise.resolve();
  }

  /**
   * Find all entities by filters.
   *
   * Available filter props:
   *  - limit
   *  - offset
   *  - sort
   *  - search
   *  - searchFields
   *  - query
   *
   * @param {Object} filters
   * @returns {Promise<Array>}
   *
   * @memberof OrientDBAdapter
   */
  public async find<R, C = CursorOptions<R>>(filters?: C) {
    return this.createCursor<R, C>(filters, false).all<R>();
  }

  /**
   * Find an entity by query
   *
   * @param {Object} query
   * @returns {Promise}
   * @memberof OrientDBAdapter
   */
  public async findOne<R, Q = any>(query: Q) {
    return this.createCursor<R>({ query }, false).one<R>();
  }

  /**
   * Find an entities by ID.
   *
   * @param {String} id
   * @returns {Promise<Object>} Return with the found document.
   *
   * @memberof OrientDBAdapter
   */
  public async findById<R>(id: string): Promise<R> {
    const svc = this.service;
    const db: orientjs.ODatabaseSession = svc && svc.adapter.database;
    try {
      return this.createCursor<R>(
        { [svc.schema.settings.idField]: id },
        false,
      ).one<R>();
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' findByIds`,
        error,
      );
    }
  }

  /**
   * Find any entities by IDs.
   *
   * @param {Array} idList
   * @returns {Promise<Array>} Return with the found documents in an Array.
   *
   * @memberof OrientDBAdapter
   */
  public async findByIds<R>(idList: Array<number | string>) {
    const svc = this.service;
    const db: orientjs.ODatabaseSession = svc && svc.adapter.database;
    try {
      // const s = await this.client.sessions();
      // const db = await s.acquire();
      const r = await db.query<R>(
        `SELECT * FROM ${this.dataClass.name} WHERE ${svc.schema.idField} IN :ids`,
        { params: { ids: idList } },
      );
      return r.all();
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' findByIds`,
        error,
      );
    }
  }

  /**
   * Get count of filtered entites.
   *
   * Available query props:
   *  - search
   *  - searchFields
   *  - query
   *
   * @param {Object} [filters={}]
   * @returns {Promise<Number>} Return with the count of documents.
   *
   * @memberof OrientDBAdapter
   */
  public async count(filters?: any): Promise<number> {
    const q = this.createCursor(filters, true);
    const c = await q.one<{ count: number }>();
    return c.count ? c.count : 0;
  }

  /**
   * Insert an entity.
   *
   * @param {Object} entity
   * @returns {Promise<Object>} Return with the inserted document.
   *
   * @memberof OrientDBAdapter
   */
  public async insert<T, R = T>(entity: T): Promise<R> {
    const svc = this.service;
    const db: orientjs.ODatabase = svc && svc.adapter.database;
    const seqs = svc.schema.dataClass.sequences;
    try {
      if (seqs) {
        for (const key in seqs) {
          if (seqs.hasOwnProperty(key)) {
            const name = seqs[key].name;
            entity[key] = db.rawExpression(`sequence('${name}').next()`);
          }
        }
      }
      const r = await db
        .insert()
        .into(svc.schema.dataClass.name)
        .set(entity)
        .one<R>();
      return r;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' insert record`,
        error,
      );
    }
  }

  /**
   * Insert many entities
   *
   * @param {Array} entities
   * @returns {Promise<Array<Object>>} Return with the inserted documents in an Array.
   *
   * @memberof OrientDBAdapter
   */
  public async insertMany<T, R = T>(...entities: T[]): Promise<R[]> {
    const svc = this.service;
    const db: orientjs.ODatabase = svc && svc.adapter.database;
    try {
      // const s = await this.client.sessions();
      // const db = await s.acquire();
      const A: R[] = [];
      for (const entity of entities) {
        for (const key in this.sequences) {
          if (this.sequences.hasOwnProperty(key)) {
            const name = this.sequences[key].name;
            entity[key] = db.rawExpression(`sequence('${name}').next()`);
          }
        }
        const r = await db
          .insert()
          .into(svc.schema.dataClass.name)
          .set(entity)
          .one<R>();
        A.push(r);
      }

      return A;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' insert records`,
        error,
      );
    }
  }

  /**
   * Update many entities by `query` and `update`
   *
   * @param {Object} query
   * @param {Object} update
   * @returns {Promise<Number>} Return with the count of modified documents.
   *
   * @memberof OrientDBAdapter
   */
  public async updateMany<T, Q extends QueryOptions<T> = any>(
    query: Q,
    update: T,
  ): Promise<number> {
    const svc = this.service;
    const db: orientjs.ODatabase = svc && svc.adapter.database;
    try {
      // const s = await this.client.sessions();
      // const db = await s.acquire();
      const r = await db
        .update(svc.schema.dataClass.name)
        .set(update)
        .where(query)
        .one<number>();
      return r;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' update records`,
        error,
      );
    }
  }

  /**
   * Update an entity by ID and `update`
   *
   * @param {String} id - ObjectID as hexadecimal string.
   * @param {Object} update
   * @returns {Promise<Object>} Return with the updated document.
   *
   * @memberof OrientDBAdapter
   */
  public async updateById<T, R = T>(
    id: string | number,
    update: T,
  ): Promise<R> {
    const svc = this.service;
    const db: orientjs.ODatabase = svc && svc.adapter.database;
    try {
      // const s = await this.client.sessions();
      // const db = await s.acquire();
      const m = (update as any).$set;
      const r = await db
        .update(svc.schema.dataClass.name)
        .set(m)
        .where({ [svc.schema.settings.idField]: id })
        .return("AFTER")
        .one<R>();
      return r;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' update record`,
        error,
      );
    }
  }

  /**
   * Remove entities which are matched by `query`
   *
   * @param {Object} query
   * @returns {Promise<Number>} Return with the count of deleted documents.
   *
   * @memberof OrientDBAdapter
   */
  public async removeMany<TQuery>(query: TQuery): Promise<number> {
    const svc = this.service;
    const db: orientjs.ODatabase = svc && svc.adapter.database;
    try {
      // const s = await this.client.sessions();
      // const db = await s.acquire();
      const r = await db
        .delete()
        .from(svc.schema.dataClass.name)
        .where(query)
        .one<number>();
      return r;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' remove records`,
        error,
      );
    }
  }

  /**
   * Remove an entity by ID
   *
   * @param {String} id - ObjectID as string.
   * @returns {Promise<Object>} Return with the removed document.
   *
   * @memberof OrientDBAdapter
   */
  public async removeById<R>(id: string | number): Promise<R> {
    const svc = this.service;
    const db: orientjs.ODatabaseSession = svc && svc.adapter.database;
    try {
      // const s = await this.client.sessions();
      // const db = await s.acquire();
      const r = await db
        .command<R>(
          `DELETE  FROM ${svc.schema.dataClass.name} WHERE ${svc.settings.idField} = :id LIMIT 1 UNSAFE`,
          { params: { id } },
        )
        .one();
      return { id } as any;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' remove record`,
        error,
      );
    }
  }

  /**
   * Clear all entities from collection
   *
   * @returns {Promise}
   *
   * @memberof OrientDBAdapter
   */
  public async clear(): Promise<void> {
    const svc = this.service;
    const db: orientjs.ODatabaseSession = svc && svc.adapter.database;
    try {
      await db
        .command(`TRUNCATE CLASS ${svc.schema.dataClass.name} UNSAFE`)
        .one();
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' clear records`,
        error,
      );
    }
  }

  /**
   * Convert DB entity to JSON object. It converts the `_id` to hexadecimal `String`.
   *
   * @param {Object} entity
   * @returns {Object}
   * @memberof OrientDBAdapter
   */
  public entityToObject<T, R>(entity: T): R {
    return Object.assign<R, T>({} as any, entity);
  }

  /**
   * Create a filtered cursor.
   *
   * Available filters in `QueryOptions`:
   *    - search
   *    - sort
   *    - limit
   *    - offset
   *    - query
   *
   * @param {QueryOptions} params
   * @param {Boolean} isCounting
   * @returns {OQuery<T>}
   */
  public createCursor<
    T = any,
    C extends CursorOptions<T> = any,
    Q = orientjs.OQuery<T>
  >(params?: C, isCounting = false): Q {
    const svc = this.service;
    const db = svc && svc.adapter.database;
    try {
      if (!db) {
        throw new Error("Database not initialized");
      }
      const mfields: string | string[] =
        (params && params.fields) ||
        (svc.schema.settings && svc.schema.settings.fields);
      const fields = typeof mfields === "string" ? mfields.split(",") : mfields;
      if (params) {
        let q = db
          .select(
            isCounting ? "count(*) AS count" : fields ? fields.join(",") : "*",
          )
          .from(svc.schema.dataClass.name);
        // Filter
        if (params.search) {
          let sfields = [];
          if (params.searchFields) {
            sfields =
              typeof params.searchFields === "string"
                ? params.searchFields.split(",")
                : params.searchFields;
            const f = Object.fromEntries(
              sfields.map((xx) => [xx, params.search]),
            );
            q = q.where(f);
          }
        } else {
          if (params.query) {
            q = q.where(params.query);
          }
        }
        // Sort
        if (params.sort) {
          q = q.order(params.sort);
        }
        // Paging
        if (params.limit || params.offset) {
          if (isNumber(params.offset) && params.offset > 0) {
            q = q.skip(params.offset);
          }
          if (isNumber(params.limit) && params.limit > 0) {
            q = q.limit(params.limit);
          }
        }
        return q as any;
      }
      return db
        .select(
          isCounting ? "count(*) AS count" : fields ? fields.join(",") : "*",
        )
        .from(svc.schema.dataClass.name) as any;
    } catch (error) {
      svc.logger.error(
        `Error occured in '${svc.schema.dataClass.name}' createCursor`,
        error,
      );
    }
  }

  /**
   * Transforms 'idField' into OrientDB's '_id'
   * @param {Object} entity
   * @param {String} idField
   * @memberof OrientDBAdapter
   * @returns {Object} Modified entity
   */
  public beforeSaveTransformID<T, R = T>(entity: T, idField: string): R {
    return entity as any;
  }

  /**
   * Transforms OrientDB's 'id' into user defined 'idField'
   * @param {Object} entity
   * @param {String} idField
   * @memberof OrientDBAdapter
   * @returns {Object} Modified entity
   */
  public afterRetrieveTransformID<T>(entity: T, idField: string): any {
    // if (idField !== "_id") {
    // 	entity[idField] = entity["_id"];
    // 	delete entity._id;
    // }
    delete entity["@class"];
    delete entity["@version"];
    delete entity["@rid"];
    return entity;
  }

  /**
   * Return OrientDB Client instance
   *
   * @returns {orientjs.OrientDBClient}
   */
  public getClient(): orientjs.OrientDBClient {
    return this.client;
  }

  /**
   * Return orientjs.OClass instance
   *
   * @returns {orientjs.OClass}
   */
  public getDataClass(): orientjs.OClass {
    return this.dataClass;
  }

  /**
   * execute orientdb command.
   * @param command command
   * @param options options
   */
  public runCommand<R>(command: string, options?: any): orientjs.OResult<R> {
    return this.database.command<R>(command, options);
  }

  /**
   * execute orientdb query
   * @param query query
   * @param options options
   */
  public runQuery<R>(query: string, options?: any): orientjs.OResult<R> {
    return this.database.query<R>(query, options);
  }

  /**
   * execute orientdb live query for reactive query
   * @param query query
   * @param options options
   */
  public runLive(query: string, options?: any): orientjs.LiveQuery {
    return this.database.liveQuery(query, options);
  }
}
