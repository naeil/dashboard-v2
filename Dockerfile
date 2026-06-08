FROM gradle:8.7-jdk21 AS build

WORKDIR /workspace

COPY --chown=gradle:gradle settings.gradle build.gradle ./
COPY --chown=gradle:gradle src src

RUN rm -rf src/main/resources/static \
    && gradle bootJar --no-daemon

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /workspace/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar /app/app.jar"]
