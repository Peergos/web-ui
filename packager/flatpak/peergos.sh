#!/bin/sh
export flatpak=true
java --enable-native-access=ALL-UNNAMED -jar /app/share/peergos/Peergos.jar "$@"
