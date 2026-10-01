#!/bin/sh
# Adds/updates ?v=<timestamp> on local CSS/JS/icons/manifest in index.html (and icons in manifest.json)
# so browsers load the new version after a deploy instead of a cached copy.
v=$(date +%Y%m%d%H%M)
sed -i '' -E 's#(href|src)="((css|js|icons)/[^"?]+|manifest\.json)(\?v=[0-9]+)?"#\1="\2?v='"$v"'"#g' index.html
sed -i '' -E 's#"src": "(icons/[^"?]+)(\?v=[0-9]+)?"#"src": "\1?v='"$v"'"#g' manifest.json
echo "version $v"
