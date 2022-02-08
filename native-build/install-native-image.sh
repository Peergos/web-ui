#!/bin/bash

#
# to build a native-image graalvm-ce is required
# and then native-image is installed in a separate step
# note: make sure the graalvm version is up to date
#
#
VERSION=22.0.0.2
OS=linux-amd64
curl -L -O https://github.com/graalvm/graalvm-ce-builds/releases/download/vm-$VERSION/graalvm-ce-java11-$OS-$VERSION.tar.gz
tar -zxvf graalvm-ce-java11-${OS}-${VERSION}.tar.gz
./graalvm-ce-java11-${VERSION}/bin/gu install native-image

if [ -f  "graalvm-ce-java11-${VERSION}/bin/native-image" ];
then
    echo "native-image installed @ "$(readlink -f graalvm-ce-java11-${VERSION}/bin/native-image)
    export NATIVE_IMAGE_BIN=$(readlink -f graalvm-ce-java11-${VERSION}/bin/native-image)
else
    echo "native-image not installed..."
fi
