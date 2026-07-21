# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -ntp dependency:go-offline

COPY src/ src/
RUN ./mvnw -B -ntp clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine AS runtime
RUN apk upgrade --no-cache \
    && addgroup -S euchef \
    && adduser -S -G euchef euchef
WORKDIR /app

COPY --from=build --chown=euchef:euchef /workspace/target/*.jar /app/euchef.jar

USER euchef
EXPOSE 8081

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/urandom", "-jar", "/app/euchef.jar"]
