#!/bin/sh
# Adds/updates ?v=<timestamp> on local CSS/JS in index.html so browsers load the new version after a deploy.
v=$(date +%Y%m%d%H%M)
sed -i '' -E 's#(href|src)="(css|js)/([^"?]+)(\?v=[0-9]+)?"#\1="\2/\3?v='"$v"'"#g' index.html
echo "version $v"
