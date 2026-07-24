#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec java -Xms1G -Xmx2G --enable-native-access=ALL-UNNAMED -jar paper-1.21.1-133.jar --nogui
