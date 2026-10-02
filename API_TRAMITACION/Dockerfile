FROM node:22-alpine

# Especificar el directorio de trabajo
WORKDIR /usr/app

# Copiar los archivos definiendo al usuario 'node' como propietario
COPY --chown=node:node ./package*.json ./

# Instalar dependencias
RUN npm ci --ignore-scripts

# Copiar el resto de los archivos con los permisos correctos
COPY --chown=node:node ./index.js ./
COPY --chown=node:node ./src ./src
COPY --chown=node:node ./scoring ./scoring

# Cambiar al usuario sin privilegios antes de ejecutar la aplicación
USER node

# Comando por defecto
CMD ["npm", "start"]