#!/bin/bash
set -e

echo "Package 3.x Plugin..."

npm run build -- --environment BUILD_VERSION:3x

zip -v -9 ./dist/playable-36x.zip ./dist/playable-ads-adapter/*

echo "Package 3.x Plugin Finished."
