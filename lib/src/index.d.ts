import { Service, ServiceBroker } from "moleculer";
import * as orientjs from "orientjs";
export interface QueryOptions {
    filter?: string | object;
    sort?: {
        [key: string]: "asc" | "desc";
    };
    paging?: {
        page?: number;
        limit?: number;
    };
    fields?: string[];
}
export default class OrientDBAdapter {
    opts: any[];
    broker: ServiceBroker;
    service: Service;
    database: orientjs.ODatabase;
    dataClass: orientjs.OClass;
    client: orientjs.OrientDBClient;
    idField: string;
    /**
     * Creates an instance of OrientDBAdapter.
     * @param {any} opts
     *
     * @memberof OrientDBAdapter
     */
    constructor(...opts: any[]);
    /**
     * Initialize adapter
     *
     * @param {ServiceBroker} broker
     * @param {Service} service
     *
     * @memberof OrientDBAdapter
     */
    init(broker: ServiceBroker, service: Service): void;
    /**
     * Connect to database
     *
     * @returns {Promise}
     *
     * @memberof OrientDBAdapter
     */
    connect(): Promise<boolean>;
    /**
     * Disconnect from database
     *
     * @returns {Promise}
     *
     * @memberof OrientDBAdapter
     */
    disconnect(): Promise<void>;
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
    find<R>(filters: any): Promise<R[]>;
    /**
     * Find an entity by query
     *
     * @param {Object} query
     * @returns {Promise}
     * @memberof OrientDBAdapter
     */
    findOne<R>(query: any): Promise<R>;
    /**
     * Find an entities by ID.
     *
     * @param {String} id
     * @returns {Promise<Object>} Return with the found document.
     *
     * @memberof OrientDBAdapter
     */
    findById<R>(id: string): Promise<R>;
    /**
     * Find any entities by IDs.
     *
     * @param {Array} idList
     * @returns {Promise<Array>} Return with the found documents in an Array.
     *
     * @memberof OrientDBAdapter
     */
    findByIds<R>(idList: Array<number | string>): Promise<R>;
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
    count(filters?: any): Promise<number>;
    /**
     * Insert an entity.
     *
     * @param {Object} entity
     * @returns {Promise<Object>} Return with the inserted document.
     *
     * @memberof OrientDBAdapter
     */
    insert<TEntity>(entity: TEntity): Promise<TEntity>;
    /**
     * Insert many entities
     *
     * @param {Array} entities
     * @returns {Promise<Array<Object>>} Return with the inserted documents in an Array.
     *
     * @memberof OrientDBAdapter
     */
    insertMany<TEntity>(...entities: TEntity[]): Promise<TEntity[]>;
    /**
     * Update many entities by `query` and `update`
     *
     * @param {Object} query
     * @param {Object} update
     * @returns {Promise<Number>} Return with the count of modified documents.
     *
     * @memberof OrientDBAdapter
     */
    updateMany<TQuery, TEntity>(query: TQuery, update: TEntity): Promise<TEntity[]>;
    /**
     * Update an entity by ID and `update`
     *
     * @param {String} id - ObjectID as hexadecimal string.
     * @param {Object} update
     * @returns {Promise<Object>} Return with the updated document.
     *
     * @memberof OrientDBAdapter
     */
    updateById<TEntity>(id: string, update: TEntity): Promise<TEntity>;
    /**
     * Remove entities which are matched by `query`
     *
     * @param {Object} query
     * @returns {Promise<Number>} Return with the count of deleted documents.
     *
     * @memberof OrientDBAdapter
     */
    removeMany<TQuery, R>(query: TQuery): Promise<R[]>;
    /**
     * Remove an entity by ID
     *
     * @param {String} id - ObjectID as hexadecimal string.
     * @returns {Promise<Object>} Return with the removed document.
     *
     * @memberof OrientDBAdapter
     */
    removeById<R>(id: string): Promise<R>;
    /**
     * Clear all entities from collection
     *
     * @returns {Promise}
     *
     * @memberof OrientDBAdapter
     */
    clear(): Promise<void>;
    /**
     * Convert DB entity to JSON object. It converts the `_id` to hexadecimal `String`.
     *
     * @param {Object} entity
     * @returns {Object}
     * @memberof OrientDBAdapter
     */
    entityToObject<TEntity, R>(entity: TEntity): R;
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
    createCursor<R>(params?: QueryOptions, isCounting?: boolean): Promise<R>;
    /**
     * Transforms 'idField' into OrientDB's '_id'
     * @param {Object} entity
     * @param {String} idField
     * @memberof OrientDBAdapter
     * @returns {Object} Modified entity
     */
    beforeSaveTransformID<TEntity>(entity: TEntity, idField: string): TEntity;
    /**
     * Transforms OrientDB's 'id' into user defined 'idField'
     * @param {Object} entity
     * @param {String} idField
     * @memberof OrientDBAdapter
     * @returns {Object} Modified entity
     */
    afterRetrieveTransformID<TEntity>(entity: TEntity, idField: string): any;
    /**
     * Return OrientDB Client instance
     *
     * @returns {orientjs.OrientDBClient}
     */
    getClient(): orientjs.OrientDBClient;
    /**
     * Return orientjs.OClass instance
     *
     * @returns {orientjs.OClass}
     */
    getDataClass(): orientjs.OClass;
}
