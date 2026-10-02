require('dotenv').config();

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const routes = require('./src/routes/index');


// deshabilitar la cabecera que expone el framework
app.disable('x-powered-by')


app.use(morgan('dev'));
app.use(express.json());


const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true
};

app.use(cors(corsOptions)); 
app.use(routes);

app.listen(process.env.PORT_API, () => {
    console.log('Server running!');
});