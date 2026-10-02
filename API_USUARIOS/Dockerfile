FROM node:18-alpine

# Especificar el directorio de trabajo
WORKDIR /usr/app

# Copiar los archivos definiendo al usuario 'node' como propietario
COPY --chown=node:node ./package*.json ./

# Instalar dependencias (asumiendo que ya cambiaste a npm ci según el paso anterior)
RUN npm ci --ignore-scripts

# Copiar el resto de los archivos con los permisos correctos
# Reemplazar 
#COPY --chown=node:node ./ ./ 
#COPY --chown=node:node .env .env
COPY --chown=node:node ./index.js ./
COPY --chown=node:node ./src ./src

# Cambiar al usuario sin privilegios ANTES de ejecutar la aplicación
USER node

# Comando por defecto
CMD ["npm","start"]