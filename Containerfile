FROM eclipse-temurin:25-jdk as build

RUN apt-get update && apt-get install --assume-yes ant git

COPY . /opt/peergos
WORKDIR /opt/peergos

RUN ant dist

ARG TARGETARCH
RUN NACL_ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "aarch64" || echo "amd64") && \
    SQLITE_ARCH=$([ "$TARGETARCH" = "arm64" ] && echo "aarch64" || echo "x86_64") && \
    mkdir -p native-libs && \
    jar xf server/Peergos.jar \
        native-lib/linux/${NACL_ARCH}/libtweetnacl.so \
        org/sqlite/native/Linux/${SQLITE_ARCH}/libsqlitejdbc.so && \
    cp native-lib/linux/${NACL_ARCH}/libtweetnacl.so native-libs/ && \
    cp org/sqlite/native/Linux/${SQLITE_ARCH}/libsqlitejdbc.so native-libs/


FROM eclipse-temurin:25-jre

LABEL org.opencontainers.image.title="Peergos"
LABEL org.opencontainers.image.description="Peergos is a peer-to-peer encrypted global filesystem with fine-grained access control designed to be resistant to surveillance of data content or friendship graphs"
LABEL org.opencontainers.image.source="https://github.com/Peergos/web-ui"
LABEL org.opencontainers.image.licenses="GPLv3"

ENV PEERGOS_PATH=/opt/peergos/data

WORKDIR /opt/peergos
RUN mkdir -p /opt/peergos/data
COPY --from=build /opt/peergos/server /opt/peergos/server
COPY --from=build /opt/peergos/native-libs /opt/peergos/native-libs
COPY docker-entrypoint.sh /opt/peergos/docker-entrypoint.sh
RUN chmod +x /opt/peergos/docker-entrypoint.sh

ENTRYPOINT ["/opt/peergos/docker-entrypoint.sh"]

EXPOSE 4001 8000
