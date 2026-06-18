import express from 'express';
import dotenv from 'dotenv';
import v1Router from "./src/api/v1/router";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

//Api versioning 
app.use('/api/v1', v1Router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


