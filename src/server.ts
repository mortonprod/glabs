import * as bodyParser from "body-parser";
import * as express from "express";
import * as fs from "fs";
import {MongoClient} from "mongodb";
import * as multer from "multer";
import * as path from "path";
import {Converter} from "./converter";
import {obj} from "./keys";
import {XmlManager} from "./xmlManager";

/**
 * Production mongo database will be linked through docker.
 */
const mongoLoc = (process.env.NODE_ENV === "development") ? "mongodb://127.0.0.1:27017" : "mongodb://db:27017";
/**
 * The options to link the xml manager collection.
 */
const dbOptions = {
    location: mongoLoc,
    name: "xmlFiles",
};
/**
 * The options to link the converter collection.
 */
const dbOptionsConverter = {
    location: mongoLoc,
    name: "jsonConvert",
};

// tslint:disable-next-line
const aggCommand = {$project: {ReturnedDebitItem:'$info.BACSDocument.Data.ARUDD.Advice.OriginatingAccountRecords.OriginatingAccountRecord.ReturnedDebitItem'}};
const NewSearchCollectionName = "ReturnedDebitItem";

/**
 * When we restart the server delete the old collections.
 * We will automatically file the xml manager and convert again.
 * This would not be what we would do in final production.
 */
MongoClient.connect(dbOptions.location, (errCon, db) => {
    db.collection(dbOptions.name).drop();
    db.collection(dbOptionsConverter.name).drop();
    db.collection(NewSearchCollectionName).drop();
});

/**
 * This function will remove all dollar symbols before we save it to mongo db.
 */
function format(json) {
    json = JSON.stringify(json).replace(/\$/g, "attr");
    return JSON.parse(json);
}

/**
 * Location where the xml manager should look.
 */
const localDir = "./xmlFiles/";

/**
 * The information needed to link the s3 bucket.
 * The key is imported and not included in the github repository.
 * This means you can not run this without adding your own keys.
 */
const s3Info = {
    bucketKey: "exampleData",
    bucketName: "glabs-example-data",
    key: "",
    keyID: obj.keyID,
    secret: obj.secret,
};
/**
 * Create manager
 */
const xmlManger = new XmlManager(dbOptions, localDir, s3Info);
/**
 * Create converter
 */
const converter = new Converter(dbOptionsConverter, format);
/**
 * Initialise list from remote store.
 */
xmlManger.s3AddAll().then((result) => {
    return;
}).catch((err) => {
    throw err;
});
/**
 * Initialise list from local store.
 */
xmlManger.uploadAddAll().then((result) => {
    return;
}).catch((err) => {
    throw err;
});

/**
 * Convert all the local files and set that they have been processed.
 * In final production you would also get all the remote files and then process them.
 * After that you would convert all files uploaded(code added) and new remote files.
 * The remote files should send a signal from aws.
 */
fs.readdir(localDir, (err, files) => {
    callConverter(files).then((result) => {
        converter.search(NewSearchCollectionName, aggCommand).then((resultSearch) => {
            return;
        }).catch((resultSearch) => {
            throw resultSearch;
        });
    });
});

const app = express();
const upload = multer({ dest: path.join(".", "xmlFiles") });
app.use(bodyParser.json());
app.set("port", process.env.PORT || 3001);
app.use(express.static(path.join(".", "xmlFiles")));
app.set("views", path.join(".", "views"));
app.set("view engine", "jade");

app.get("/", (req, res) => {
    converter.getSearch("ReturnedDebitItem").then((result) => {
        const files = [];
        result[0].out.map((ei) => {
            const debit = ei.ReturnedDebitItem[0][0][0][0][0];
            const items = [];
            debit.map((ej) => {
                items.push({
                    bankName: ej.PayerAccount[0].attr.bankName,
                    branchName: ej.PayerAccount[0].attr.branchName,
                    currency: ej.attr.currency,
                    name: ej.PayerAccount[0].attr.name,
                    number: ej.PayerAccount[0].attr.number,
                    originalProcessingDate: ej.attr.originalProcessingDate,
                    ref: ej.attr.ref,
                    returnCode: ej.attr.returnCode,
                    returnDescription: ej.attr.returnDescription,
                    sortCode: ej.PayerAccount[0].attr.sortCode,
                    transCode: ej.attr.transCode,
                    valueOf: ej.attr.valueOf,
                });
            });
            files.push(items);
        });
        res.render("index", { title: "Glab Utility Display", files});
    });
});
/**
 * Post array of xml files and call xmlManager to record the new files.
 * Once this is done load the new files into the converter.
 * After this extract the specific debit entry we are interested in.
 * Note the client will recieve plain text output to display to the UI.
 */
app.post("/xmlfiles", upload.array("files"), (req, res) => {
    res.setHeader("content-type", "text/plain");
    if (!req.files) {
        res.status(400).send("No files uploaded");
    } else {
        getFilesAndErrors(req.files as Express.Multer.File[]).then((output) => {
            if (output.errors) {
                res.write(output.errors);
            }
            xmlManger.uploadAddAll().then((result) => {
                callConverter(output.finalFiles).then((resultConvert) => {
                    converter.search(NewSearchCollectionName, aggCommand).then((resultSearch) => {
                        res.status(200).send("Complete");
                    }).catch((resultSearch) => {
                        res.status(400).send(resultSearch);
                    });
                });
            }).catch((err) => {
                res.status(400).send(err);
            });
        });
    }
});
/**
 * This function will convert all files uploaded from xml to json.
 * If all files are converted then resolve.
 * If not then reject promise which will send a message to the client.
 * @param files The files to convert from xml to json
 */
function callConverter(files) {
    return new Promise((resolve, reject) => {
        const filesReverse = files.slice().reverse();
        files.map((file) => {
            fs.readFile(localDir + "/" + file, "utf8", (err, data) => {
                if (err) {
                    throw err;
                }
                const input = {file, xml: data};
                converter.convert(input).then((result) => {
                    const inputUpdate = {name: file, location: "local", processed: "true"};
                    xmlManger.updateFile(inputUpdate).then((resultUpdate) => {
                        if (file === filesReverse[0]) {
                            resolve("All files converted.");
                        }
                    }).catch((errUpdate) => {
                        reject(errUpdate);
                    });
                }).catch((result) => {
                    reject("File conversion failed.");
                });

            });
        });
    });
}

/**
 * This function will take a list of files and check if it can be added.
 * If an error is found then it will delete the file from directory and not add it to final list.
 * It will also be added to the error object to send back to the user to let them know.
 * If the file passes then the file is renamed to match the original name and added to the final list.
 */
function getFilesAndErrors(files: Express.Multer.File[]): Promise<ICheck> {
    return new Promise((resolve, reject) => {
        const errors: Array<{file: string; error: string}> = [];
        const finalFiles: Express.Multer.File[] = [];
        files.map((file) => {
            let isError = false;
            if (!file.originalname.includes(".xml")) {
                isError = true;
                errors.push({file: file.originalname, error: "No xml extension"});
            }
            if (isError) {
                fs.unlink(path.join(__dirname, "./data", file.filename), () => {
                    return;
                });
            } else {
                fs.rename(
                    path.join(".", "xmlFiles", file.filename),
                    path.join(".", "xmlFiles", file.originalname),
                    () => {
                        return;
                    },
                );
                finalFiles.push(file);
            }
        });
        resolve({finalFiles, errors});
    });
}

app.listen(app.get("port"), () => {
    console.log("Express server listening on port " + app.get("port"));
});
