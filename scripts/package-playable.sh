#!/bin/bash
set -e

pwd=$(pwd)

PROJECT_ROOT=$pwd

PLUGIN_ROOT="${pwd}/packages/playable-ads-adpter"

PLUGIN_DIST="${PLUGIN_ROOT}/dist"

cd $PLUGIN_DIST

echo "Package 3.x Plugin..."

npm run build -- --environment BUILD_VERSION:3x

zip -r -v -9 playable-36x.zip ./playable-ads-adapter

echo "Package 3.x Plugin Finished."

echo "Package 2.4.x Plugin..."

npm run build -- --environment BUILD_VERSION:2x

zip -r -v -9 playable-24x.zip ./playable-ads-adapter

echo "Package 2.4.x Plugin Finished."
