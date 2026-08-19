# 多阶段构建：先构建 jar，再用轻量 JRE 镜像运行
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar

# 文档数据目录（挂载卷持久化）
ENV DOCS_ROOT=/data/docs
ENV APP_PASSWORD=workbench123
ENV SERVER_PORT=8080

RUN mkdir -p /data/docs
VOLUME /data/docs

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
