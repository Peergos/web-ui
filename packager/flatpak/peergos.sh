#!/bin/sh
export flatpak=true
export LC_ALL=C.UTF-8
java --enable-native-access=ALL-UNNAMED -jar /app/share/peergos/Peergos.jar "$@"
