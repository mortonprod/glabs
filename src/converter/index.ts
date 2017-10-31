import {MongoClient} from "mongodb";
import {parseString} from "xml2js";

// console.log = () => {return; };
/**
 * This class is concerned with converting xml to json and storing the result of the transformation.
 * The json produced can then be formated using a function passed through the constructor.
 * The convert function is the public function to do this.
 * It can also create a new collection with a projection of all documents stored.
 * Search is the public function to get the projection of each document in the collection.
 */
export class Converter {
    /**
     * The database instance
     */
    private database;
    /**
     * Collection instance
     */
    private collection;
    /**
     * DB info
     */
    private dbOptions;
    /**
     * Function to format json after being produced.
     * This allows you to change the output json anyway you want before it is stored.
     * If no function provided then the ouput of xml2js is stored.
     */
    private format;
    /**
     * This will initialise the variables of the class.
     * @param dbOptions The information to link to the mongodb collection.
     * @param format This is the function which you can format the json after the initial conversion.
     */
    constructor(dbOptions: IDBOptions, format?: (result: string) => string) {
        this.format = format;
        this.dbOptions = dbOptions;
    }
    /**
     * This function will convert a file to json and store it to mongodb if it has not done so already.
     * The function returns a promise which resolves/rejects on completion.
     * The function will only resolve when the database has been initialised.
     */
    public convert(input: {file: string; xml: string; }) {
        return this.init().then((result: {db: any; col: any}) => {
            return new Promise((resolve, reject) => {
                result.col.count({file: input.file}, (errCount, count) => {
                    if (errCount) {
                        throw errCount;
                    }
                    if (count === 0) {
                        parseString(input.xml,  (errString, resultString) => {
                            if (errString) {
                                throw errString;
                            }
                            if (this.format) {
                                resultString = this.format(resultString);
                            }
                            result.col.insert({file: input.file, info: resultString}, (errInsert, out) => {
                                if (errInsert) {
                                    throw errInsert;
                                }
                                // console.log("insert: " + JSON.stringify(out.ops));
                                resolve("Saved");
                            });
                        });
                    } else {
                        reject("Already exists");
                    }
                });
            });
        });
    }
    /**
     * This function will store the result of an aggregate search.
     * The search will be stored in a new collection with the name specified as an argument.
     * Note each time the function is called the collection stored will be dropped and filled again.
     * //
     * //
     * THIS FUNCTION WILL PROCESS ALL FILES EACH TIME. THIS IS PROBABLY NOT THE BEST WAY...
     * @param collectionName The name to give the new collection.
     * @param aggCommand The command to get the new document to store in the collection.
     */
    public search(collectionName: string, aggCommand: object) {
        return this.init().then((result: {db: any; col: any}) => {
            return new Promise((resolve, reject) => {
                result.db.collection(collectionName).drop();
                result.db.collection(collectionName, (errColNew, colNew) => {
                    if (errColNew) {
                        throw errColNew;
                    }
                    result.col.aggregate(aggCommand, (err, out) => {
                        colNew.insert({out}, (errInsert, insertResult) => {
                            if (errInsert) {
                                throw errInsert;
                            }
                            resolve("Searched All files");
                        });
                    });
                });
            });
        });
    }
    /**
     * This function will return the result of the search function collections.
     * @param collectionName The name of the collection to return.
     */
    public getSearch(collectionName: string) {
        return this.init().then((result: {db: any; col: any}) => {
            return new Promise((resolve, reject) => {
                result.db.collection(collectionName, (errColSearch, colSearch) => {
                    colSearch.find({}, {_id: 0, out: 1}).toArray((e, out) => {
                        resolve(out);
                    });
                });
            });
        });
    }
    /**
     * Initialise the database and collection.
     * This is done so we can be sure we do not lose track of the files we have converted.
     * This function will be called by all public functions to ensure the database is connected.
     */
    private init() {
        return new Promise((resolve, reject) => {
            if (this.collection || this.database) {
                resolve({db: this.database, col: this.collection});
            } else {
                MongoClient.connect(this.dbOptions.location, (errCon, db) => {
                    if (errCon) {
                        throw errCon;
                    }
                    this.database = db;
                    db.collection(this.dbOptions.name, (errCol, col) => {
                        if (errCol) {
                            throw errCol;
                        }
                        this.collection = col;
                        resolve({db, col});
                    });
                });
            }
        });
    }
}
