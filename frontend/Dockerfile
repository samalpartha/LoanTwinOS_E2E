FROM node:20-alpine
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy application code
COPY . .

# Build the application using npx
RUN npx next build

# Expose port (Cloud Run sets PORT env var)
ENV PORT=8080
EXPOSE 8080

# Start the application using npx and the PORT env var
CMD npx next start -p $PORT
