# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:21-jdk-jammy@sha256:9d8dcf999b0bce2453e913823595a5ff2a4e8e9e5d5241b45280d0ff069818ec AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -ntp clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine@sha256:3f08b13888f595cc49edabea7250ba69499ba25602b267da591720769400e08c AS runtime
RUN apk upgrade --no-cache \
    && addgroup -S euchef \
    && adduser -S -G euchef euchef
WORKDIR /app

COPY --from=build --chown=euchef:euchef /workspace/target/*.jar /app/euchef.jar

USER euchef
EXPOSE 8081

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/urandom", "-jar", "/app/euchef.jar"]
