import * as AWS from "aws-sdk";
import * as fs from "fs";
import {MongoClient} from "mongodb";

/**
 * This class will keep a store of all the files the app knows about.
 * Those files can exist locally or stored on a s3 bucket.
 */
export class XmlManager {
    /**
     * A link to the initialised collection.
     */
    private collection;
    /**
     * The options used to create the database.
     */
    private dbOptions: IDBOptions;
    /**
     * Location of local files on server.
     */
    private localFilesDir: string;
    /**
     * The s3 object created using the aws-sdk
     */
    private s3;
    /**
     * Information used to create the s3 object.
     */
    private s3Info: IS3Info;
    constructor(dbOptions: IDBOptions, localFilesDir: string, s3Info?: IS3Info) {
        this.collection = null;
        this.dbOptions = dbOptions;
        this.localFilesDir = localFilesDir;
        if (s3Info) {
            AWS.config.update({
                accessKeyId: s3Info.keyID,
                secretAccessKey: s3Info.secret,
            });
            this.s3 = new AWS.S3();
            this.s3Info = s3Info;
        } else {
            this.s3 = null;
        }
    }

    /**
     * When this function is called the database it updated with the new files in s3.
     * It checks if the file has already been recorded and if not then it stores it.
     * AWS sets directories as keys so must check it has extension xml.
     */
    public s3AddAll() {
        return this.init().then((col: any) => {
            return new Promise((resolve, reject) => {
                this.s3.listObjects({Bucket: this.s3Info.bucketName, Marker: "/", MaxKeys: 1000}, (err, data) => {
                    if (err) {
                        throw err;
                    }
                    const dataContentReverse = data.Contents.slice().reverse();
                    data.Contents.map((name) => {
                        col.count({name: name.Key}, (errCount, count) => {
                            if (count === 0 && name.Key.indexOf(".xml") !== -1) {
                                const input = {name: name.Key, location: "s3", processed: "false"};
                                col.insert(input, (errInsert, result) => {
                                    if (errInsert) {
                                        throw errInsert;
                                    }
                                    if (dataContentReverse[0] === name) {
                                        resolve("s3 list updated");
                                    }
                                });
                            } else {
                                if (dataContentReverse[0] === name) {
                                    resolve("s3 list updated");
                                }
                            }
                        });
                    });
                });
            });
        });
    }
    /**
     * This function will update the database when a local file has been added.
     * It checks all the files and stores the new ones added.
     * You could also pass a list of the files but it's simpler to just check the directory.
     */
    public uploadAddAll() {
        return this.init().then((col: any) => {
            return new Promise((resolve, reject) => {
                fs.readdir(this.localFilesDir, (err, files) => {
                    const filesReverse = files.slice().reverse();
                    files.forEach((file) => {
                        col.count({name: file}, (errCount: string, count: number) => {
                            if (count === 0 && file.indexOf(".xml") !== -1) {
                                const input = {name: file, location: "local", processed: "false"};
                                col.insert(input, (errInsert: string, result: any) => {
                                    if (errInsert) {
                                        throw errInsert;
                                    }
                                    if (filesReverse[0] === file) {
                                        resolve("local list updated");
                                    }
                                });
                            } else {
                                if (filesReverse[0] === file) {
                                    resolve("local list updated");
                                }
                            }
                        });
                    });
                });
            });
        });
    }
    /**
     * This function will change a files information.
     * It is used to specify when a file has been processed or moved from local storage to s3(remote).
     */
    public updateFile(input: {name: string; location: string; processed: string}) {
        return this.init().then((col: any) => {
            return new Promise((resolve, reject) => {
                col.update({name: input.name}, input, () => {
                    resolve("Updated");
                });
            });
        });
    }
    /**
     * This function will connect the database and create a collection.
     * This function is called in each public function to ensure we initialise the collection before use.
     * Note the collection is reset when the app first starts to ensure an up to data list.
     */
    private init() {
        return new Promise((resolve, reject) => {
            if (this.collection) {
                resolve(this.collection);
            } else {
                MongoClient.connect(this.dbOptions.location, (errCon, db) => {
                    if (errCon) {
                        throw errCon;
                    }
                    db.collection(this.dbOptions.name).drop();
                    db.collection(this.dbOptions.name, (errCol, col) => {
                        if (errCol) {
                            throw errCol;
                        }
                        this.collection = col;
                        resolve(col);
                    });
                });
            }
        });
    }
}
