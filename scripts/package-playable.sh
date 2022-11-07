#!/bin/bash
set -e

PLUGIN_NAME="playable-ads-adapter"

PLUGIN_ROOT="packages/$PLUGIN_NAME"

PLUGIN_DIST="./dist"

cd $PLUGIN_ROOT

echo "Packaging the plugin of 3.x..."

pnpm build --environment BUILD_VERSION:3x

cd $PLUGIN_DIST

zip -r -v -9 playable-36x.zip ./playable-ads-adapter

echo "Packaged the plugin of 3.x finished."

echo "Remove build folder of 3.x..."

rm -rf "$PLUGIN_NAME"

echo "Remove finished."

cd ..

echo "Package the plugin of 2.4.x..."

pnpm build --environment BUILD_VERSION:2x

cd $PLUGIN_DIST

zip -r -v -9 playable-24x.zip ./playable-ads-adapter

echo "Package the plugin of 2.4.x finished."
