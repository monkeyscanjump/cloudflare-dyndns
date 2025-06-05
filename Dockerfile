FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Build TypeScript
RUN npm run build

# Set executable permissions for scripts
RUN chmod +x dist/index.js dist/scripts/setup.js

# Create volume mounts
VOLUME ["/app/config", "/app/data"]

# Set environment variables
ENV NODE_ENV=production
ENV LOG_FILE=/app/data/logs/cloudflare_dyndns.log
ENV LAST_IP_FILE=/app/data/last_ip.txt

# Run the application
CMD ["node", "dist/index.js", "--continuous"]
