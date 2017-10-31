const MongoClient = require("mongodb").MongoClient;
const Converter = require("../dist/converter").Converter;
const fs = require('fs');
const path = require('path');
var assert = require('assert');
const info = require("../dist/keys.js").obj;

const fileName = "sample.xml";
const fileName2 = "sample2.xml";
var xml = fs.readFileSync(path.join("xmlFiles", fileName), 'utf8');
var xml2 = fs.readFileSync(path.join("xmlFiles", fileName2), 'utf8');


/**
 * This function will remove all dollar symbols before we save it to mongo db.
 */
function format(json){
    json = JSON.stringify(json).replace(/\$/g, "attr")
    return JSON.parse(json);
}

const dbOptions = {
    name: "jsonConvert",
    location: "mongodb://127.0.0.1:27017",
}
let database = null;
let collection = null;
const NewSearchCollectionName = "ReturnedDebitItem";
const aggCommand = {$project: {ReturnedDebitItem:'$info.BACSDocument.Data.ARUDD.Advice.OriginatingAccountRecords.OriginatingAccountRecord.ReturnedDebitItem'}};
/**
 * Must reset the database and get collection object which we will be adding to.
 * This code seems a bit dangerous since the collection might not be ready before the testing starts!
 * However it is difficult to call describe/it from within the callback. How to fix this?
 */
MongoClient.connect(dbOptions.location, (errCon, db) => {
    database = db;
    db.collection(dbOptions.name).drop();
    db.collection(dbOptions.name, (errCol, col) => {
        collection = col; 
    })
});
describe('Converter', function() {
    it("Should start with no collections", function(done){
        const cursor = collection.find({});
        cursor.count(function(e, count){
            assert.equal(count, 0);
            done();
        });
    });
    const converter = new Converter(dbOptions,format);
    const input = {file:fileName, xml:xml};
    //Need to use done function even though documentation says to return promise!
    it('should convert an xml and then store it', function(done) {
        converter.convert(input).then((result)=>{          
            assert.equal(result, "Saved");
            done();
        }).catch((result) => {
            assert.equal(result, "Saved");            
            done();
        });
    });
    it('should tell you if the file already exists', function(done) {
        converter.convert(input).then((result)=>{          
            Error("Should not return " + result);
            assert.equal(result, "Already exists");            
            done();
        }).catch((result) => {
            assert.equal(result, "Already exists");
            done();
        });
    });
    it('should save the right file name', function(done) {
        collection.findOne({},function(e,out){
            assert.equal(out.file, "sample.xml");            
            done();
        }); 
    })
    it('should contain bac document', function(done) {
        collection.findOne({},{_id:0,info:1} ,function(e,out){
            assert.equal(Object.keys(out.info)[0], "BACSDocument");            
            done();
        }); 
    })
    it('should be able to project to get ReturnedDebitItems', function(done) {
        collection.aggregate( {$project: {_id:0,ReturnedDebitItem:'$info.BACSDocument.Data.ARUDD.Advice.OriginatingAccountRecords.OriginatingAccountRecord.ReturnedDebitItem'}} , function(err,out){
            // console.log("found: "+ JSON.stringify(out));
            assert.equal(Object.keys(out[0])[0], "ReturnedDebitItem");
            done(); 
        });
    })
    const input2 = {file:fileName2, xml:xml2};
    it('should add a new file', function(done) {
        converter.convert(input2).then((result)=>{          
            assert.equal(result, "Saved");            
            done();
        }).catch((result) => {
            assert.equal(result, "");
            done();
        });
    });
    it('should specify both files exist when we try to add again', function(done) {
        converter.convert(input).then((result)=>{          
            assert.equal(result, "");            
        }).catch((result) => {
            assert.equal(result, "Already exists");
        });
        converter.convert(input2).then((result)=>{          
            assert.equal(result, "");            
            done();
        }).catch((result) => {
            assert.equal(result, "Already exists");
            done();
        });
    });
    it('should be able to project to get ReturnedDebitItems for multiple elements', function(done) {
        collection.aggregate( aggCommand , function(err,out){
            // console.log("found: "+ JSON.stringify(out));
            assert.equal(Object.keys(out[0])[1], "ReturnedDebitItem");
            assert.equal(Object.keys(out[1])[1], "ReturnedDebitItem");                                   
            done(); 
        });
    })
    it('should run the search function successfully', function(done) {
        converter.search(NewSearchCollectionName,aggCommand).then((result)=>{
            // console.log("Search: " + result);
            assert.equal(result, "Searched All files");
            done();
        }).catch((result) => {
            assert.equal(result, "");            
            done();            
        });
    });
    it('should fill a new search result database', function(done) {
        database.collection(NewSearchCollectionName, (errCol, col) => {
            col.findOne({}, {_id:0,out:1} ,function(e,out){
                // console.log("Check search: " + JSON.stringify(out));
                assert.equal(Object.keys(out.out[0])[1], "ReturnedDebitItem"); 
                assert.equal(Object.keys(out.out[1])[1], "ReturnedDebitItem");          
                done();
            }); 
        });
    })
    it("should return the search collection created.", function(done){
        converter.getSearch(NewSearchCollectionName).then((result) => {
            assert.equal(Object.keys(result[0].out[0])[1], "ReturnedDebitItem"); 
            done();
        })
    })
});
