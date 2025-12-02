#!/bin/bash
#
# Production Mode Switch Script
# =============================
# This script switches the application from development mode to production mode by:
#   1. Setting DEBUG to false in app-config.js
#   2. Changing default network from 'AMOY' to 'POLYGON_MAINNET' in network-indicator-selector.js
#
# Usage:
# ------
# 1. Make the script executable (one-time setup):
#    chmod +x switch-to-production.sh
#
# 2. Run the script:
#    ./switch-to-production.sh
#
# To reverse (switch back to development mode):
#    ./switch-to-development.sh (if you create the reverse script)
#
# Requirements:
# - This script must be run from the project root directory
# - The files js/config/app-config.js and js/components/network-indicator-selector.js must exist
#

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Switching to production mode...${NC}"

# Check if we're in the right directory
if [ ! -f "js/config/app-config.js" ] || [ ! -f "js/components/network-indicator-selector.js" ]; then
    echo -e "${RED}Error: Required files not found.${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Backup files (optional - uncomment if you want backups)
# cp js/config/app-config.js js/config/app-config.js.backup
# cp js/components/network-indicator-selector.js js/components/network-indicator-selector.js.backup

# Update DEBUG flag in app-config.js
if sed -i "s/DEBUG: true/DEBUG: false/" js/config/app-config.js; then
    echo -e "${GREEN}✓${NC} DEBUG set to false in app-config.js"
else
    echo -e "${RED}✗${NC} Failed to update DEBUG flag"
    exit 1
fi

# Update default network in network-indicator-selector.js
if sed -i "s/defaultNetwork = 'AMOY'/defaultNetwork = 'POLYGON_MAINNET'/" js/components/network-indicator-selector.js; then
    echo -e "${GREEN}✓${NC} Default network set to POLYGON_MAINNET in network-indicator-selector.js"
else
    echo -e "${RED}✗${NC} Failed to update default network"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Production mode enabled successfully!${NC}"
echo ""
echo "Changes made:"
echo "  - DEBUG: false (app-config.js)"
echo "  - defaultNetwork: 'POLYGON_MAINNET' (network-indicator-selector.js)"
echo ""
echo -e "${YELLOW}Note: You may need to rebuild/restart your application for changes to take effect.${NC}"

