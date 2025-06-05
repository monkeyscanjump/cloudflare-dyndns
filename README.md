# Cloudflare DynDNS

[![CI](https://github.com/monkeyscanjump/cloudflare-dyndns/actions/workflows/ci.yml/badge.svg)](https://github.com/monkeyscanjump/cloudflare-dyndns/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](package.json)
[![NPM Package](https://img.shields.io/npm/v/@monkeyscanjump/cloudflare-dyndns)](https://www.npmjs.com/package/@monkeyscanjump/cloudflare-dyndns)

A robust TypeScript application that automatically updates Cloudflare DNS records when your public IP address changes. Perfect for maintaining consistent domain names for home servers, WireGuard VPN, self-hosted services, or any system with a dynamic IP address.

## Table of Contents

- Overview
- Installation
- Configuration
- Running the Application
- Command Line Options
- Troubleshooting
- Technical Details
- Development

## Overview

This package solves the problem of maintaining a consistent domain name when your ISP assigns you a dynamic IP address. It automatically detects your current public IP and updates your Cloudflare DNS records whenever changes occur.

### Key Features

- **Simple Configuration**: Requires only a Cloudflare API token and domain details
- **Auto-Discovery**: Automatically finds your zones and DNS records if not specified
- **Multiple IP Detection Services**: Uses multiple fallback services for reliability
- **Adaptive Monitoring**: Checks more frequently when IP changes are detected
- **Cross-Platform**: Works on Windows, macOS, and Linux (including ARM)
- **Production-Ready**: Includes logging, error handling, and graceful shutdown
- **Flexible Deployment**: Run as a one-time update, continuous service, or cron job

## Installation

### Method 1: Global Installation (Recommended for Personal Use)

```bash
# Install globally
npm install -g @monkeyscanjump/cloudflare-dyndns

# Run the setup wizard
cloudflare-dyndns-setup

# Start monitoring
cloudflare-dyndns --continuous
```

### Method 2: Local Installation via npm

```bash
# Create a directory for the application
mkdir cloudflare-dyndns-app && cd cloudflare-dyndns-app

# Install locally
npm install @monkeyscanjump/cloudflare-dyndns

# Run the setup wizard
npx cloudflare-dyndns-setup

# Start monitoring
npx cloudflare-dyndns --continuous
```

### Method 3: From GitHub Repository

```bash
# Clone the repository
git clone https://github.com/monkeyscanjump/cloudflare-dyndns.git
cd cloudflare-dyndns

# Install dependencies
npm install

# Build the application
npm run build

# Create and configure .env file
cp .env.example .env
# Edit .env with your details

# Start monitoring
npm start -- --continuous
```

### Method 4: Docker Installation

```bash
# Clone the repository
git clone https://github.com/monkeyscanjump/cloudflare-dyndns.git
cd cloudflare-dyndns

# Create required directories
mkdir -p config data/logs

# Create a .env file in the config directory
cat > config/.env << EOL
API_TOKEN=your_cloudflare_api_token
DOMAIN=example.com
SUBDOMAIN=home
EOL

# Build and start the container
docker-compose up -d

# View logs
docker logs -f cloudflare-dyndns
```

### Method 5: Programmatic Usage in Your Node.js Project

```javascript
const { runDynDns } = require('cloudflare-dyndns');

// One-time update with direct configuration
runDynDns({
  config: {
    API_TOKEN: 'your-api-token',
    DOMAIN: 'example.com',
    SUBDOMAIN: 'home'
  }
}).then(success => {
  console.log(success ? 'DNS updated successfully' : 'DNS update failed');
});

// Continuous monitoring
runDynDns({
  continuous: true,
  config: {
    API_TOKEN: process.env.CF_API_TOKEN,
    DOMAIN: process.env.CF_DOMAIN,
    SUBDOMAIN: process.env.CF_SUBDOMAIN
  },
  debug: true
});
```

## Configuration

The application supports multiple configuration methods in order of precedence:

1. **Command-Line Arguments** (highest priority)
2. **Environment Variables** (with or without `CLOUDFLARE_` prefix)
3. **.env File** (searched in multiple locations)
4. **Default Values** (lowest priority)

### Required Configuration Parameters

| Parameter | Description | Required? |
|-----------|-------------|-----------|
| `API_TOKEN` | Cloudflare API token | **Yes** |
| `DOMAIN` | Your domain name (e.g., `example.com`) | **Yes** |
| `SUBDOMAIN` | Subdomain to update (e.g., `home`) | **Yes** |
| `ZONE_ID` | ID of your domain zone | No (auto-detected) |
| `RECORD_ID` | ID of the DNS record to update | No (auto-detected or created) |

### Optional Configuration Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `TTL` | DNS record Time To Live in seconds | `120` |
| `PROXIED` | Whether to proxy through Cloudflare | `false` |
| `CHECK_INTERVAL` | Base interval between checks (ms) | `60000` |
| `ADAPTIVE_INTERVAL` | Use adaptive checking intervals | `true` |
| `RETRY_ATTEMPTS` | Number of API retry attempts | `3` |
| `RETRY_DELAY` | Delay between retries (ms) | `5000` |
| `IP_SERVICES` | Comma-separated list of IP services | `ipify,ifconfig,ipinfo,seeip` |
| `LOG_FILE` | Custom log file path | OS-specific default |
| `LAST_IP_FILE` | Custom path to store last IP | OS-specific default |
| `API_VERSION` | Cloudflare API version | `v4` |
| `API_URL` | Cloudflare API base URL | `https://api.cloudflare.com/client` |
| `AUTO_DETECT_API` | Enable API version auto-detection | `false` |

### Configuration Methods

#### 1. Using the Setup Wizard

The easiest way to configure the application:

```bash
cloudflare-dyndns-setup
```

This interactive wizard will guide you through the configuration process and save your settings.

#### 2. Using a .env File

Create a .env file with your configuration:

```ini
# Required configuration
API_TOKEN=your_cloudflare_api_token
DOMAIN=example.com
SUBDOMAIN=home

# Optional configuration
TTL=120
PROXIED=false
```

The application searches for .env files in these locations (in order):

1. Current working directory
2. User's home directory (.env)
3. System-wide location:
   - Windows: `C:\ProgramData\cloudflare-dyndns\.env`
   - Linux/macOS: .env

#### 3. Using Environment Variables

```bash
# Set environment variables
export API_TOKEN=your_cloudflare_api_token
export DOMAIN=example.com
export SUBDOMAIN=home

# Or with CLOUDFLARE_ prefix
export CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
export CLOUDFLARE_DOMAIN=example.com
export CLOUDFLARE_SUBDOMAIN=home

# Run the application
cloudflare-dyndns
```

#### 4. Using Command-Line Arguments

```bash
cloudflare-dyndns --api-token your_token --domain example.com --subdomain home
```

### How to Obtain Cloudflare Credentials

1. **API Token**:
   - Go to Cloudflare Dashboard → Profile → API Tokens → Create Token
   - Use the "Edit zone DNS" template
   - Select your specific zone in "Zone Resources"

2. **Zone ID** (optional - can be auto-detected):
   - Cloudflare Dashboard → Your domain → Overview (right sidebar)

3. **Record ID** (optional - can be auto-detected or created):
   - Create an A record first
   - Then in DNS tab → Edit → three dots → Copy Record ID

## Running the Application

### One-time Update

Run once and exit (useful for cron jobs or scheduled tasks):

```bash
cloudflare-dyndns
```

### Continuous Monitoring (Recommended)

Run in the background, continuously monitoring for IP changes:

```bash
cloudflare-dyndns --continuous
```

In continuous mode:

- The application checks more frequently when IP changes are detected
- It gradually increases the interval as your IP remains stable
- Maximum interval is 5 minutes by default (configurable)

### Running as a System Service

#### PM2 (Cross-platform)

```bash
# Install PM2 globally
npm install -g pm2

# Install cloudflare-dyndns
npm install -g @monkeyscanjump/cloudflare-dyndns

# Configure the application
cloudflare-dyndns-setup

# Start with PM2 using the included ecosystem.config.js
pm2 start ecosystem.config.js

# Configure to start on system boot
pm2 startup
pm2 save
```

#### systemd (Linux)

```bash
# Create systemd service file
sudo nano /etc/systemd/system/cloudflare-dyndns.service

# Add this content:
[Unit]
Description=Cloudflare DynDNS Service
After=network.target

[Service]
ExecStart=/usr/bin/cloudflare-dyndns --continuous
Restart=on-failure
User=nobody
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start the service
sudo systemctl enable cloudflare-dyndns
sudo systemctl start cloudflare-dyndns
```

#### Cron Jobs (Unix/Linux/macOS)

For periodic checks instead of continuous monitoring:

```bash
# Edit crontab
crontab -e

# Add one of these lines:
# Run every 15 minutes:
*/15 * * * * /usr/bin/cloudflare-dyndns

# Run every hour:
0 * * * * /usr/bin/cloudflare-dyndns
```

## Command Line Options

```shell
cloudflare-dyndns [options]

Options:
  -c, --continuous       Run in continuous monitoring mode
  -h, --help             Show help message
  -v, --version          Show version information
  --setup                Run the setup wizard
  --debug                Enable debug logging

Direct Configuration:
  --api-token <token>    Cloudflare API token
  --zone-id <id>         Cloudflare Zone ID
  --record-id <id>       DNS Record ID
  --domain <domain>      Domain name
  --subdomain <subdomain> Subdomain
  --ttl <seconds>        TTL in seconds (minimum 60)
  --proxied              Enable Cloudflare proxy (default: false)
```

## Troubleshooting

### Common Issues

#### "Missing required configuration"

**Cause**: Required configuration parameters are missing.
**Solution**: Run `cloudflare-dyndns-setup` or create a .env file with API_TOKEN, DOMAIN, and SUBDOMAIN.

#### "Failed to lookup zones: Request failed with status code 403"

**Cause**: API token doesn't have correct permissions or is invalid.
**Solution**: Create a new API token with "Edit zone DNS" permissions for your specific zone.

#### "No DNS A records found for subdomain.example.com"

**Cause**: The DNS record doesn't exist yet.
**Solution**: The application will automatically create it when run with the correct permissions.

#### "Failed to detect public IP"

**Cause**: All IP detection services failed.
**Solution**: Check your internet connection or add more IP services to the `IP_SERVICES` parameter.

### Debugging

Enable debug mode for detailed logging:

```bash
cloudflare-dyndns --debug
```

This will show:

- API requests and responses
- IP detection details
- Configuration processing
- Detailed error information

### Log File Locations

Logs are stored in these default locations:

- **Windows**: cloudflare_dyndns.log
- **macOS**: `/Library/Logs/cloudflare-dyndns/cloudflare_dyndns.log`
- **Linux**: `/var/log/cloudflare-dyndns/cloudflare_dyndns.log`

## Technical Details

### Architecture

The application consists of several key components:

1. **ConfigManager**: Loads and validates configuration from multiple sources
2. **CloudflareService**: Communicates with Cloudflare API to manage DNS records
3. **IpDetectionService**: Retrieves your current public IP from multiple providers
4. **IpFileManager**: Manages the storage and retrieval of the last known IP
5. **Logger**: Handles application logging with multiple severity levels
6. **DynDnsApp**: Main application class that orchestrates the entire process

### Process Flow

1. Application loads configuration from available sources
2. Validates required configuration parameters
3. Initializes the Cloudflare service and discovers missing configuration
4. Detects current public IP using multiple services with fallback
5. Compares with previously stored IP
6. If different, updates the Cloudflare DNS record
7. Saves the new IP for future comparison
8. In continuous mode, calculates next check interval based on stability

### Adaptive Interval Algorithm

In continuous mode, the application uses an adaptive algorithm to determine check frequency:

- After detecting an IP change: Checks frequently (minimum interval, default 30s)
- As IP remains stable: Gradually increases interval duration
- Maximum interval: 5 minutes (default, configurable)
- Uses a quadratic formula to ensure smooth transition between intervals

This approach minimizes API calls while ensuring timely updates when your IP changes.

### IP Detection Services

The application uses multiple IP detection services for reliability:

- ipify (`https://api.ipify.org`)
- ifconfig (`https://ifconfig.me`)
- ipinfo (`https://ipinfo.io`)
- seeip (`https://api.seeip.org`)
- ipapi (`https://ipapi.co`) - fallback
- myip (`https://api.myip.com`) - fallback

You can customize which services to use with the `IP_SERVICES` configuration parameter.

## Development

If you want to contribute or modify the code:

```bash
# Clone the repository
git clone https://github.com/monkeyscanjump/cloudflare-dyndns.git
cd cloudflare-dyndns

# Install dependencies
npm install

# Set up development environment
npm run dev:setup

# Run in development mode with continuous monitoring
npm run dev:run

# Or use the combined command for setup and run
npm run dev
```

### Project Structure

```shell
cloudflare-dyndns/
├── src/                # Source code
│   ├── app/            # Main application classes
│   ├── config/         # Configuration handling
│   ├── services/       # Service implementations
│   ├── utils/          # Utility functions
│   ├── scripts/        # Command-line scripts
│   ├── types.ts        # TypeScript interfaces
│   └── index.ts        # Application entry point
├── scripts/            # Build and setup scripts
├── dist/               # Compiled JavaScript (generated)
├── .env.example        # Example configuration
├── ecosystem.config.js # PM2 configuration
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
└── package.json        # Project metadata and scripts
```

### Building the Project

```bash
# Build the TypeScript code
npm run build

# Run linting
npm run lint

# Test the application
npm run test
```

### Docker Development

```bash
# Build the Docker image
docker build -t cloudflare-dyndns .

# Run with interactive output
docker run -it --rm \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  cloudflare-dyndns
```

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Cloudflare API](https://api.cloudflare.com/) for DNS management
- Multiple public IP detection services that make this tool reliable
- Node.js and TypeScript communities for excellent tools and libraries
