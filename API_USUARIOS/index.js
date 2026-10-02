require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const app = express();
const routes = require('./src/routes/index');
const cors = require('cors');


app.disable('x-powered-by');

app.use(morgan('dev'));
app.use(express.json());
app.use(cors({ 
  origin: process.env.FRONTEND_URL, 
  credentials: true 
}));
app.use(routes);

app.listen(process.env.PORT_API, () => {
    console.log('Server running!');
});
