# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:25-jdk-jammy@sha256:0348e7b24ad4479cf35927b750671bb4b78465c303003b08536f6f2fa6f180cd AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -ntp clean package -DskipTests

FROM eclipse-temurin:25-jre-alpine@sha256:28db6fdf60e38945e43d840c0333aeaec66c15943070104f7586fd3c9d1665b0 AS runtime
RUN apk upgrade --no-cache \
    && addgroup -S euchef \
    && adduser -S -G euchef euchef
WORKDIR /app

COPY --from=build --chown=euchef:euchef /workspace/target/*.jar /app/euchef.jar

USER euchef
EXPOSE 8081

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/urandom", "-jar", "/app/euchef.jar"]
