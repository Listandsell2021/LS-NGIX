#!/bin/bash
set -euo pipefail

echo "Updating LS-NGIX Panel..."

INSTALL_DIR="/opt/ls-ngix"

cd "$INSTALL_DIR/panel"
git pull

su - ls-ngix -c "cd $INSTALL_DIR/panel/client && npm install && npm run build"
su - ls-ngix -c "cd $INSTALL_DIR/panel/server && npm install && npx nest build"

# Only restart the panel, NOT managed apps
su - ls-ngix -c "pm2 restart ls-ngix-panel"

echo "Update complete."
