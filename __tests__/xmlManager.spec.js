const XmlManager = require("../dist/xmlManager").XmlManager;
const MongoClient = require("mongodb").MongoClient;
var assert = require('assert');
const info = require("../dist/keys.js").obj;
const dbOptions = {
    name: "xmlFiles",
    location: "mongodb://127.0.0.1:27017",
}

const localDir = "./data/xmlFiles/";

const s3Info = {
    bucketName: "glabs-example-data",
    key: "",
    keyID: info.keyID,
    secret: info.secret
}



let database = null;
let collection = null;
MongoClient.connect(dbOptions.location, (errCon, db) => {
    database = db;
    db.collection(dbOptions.name).drop();
    db.collection(dbOptions.name, (errCol, col) => {
        collection = col;
    })
});
const xmlManger = new XmlManager(dbOptions,localDir,s3Info);

describe('XMLManager', function() {
    it("should update the s3 list", function(done){
        xmlManger.s3AddAll().then((result) => {
            assert.equal(result, "s3 list updated");  
            done(); 
        }).catch((err) => {
            console.log(err);
        });
    })
    it("should update the local list", function(done){
        xmlManger.uploadAddAll().then((result) => {
            assert.equal(result, "local list updated");  
            done(); 
        }).catch((err) => {
            console.log(err);
        });
    })
    it("should have 10 s3 entries", function(done){
        collection.aggregate([{"$match": {location:"s3"}},{ "$group": {_id: null, count: {"$sum": 1}}}],function(err,out){
            assert.equal(out[0].count, 10);              
            done();
        });  
    })
    it("should have 10 local entries", function(done){
        collection.aggregate([{"$match": {location:"local"}},{ "$group": {_id: null, count: {"$sum": 1}}}],function(err,out){
            assert.equal(out[0].count, 10);              
            done();
        });  
    })
    it("should update the s3 list again", function(done){
        xmlManger.s3AddAll().then((result) => {
            assert.equal(result, "s3 list updated");  
            done(); 
        }).catch((err) => {
            console.log(err);
        });
    })
    it("should update the local list again", function(done){
        xmlManger.uploadAddAll().then((result) => {
            assert.equal(result, "local list updated");  
            done(); 
        }).catch((err) => {
            console.log(err);
        });
    })
    it("should have 10 s3 entries after adding again", function(done){
        collection.aggregate([{"$match": {location:"s3"}},{ "$group": {_id: null, count: {"$sum": 1}}}],function(err,out){
            assert.equal(out[0].count, 10);              
            done();
        });  
    })
    it("should have 10 local entries after adding again", function(done){
        collection.aggregate([{"$match": {location:"local"}},{ "$group": {_id: null, count: {"$sum": 1}}}],function(err,out){
            assert.equal(out[0].count, 10);              
            done();
        });  
    })
    it("should uddate a local file from unprocessed to processed", function(done){
        const input = {name: "exampleData/sample.xml", location: "s3", processed: "true"}
        xmlManger.updateFile(input).then((result) => {
            assert.equal(result, "Updated");  
            done(); 
        }).catch((err) => {
            console.log(err);
        });
    })
    it("should uddate a s3 file from unprocessed to processed", function(done){
        const input = {name: "sample.xml", location: "local", processed: "true"}
        xmlManger.updateFile(input).then((result) => {
            assert.equal(result, "Updated");  
            done(); 
        }).catch((err) => {
            console.log(err);
        });
    })
    it("should have 2 processed files", function(done){
        collection.aggregate([{"$match": {processed:"true"}},{ "$group": {_id: null, count: {"$sum": 1}}}],function(err,out){
            assert.equal(out[0].count, 2);              
            done();
        });  
    })
    it("should have 18 unprocessed files", function(done){
        collection.aggregate([{"$match": {processed:"false"}},{ "$group": {_id: null, count: {"$sum": 1}}}],function(err,out){
            assert.equal(out[0].count, 18);              
            done();
        });  
    })
})