FROM node:20-alpine

WORKDIR /app

RUN npm init -y && npm install express mysql2 cors multer csv-parser json2csv

COPY index.js .
# COPY data.json .

EXPOSE 3000

CMD ["node", "index.js"]