const mongoose = require('mongoose'); // load the library

async function connectDB(){ //async because connecting to a remote DB takes time  
    // try-catch: if connection fails, log and kill the process (no point running a DB app without a DB) 
    try{
        await mongoose.connect(process.env.MONGODB_URI); //actually connects, blocks until done, reads the env var dotenv loaded
        console.log("Connected to MongoDB"); 
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    }
}

module.exports = connectDB; //export the function so index.js can use it