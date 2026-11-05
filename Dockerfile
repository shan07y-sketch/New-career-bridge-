FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt
COPY . .
RUN mkdir -p data
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]
