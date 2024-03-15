const db = require('./db');

console.log(db.initialize.toString());

db.initialize({ uri: 'mongodb://localhost:27017' }).then(() => {
    console.log('Connected to db');
    db.connect().then(() => {
        console.log('test connect');
        process.exit(0);
    }).catch((err) => {
        console.log("err test connect");
        process.exit(1);
    });
    
}).catch((err) => {
    console.log("cannot connect to db");
    process.exit(1);
});