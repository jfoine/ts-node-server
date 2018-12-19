import {inject, injectable} from 'inversify';
import {
    CollectionInsertOneOptions,
    Db,
    DeleteWriteOpResultObject,
    FindOneOptions,
    InsertOneWriteOpResult,
    Logger as MongoLogger,
    MongoClient,
    MongoError,
    UpdateWriteOpResult,
} from 'mongodb';
import {Logger} from 'pino';
import {JsonConverter} from '../json/JsonConverter';
import {types} from '../types';
import {MONGO_COLLECTION} from './collection.decorator';
import {DEFAULT_MONGO_OPTIONS, MongoOptions} from './MongoOptions';

export interface MongoIsMasterResult {
    ismaster: boolean;
    readOnly: boolean;
    ok: number;
}

@injectable()
export class MongoService {

    /**
     * Get collection for a type
     * @param type
     * @returns {string}
     */
    public static getCollectionForType(type: any): string {
        return Reflect.getMetadata(MONGO_COLLECTION, type.prototype);
    }

    /**
     *
     * @param obj
     * @returns {string}
     */
    public static getCollection(obj: any): string {
        return MongoService.getCollectionForType(obj.constructor);
    }

    private logger: Logger;
    private client: MongoClient;
    private db: Db;
    private error: Error;

    /**
     * Constructor
     * @param {P.Logger} logger
     */
    constructor(@inject(types.Logger) logger: Logger) {
        this.logger = logger.child({module: 'MongoService'});
    }

    /**
     * Connect to mongodb
     * @param {MongoOptions} options
     * @returns {Promise<void>}
     */
    public async connect(options = DEFAULT_MONGO_OPTIONS): Promise<void> {

        const logger = this.logger.child({method: 'connect'});

        MongoLogger.setCurrentLogger((msg, state) => {
            this.logger.debug(msg, state);
        });

        try {
            this.client = await MongoClient.connect(options.uri, options.client);
            this.db = this.client.db(options.dbName);
            logger.info('connected to mongodb successfully');
        } catch (err) {
            logger.error('failed to connect to mongodb', err);
            this.error = err;
        }
    }

    /**
     * Do something wrapper
     * @param {() => T} action
     * @returns {T}
     */
    public doAction<T>(action: () => T): T {

        if (this.error) {
            throw this.error;

        } else if (!this.client || !this.db) {
            throw new MongoError('database is not ready');

        } else {
            return action();
        }
    }

    /**
     * Is mongo master
     * @returns {Promise<MongoIsMasterResult>}
     */
    public isMaster(): Promise<MongoIsMasterResult> {

        return this.doAction(
            () => this.db.command({isMaster: 1}));
    }

    /**
     * Find one document
     * @param type
     * @param {object} query
     * @param {FindOneOptions} options
     * @returns {Promise<T>}
     */
    public findOne<T>(type: any, query?: object, options?: FindOneOptions): Promise<T> {

        const collection = MongoService.getCollectionForType(type);

        return this.doAction(
            () => this.db.collection(collection).findOne(query, options))
            .then((json) => JsonConverter.deserialize<T>(json, type));
    }

    /**
     * Insert one document
     * @param obj
     * @param {CollectionInsertOneOptions} options
     * @returns {Promise<InsertOneWriteOpResult>}
     */
    public insertOne(obj: any, options?: CollectionInsertOneOptions): Promise<InsertOneWriteOpResult> {

        const json = JsonConverter.serialize(obj);
        const collection = MongoService.getCollection(obj);

        return this.doAction(
            () => this.db.collection(collection).insertOne(json, options));
    }

    /**
     * Find
     * @param type
     * @param {object} query
     * @returns {Promise<T[]>}
     */
    public find<T>(type: any, query: object = {}): Promise<T[]> {

        const collection = MongoService.getCollectionForType(type);

        return this.doAction(
            () => this.db.collection(collection).find(query).toArray())
            .then((json) => JsonConverter.deserialize<T[]>(json, [type]));
    }

    /**
     * Delete one
     * @param type
     * @param {object} query
     * @returns {Promise<DeleteWriteOpResultObject>}
     */
    public deleteOne(type: any, query: object = {}): Promise<DeleteWriteOpResultObject> {

        const collection = MongoService.getCollectionForType(type);

        return this.doAction(
            () => this.db.collection(collection).deleteOne(query));
    }

    /**
     * Update one
     * @param type
     * @param {object} query
     * @param {object} update
     * @returns {Promise<UpdateWriteOpResult>}
     */
    public updateOne(type: any, query: object = {}, update: object = {}): Promise<UpdateWriteOpResult> {

        const collection = MongoService.getCollectionForType(type);

        return this.doAction(
            () => this.db.collection(collection).updateOne(query, update));
    }

    public close() {
        return this.client.close();
    }
}