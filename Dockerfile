FROM node:22
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# next start honours the PORT env var — keep it in sync with the compose port.
ENV PORT=9103
EXPOSE 9103
CMD ["npm", "start"]
