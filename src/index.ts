/*
 * moleculer-db-adapter-orientdb
 * Copyright (c) 2019 Saeed Tabrizi (https://github.com/Saeed Tabrizi/moleculer-db-adapter-orientdb)
 * MIT Licensed
 */

"use strict";

import { Service, ServiceBroker } from "moleculer";
import * as orientjs from "orientjs";
import { isNumber } from "util";

export interface QueryOptions {
    filter?: string | object;
    sort?: { [key: string]: "asc" | "desc" };
    paging?: { page?: number; limit?: number };
    fields?: string[];
}
export default class OrientDBAdapter {
  public opts: any[];
  public broker: ServiceBroker;
  public service: Service;
  public database: orientjs.ODatabase;
  public dataClass: orientjs.OClass;
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
    this.service = service;
    this.service.schema.settings.idField = "id";

    if (!this.service.schema.database) {
      /* istanbul ignore next */
      throw new Error("Missing `database` definition in schema of service!");
    }

    if (!this.service.schema.dataClass) {
      /* istanbul ignore next */
      throw new Error("Missing `dataClass` definition in schema of service!");
    }
  }

  /**
   * Connect to database
   *
   * @returns {Promise}
   *
   * @memberof OrientDBAdapter
   */
  public async connect(): Promise<boolean> {
    const {  database, dataClass } = this.service.schema;
    const dataClient = this.opts[0] || {host: "localhost", port: 2424};
    try {
      this.client = await orientjs.OrientDBClient.connect(dataClient);
      const exists = await this.client.existsDatabase(database);
      if (!exists) {
        await this.client.createDatabase(database);
      }
      const sessions = await this.client.sessions(database);
      const dbPool = await sessions.acquire();
      dbPool.once("close", () => {
        this.service.logger.warn("Disconnected from db");
      });
      const clss = await dbPool.class.get(dataClass.name);
      if (!clss) {
        await dbPool.class.create(dataClass);
      }
      this.service.logger.warn(`Connected to "${dbPool.name}" db`);
      return true;
    } catch (error) {
      this.service.logger.error("Error while connecting to db", error);
      return false;
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
  public async find<R>(filters: any) {
    return this.createCursor<R[]>(filters, false);
  }

  /**
   * Find an entity by query
   *
   * @param {Object} query
   * @returns {Promise}
   * @memberof OrientDBAdapter
   */
  public async findOne<R>(query: any) {
    return this.createCursor<R>(query, false);
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
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db.query<R>(
        `SELECT * FROM ${this.dataClass.name} WHERE ${this.idField} = :id`,
        { params: { id } },
      );
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' findByIds`,
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
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db.query<R>(
        `SELECT * FROM ${this.dataClass.name} WHERE ${this.idField} IN :ids`,
        { params: { ids: idList } },
      );
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' findByIds`,
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
    return this.createCursor(filters, true);
  }

  /**
   * Insert an entity.
   *
   * @param {Object} entity
   * @returns {Promise<Object>} Return with the inserted document.
   *
   * @memberof OrientDBAdapter
   */
  public async insert<TEntity>(entity: TEntity): Promise<TEntity> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db
        .insert()
        .into(this.dataClass.name)
        .set(entity)
        .one<TEntity>();
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' insert record`,
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
  public async insertMany<TEntity>(...entities: TEntity[]): Promise<TEntity[]> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const A: TEntity[] = [];
      for (const entity of entities) {
        const r = await db
          .insert()
          .into(this.dataClass.name)
          .set(entity)
          .one<TEntity>();
        A.push(r);
      }

      return A;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' insert records`,
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
  public async updateMany<TQuery, TEntity>(
    query: TQuery,
    update: TEntity,
  ): Promise<TEntity[]> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db
        .update(this.dataClass.name)
        .set(update)
        .where(query)
        .all<TEntity>();
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' update records`,
        error,
      );
    }
    // return new Promise<number>((resolve, reject) => {
    // 	if ("$set" in update) {
    // 		update = update.$set;
    // 	}
    // 	r.table(this.table).filter(query).update(update).run(this.client, (err, res) => {
    // 		if (err) { reject(err); }
    // 		resolve(res);
    // 	});
    // }.bind(this));
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
  public async updateById<TEntity>(
    id: string,
    update: TEntity,
  ): Promise<TEntity> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db
        .update(this.dataClass.name)
        .set(update)
        .where({ [this.idField]: id })
        .one<TEntity>();
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' update record`,
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
  public async removeMany<TQuery, R>(query: TQuery): Promise<R[]> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db
        .delete()
        .from(this.dataClass.name)
        .where(query)
        .all<R>();
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' remove records`,
        error,
      );
    }
  }

  /**
   * Remove an entity by ID
   *
   * @param {String} id - ObjectID as hexadecimal string.
   * @returns {Promise<Object>} Return with the removed document.
   *
   * @memberof OrientDBAdapter
   */
  public async removeById<R>(id: string): Promise<R> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      const r = await db.query<R>(
        `DELETE * FROM ${this.dataClass.name} WHERE ${this.idField} = :id`,
        { params: { id } },
      );
      return r;
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' remove record`,
        error,
      );
    }
    // return new Promise((resolve, reject) => {
    // 	r.table(this.table).get(id).delete().run(this.client, (err, res) => {
    // 		if (err) { reject(err); }
    // 		const resp = {};
    // 		const idField = this.service.schema.settings.idField;
    // 		resp[idField] = id;
    // 		resolve(resp);
    // 	}.bind(this));
    // }.bind(this));
  }

  /**
   * Clear all entities from collection
   *
   * @returns {Promise}
   *
   * @memberof OrientDBAdapter
   */
  public async clear(): Promise<void> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();
      await db.query(`DELETE * FROM ${this.dataClass.name}`);
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' clear records`,
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
  public entityToObject<TEntity, R>(entity: TEntity): R {
    return Object.assign<R, TEntity>({} as any, entity);
  }

  /**
   * Create a filtered cursor.
   *
   * Available filters in `QueryOptions`:
   *    - search
   *    - sort
   *    - limit
   *    - offset
   *  - query
   *
   * @param {QueryOptions} params
   * @param {Boolean} isCounting
   * @returns {Promise<R>}
   */
  public async createCursor<R>(
    params?: QueryOptions,
    isCounting = false,
  ): Promise<R> {
    try {
      const s = await this.client.sessions();
      const db = await s.acquire();

      if (params) {
        let q = db.select( isCounting ? "count(*) AS count" : (params.fields ? params.fields : "*") )
                  .from(this.dataClass.name);
        // Filter
        if (params.filter) {
          q = q.where(params.filter);
        }
        // Sort
        if (params.sort) {
          q = q.order(params.sort);
        }
        // Paging
        if (params.paging) {
          if (isNumber(params.paging.page) && params.paging.page > 0) {
            q = q.skip(params.paging.page);
          }
          if (isNumber(params.paging.limit) && params.paging.limit > 0) {
            q = q.limit(params.paging.limit);
          }
        }
         // If not params
        if (isCounting) {
          const c = await q.one<any>();
          return c ? c.count : 0;
        } else {
          const r = await q.all<R>() as any;
          return r;
        }
      }
      return ([] as any);
    } catch (error) {
      this.service.logger.error(
        `Error occured in '${this.dataClass.name}' createCursor`,
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
  public beforeSaveTransformID<TEntity>(entity: TEntity, idField: string) {
    return entity;
  }

  /**
   * Transforms OrientDB's 'id' into user defined 'idField'
   * @param {Object} entity
   * @param {String} idField
   * @memberof OrientDBAdapter
   * @returns {Object} Modified entity
   */
  public afterRetrieveTransformID<TEntity>(
    entity: TEntity,
    idField: string,
  ): any {
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
}
