#!/bin/bash
# EC2 Initial Setup Script
# Run this once after launching your EC2 instance

set -e

echo "=== Updating system ==="
sudo yum update -y

echo "=== Installing Node.js 20 ==="
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

echo "=== Installing PM2 ==="
sudo npm install -g pm2

echo "=== Installing Git ==="
sudo yum install -y git

echo "=== Cloning repository ==="
sudo git clone https://github.com/NwayPwint/locoverse.git /opt/locoverse
sudo chown -R $(whoami) /opt/locoverse

echo "=== Installing server dependencies ==="
cd /opt/locoverse/server
npm ci --omit=dev

echo "=== Creating .env file ==="
cat > .env << 'ENVEOF'
# Fill in your values below
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@YOUR_NEON_HOST:5432/locoverse
JWT_SECRET=GENERATE_A_STRONG_SECRET_HERE
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
GEMINI_API_KEY=your-gemini-key
RESEND_API_KEY=your-resend-key
CLIENT_URL=https://your-vercel-app.vercel.app
PORT=5000
NODE_ENV=production
ENVEOF

echo "=== Building server ==="
npm run build

echo "=== Running migrations ==="
npm run migrate

echo "=== Starting server with PM2 ==="
pm2 start dist/index.js --name locoverse
pm2 save
pm2 startup

echo "=== Setting up Nginx ==="
sudo yum install -y nginx

sudo tee /etc/nginx/conf.d/locoverse.conf > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name YOUR_DOMAIN.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

sudo systemctl enable nginx
sudo systemctl start nginx

echo "=== Installing Certbot for SSL ==="
sudo yum install -y certbot python3-certbot-nginx

echo ""
echo "=== SETUP COMPLETE ==="
echo ""
echo "Next steps:"
echo "1. Edit /opt/locoverse/server/.env with your actual secrets"
echo "2. Update /etc/nginx/conf.d/locoverse.conf with your domain"
echo "3. Run: sudo certbot --nginx -d YOUR_DOMAIN.com"
echo "4. Update your GitHub repo secrets for CI/CD"
echo ""
