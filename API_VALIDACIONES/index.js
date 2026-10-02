const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const app = express();

app.disable('x-powered-by');

require('dotenv').config();

const routes = require('./src/routes/index');

app.use(morgan('dev'));
app.use(express.json());

// Configurar CORS de forma segura restringiendo el origen
const corsOptions = {
    origin: process.env.FRONTEND_URL,
    credentials: true
};
app.use(cors(corsOptions));
app.use(routes);

app.listen(process.env.PORT_API, () => {
    console.log('Server running!');
});