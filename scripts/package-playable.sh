#!/bin/bash
set -e

cd "$(dirname ${0})"

cd ".."

echo "$(ls)"

cd "./packages/playable-ads-adpter"

echo "$(ls)"

echo "Package 3.x Plugin..."

npm run build -- --environment BUILD_VERSION:3x

cd "./dist"

zip -r -v -9 playable-36x.zip ./playable-ads-adapter

echo "Package 3.x Plugin Finished."

cd ".."

echo "Package 2.4.x Plugin..."

npm run build -- --environment BUILD_VERSION:2x

cd "./dist"

zip -r -v -9 playable-24x.zip ./playable-ads-adapter

echo "Package 2.4.x Plugin Finished."
