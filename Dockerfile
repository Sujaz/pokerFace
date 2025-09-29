# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Create volume mount point for persisted session data
VOLUME ["/app/data"]

# Run the application
CMD ["npm", "start"]
