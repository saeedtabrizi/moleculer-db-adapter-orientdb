/*
 * moleculer-db-adapter-orientdb
 * Copyright (c) 2019 Saeed Tabrizi (https://github.com/Saeed Tabrizi/moleculer-db-adapter-orientdb)
 * MIT Licensed
 */
"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const orientjs = __importStar(require("orientjs"));
const util_1 = require("util");
class OrientDBAdapter {
    /**
     * Creates an instance of OrientDBAdapter.
     * @param {any} opts
     *
     * @memberof OrientDBAdapter
     */
    constructor(...opts) {
        this.idField = "id";
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
    init(broker, service) {
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
    async connect() {
        const { database, dataClass } = this.service.schema;
        const dataClient = this.opts[0] || { host: "localhost", port: 2424 };
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
        }
        catch (error) {
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
    disconnect() {
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
    async find(filters) {
        return this.createCursor(filters, false);
    }
    /**
     * Find an entity by query
     *
     * @param {Object} query
     * @returns {Promise}
     * @memberof OrientDBAdapter
     */
    async findOne(query) {
        return this.createCursor(query, false);
    }
    /**
     * Find an entities by ID.
     *
     * @param {String} id
     * @returns {Promise<Object>} Return with the found document.
     *
     * @memberof OrientDBAdapter
     */
    async findById(id) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db.query(`SELECT * FROM ${this.dataClass.name} WHERE ${this.idField} = :id`, { params: { id } });
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' findByIds`, error);
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
    async findByIds(idList) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db.query(`SELECT * FROM ${this.dataClass.name} WHERE ${this.idField} IN :ids`, { params: { ids: idList } });
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' findByIds`, error);
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
    async count(filters) {
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
    async insert(entity) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db
                .insert()
                .into(this.dataClass.name)
                .set(entity)
                .one();
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' insert record`, error);
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
    async insertMany(...entities) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const A = [];
            for (const entity of entities) {
                const r = await db
                    .insert()
                    .into(this.dataClass.name)
                    .set(entity)
                    .one();
                A.push(r);
            }
            return A;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' insert records`, error);
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
    async updateMany(query, update) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db
                .update(this.dataClass.name)
                .set(update)
                .where(query)
                .all();
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' update records`, error);
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
    async updateById(id, update) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db
                .update(this.dataClass.name)
                .set(update)
                .where({ [this.idField]: id })
                .one();
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' update record`, error);
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
    async removeMany(query) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db
                .delete()
                .from(this.dataClass.name)
                .where(query)
                .all();
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' remove records`, error);
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
    async removeById(id) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            const r = await db.query(`DELETE * FROM ${this.dataClass.name} WHERE ${this.idField} = :id`, { params: { id } });
            return r;
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' remove record`, error);
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
    async clear() {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            await db.query(`DELETE * FROM ${this.dataClass.name}`);
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' clear records`, error);
        }
    }
    /**
     * Convert DB entity to JSON object. It converts the `_id` to hexadecimal `String`.
     *
     * @param {Object} entity
     * @returns {Object}
     * @memberof OrientDBAdapter
     */
    entityToObject(entity) {
        return Object.assign({}, entity);
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
    async createCursor(params, isCounting = false) {
        try {
            const s = await this.client.sessions();
            const db = await s.acquire();
            if (params) {
                let q = db.select(isCounting ? "count(*) AS count" : (params.fields ? params.fields : "*"))
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
                    if (util_1.isNumber(params.paging.page) && params.paging.page > 0) {
                        q = q.skip(params.paging.page);
                    }
                    if (util_1.isNumber(params.paging.limit) && params.paging.limit > 0) {
                        q = q.limit(params.paging.limit);
                    }
                }
                // If not params
                if (isCounting) {
                    const c = await q.one();
                    return c ? c.count : 0;
                }
                else {
                    const r = await q.all();
                    return r;
                }
            }
            return [];
        }
        catch (error) {
            this.service.logger.error(`Error occured in '${this.dataClass.name}' createCursor`, error);
        }
    }
    /**
     * Transforms 'idField' into OrientDB's '_id'
     * @param {Object} entity
     * @param {String} idField
     * @memberof OrientDBAdapter
     * @returns {Object} Modified entity
     */
    beforeSaveTransformID(entity, idField) {
        return entity;
    }
    /**
     * Transforms OrientDB's 'id' into user defined 'idField'
     * @param {Object} entity
     * @param {String} idField
     * @memberof OrientDBAdapter
     * @returns {Object} Modified entity
     */
    afterRetrieveTransformID(entity, idField) {
        return entity;
    }
    /**
     * Return OrientDB Client instance
     *
     * @returns {orientjs.OrientDBClient}
     */
    getClient() {
        return this.client;
    }
    /**
     * Return orientjs.OClass instance
     *
     * @returns {orientjs.OClass}
     */
    getDataClass() {
        return this.dataClass;
    }
}
exports.default = OrientDBAdapter;
