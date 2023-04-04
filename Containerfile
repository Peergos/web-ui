FROM eclipse-temurin:17-jdk as build

RUN apt-get update && apt-get install --assume-yes ant git

COPY . /opt/peergos
WORKDIR /opt/peergos

RUN ant dist


FROM eclipse-temurin:17-jre

ENV PEERGOS_PATH=/opt/peergos/data

WORKDIR /opt/peergos
RUN mkdir -p /opt/peergos/data
COPY --from=build /opt/peergos/server /opt/peergos/server

ENTRYPOINT ["java", "-jar", "/opt/peergos/server/Peergos.jar"]

EXPOSE 4001 8000
