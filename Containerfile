FROM eclipse-temurin:17-jdk as build

RUN apt-get update && apt-get install --assume-yes ant git

COPY . /opt/peergos
WORKDIR /opt/peergos

RUN ant dist


FROM eclipse-temurin:17-jre

LABEL org.opencontainers.image.title="Peergos"
LABEL org.opencontainers.image.description="Peergos is a peer-to-peer encrypted global filesystem with fine-grained access control designed to be resistant to surveillance of data content or friendship graphs"
LABEL org.opencontainers.image.source="https://github.com/Peergos/web-ui"
LABEL org.opencontainers.image.licenses="GPLv3"

ENV PEERGOS_PATH=/opt/peergos/data

WORKDIR /opt/peergos
RUN mkdir -p /opt/peergos/data
COPY --from=build /opt/peergos/server /opt/peergos/server

ENTRYPOINT ["java", "-jar", "/opt/peergos/server/Peergos.jar"]

EXPOSE 4001 8000
