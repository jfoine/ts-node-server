import {inject, injectable} from 'inversify';
import {Types} from '../../Types';
import {Logger} from 'pino';
import {Db, MongoClient, Logger as MongoLogger} from 'mongodb';
import {MongoOptions} from './MongoOptions';
import * as mixin from 'mixin-deep';

const DEFAULT_MONGO_OPTIONS: MongoOptions = {
    uri: process.env['MONGO_URL'] || 'mongodb://localhost:27017',
    dbName: process.env['MONGO_DB'] || 'main',
    client: {
        reconnectTries: 60,
        reconnectInterval: 1000,
        useNewUrlParser: true
    }
};

@injectable()
export class MongoService {

    private logger: Logger;

    constructor(@inject(Types.Logger) logger: Logger) {
        this.logger = logger.child({module: 'MongoService'});
    }

    private client: MongoClient;
    private db: Db;

    /**
     * Connect to mongodb
     * @param {MongoOptions} options
     * @returns {Promise<void>}
     */
    public connect(options: MongoOptions): Promise<void> {

        const logger = this.logger.child({method: 'connect'});

        options = mixin(DEFAULT_MONGO_OPTIONS, options);

        MongoLogger.setCurrentLogger((msg, state) => {
            this.logger.debug(msg, state);
        });

        return MongoClient.connect(options.uri, options.client)
            .catch((err) => {
                logger.error(err);
            })
            .then((client: MongoClient) => {
                this.client = client;
                this.db = client.db(options.dbName);
                logger.info('connected to mongodb successfully');
                return;
            });
    }

    public isConnected() {

        if (this.client && this.db) {
            const isMaster = this.db.command({ismaster: true});
        } else {
        }
    }

    public close() {
        return this.client.close();
    }
}