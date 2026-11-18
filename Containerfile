FROM debian:trixie-slim as build

RUN apt-get update && apt-get install --assume-yes ant git curl ca-certificates binutils

# Pinned for CVE-2026-114938 until the Temurin and Zulu docker images ship 25.0.5.1
ARG TARGETARCH
ARG ZULU=zulu25.38.201-ca-jdk25.0.5.1
RUN if [ "$TARGETARCH" = "arm64" ]; then ZARCH=aarch64; SHA=7f0c356813de315dbac44d1a2a2d61a5cab9d6ac8f2cdff6e32c994be5c02da1; \
    else ZARCH=x64; SHA=fc7a3d9396b443134666b9cf7cd946b532dc1781f5350c725849ac50d16a7198; fi && \
    curl -fsSL -o /tmp/jdk.tar.gz https://cdn.azul.com/zulu/bin/${ZULU}-linux_${ZARCH}.tar.gz && \
    echo "$SHA  /tmp/jdk.tar.gz" | sha256sum -c - && \
    mkdir /opt/jdk && tar xzf /tmp/jdk.tar.gz -C /opt/jdk --strip-components=1 && rm /tmp/jdk.tar.gz
ENV JAVA_HOME=/opt/jdk
ENV PATH="/opt/jdk/bin:${PATH}"

COPY . /opt/peergos
WORKDIR /opt/peergos

RUN ant dist && java packager/Specialise.java server/Peergos.jar linux

RUN NACL_ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "aarch64" || echo "amd64") && \
    SQLITE_ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "aarch64" || echo "x86_64") && \
    mkdir -p native-libs && \
    jar xf server/Peergos.jar \
        native-lib/linux/${NACL_ARCH}/libtweetnacl.so \
        org/sqlite/native/Linux/${SQLITE_ARCH}/libsqlitejdbc.so && \
    cp native-lib/linux/${NACL_ARCH}/libtweetnacl.so native-libs/ && \
    cp org/sqlite/native/Linux/${SQLITE_ARCH}/libsqlitejdbc.so native-libs/

# Stray dependency module-info.class files make jdeps treat the fat jar as a named module.
# jdk.naming.dns, jdk.zipfs and jdk.crypto.ec are loaded via service lookup, invisible to jdeps.
RUN mkdir /tmp/classes && cd /tmp/classes && jar xf /opt/peergos/server/Peergos.jar && \
    find . -name module-info.class -delete && \
    MODULES=$(jdeps --ignore-missing-deps --multi-release 25 --print-module-deps -R .) && \
    echo "Linking modules: $MODULES" && \
    jlink --add-modules "$MODULES,jdk.naming.dns,jdk.zipfs,jdk.crypto.ec" \
        --strip-debug --no-man-pages --no-header-files \
        --output /opt/jre && \
    rm -rf /tmp/classes


FROM debian:trixie-slim

LABEL org.opencontainers.image.title="Peergos"
LABEL org.opencontainers.image.description="Peergos is a peer-to-peer encrypted global filesystem with fine-grained access control designed to be resistant to surveillance of data content or friendship graphs"
LABEL org.opencontainers.image.source="https://github.com/Peergos/web-ui"
LABEL org.opencontainers.image.licenses="GPLv3"

ENV JAVA_HOME=/opt/jre
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV PEERGOS_PATH=/opt/peergos/data

WORKDIR /opt/peergos
RUN mkdir -p /opt/peergos/data
COPY --from=build /opt/jre /opt/jre
COPY --from=build /opt/peergos/server /opt/peergos/server
COPY --from=build /opt/peergos/native-libs /opt/peergos/native-libs
COPY docker-entrypoint.sh /opt/peergos/docker-entrypoint.sh
RUN chmod +x /opt/peergos/docker-entrypoint.sh

ENTRYPOINT ["/opt/peergos/docker-entrypoint.sh"]

EXPOSE 4001 8000
