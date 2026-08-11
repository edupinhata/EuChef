# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:25-jdk-jammy@sha256:f122992af75e61d87892f8a37c60f7cfa498b18748c1c9f8563da9a3b1893278 AS build
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
