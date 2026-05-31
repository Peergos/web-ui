#!/bin/sh
exec java --enable-native-access=ALL-UNNAMED \
    -jar /opt/peergos/server/Peergos.jar \
    "$@" \
    --native-tweetnacl-path /opt/peergos/native-libs/libtweetnacl.so \
    --native-sqlite-path /opt/peergos/native-libs/libsqlitejdbc.so
