# Glab

The app will convert XML files to JSON and store this to a mongodb. 
The app uses xml2js to convert the XML. This is relatively agnostic about the format of the xml.
Therefore any information stored as xml can be transformed.


The app allows the output json to formatted before storing which allows you to easily extend the app without having to rewrite code again and again.


The XML files can be from an s3 bucket or saved locally on the server.
*At the moment it only automatically uses a local store but access to s3 is provided.*


The app manages the xml files to ensure we have a complete list of all files from all sources. 
It also keeps a record of the files processed so we don't lose track of what files need attention.

The conversion is viewed through a UI rendered by jade(pug). 
*A submit form has not been added but the backend API route has been added.*

## Building

The app is built with typescript so to transpile you will need to run 

```
npm run build
```

which will create a dist folder. The ./dist/server.js file is the entry point of the app.


## Deployment with docker

The app had been deployed through a digital ocean droplet with the database on a docker volume.
Check out the website. 

If you want to run the docker droplet build: 

```
npm run build:docker
```

then run with:


```
npm run start:docker
```

## Deployment without docker

If you want to run this on your local machine you will need to have mongodb installed and then run

```
npm run start:db
```

to start the database. You can then start your app after building it:

```
npm run start
```


## Test

**Note when you run the tests the databases will reset by removing all the old collections**

**At the moment the keys for the s3 store are needed so only the author(me) can run the tests.**

Need to start your local version of mongodb. When this is done run: 

```
npm run start:db
```

```
npm run tests
```

The tests only cover the converter and xmlManager since they are the most complicated parts of the app.

## Components

### Converter 

This class exposes the functions needed to convert the xml files to json. 
It also deals with storing the output to mongodb. 
Furthermore, it will also search the database for projection to store in a separate database.
This is done using mongo's aggregate function. 
It simple takes a command and the collection name it should give the output.

### XML Manager

Since the app should work with remote and local files it needs to keep a store of

* What files we have
* Where they are
* Have they been processed

It also need to update on certain events

* Had a new file been uploaded
* Have more files been added to s3. 

### Server

The server is the entry point of the app and provides API points to:

* Upload Files
* Specify s3 directory has been modified
* Serve UI.

It will also initialise everything needed to run the app.


