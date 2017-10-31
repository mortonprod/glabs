interface IDBOptions {location: string; name: string; }
interface IS3Info { bucketName: string; bucketKey: string; keyID: string; secret: string }
interface ICheck {errors: Array<{file: string; error: string}>; finalFiles: Express.Multer.File[]}