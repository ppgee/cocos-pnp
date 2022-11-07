#!/bin/bash
set -e

PROJECT_NAME="cocos-taobao-adapter"

PLUGIN_ROOT="packages/$PROJECT_NAME"

PLUGIN_NAME="taobao-builder"

PLUGIN_DIST="./$PLUGIN_NAME/dist"

cd $PLUGIN_ROOT

echo "Packaging build-templates"

zip -r -v -9 build-templates.zip ./build-templates

echo "Packaged build-templates"

cd $PLUGIN_NAME

echo "Remove build folder"

rm -rf dist

echo "Remove finished."

echo "Package taobao-builder"

pnpm build

cd dist

zip -r -v -9 taobao-builder.zip ./taobao-builder

echo "Package taobao-builder finished."
