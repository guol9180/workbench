# 多阶段构建：Maven 编译 → JRE 运行
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# 先拷贝 POM 下载依赖，利用 Docker 层缓存加速重建
COPY pom.xml ./
COPY workbench-common/pom.xml workbench-common/
COPY workbench-framework/pom.xml workbench-framework/
COPY workbench-infrastructure/pom.xml workbench-infrastructure/
COPY workbench-module-auth/pom.xml workbench-module-auth/
COPY workbench-module-docs/pom.xml workbench-module-docs/
COPY workbench-server/pom.xml workbench-server/
RUN mvn -q -B dependency:go-offline || true

COPY . .
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /build/workbench-server/target/workbench-server.jar app.jar

ENV DOCS_ROOT=/data/docs \
    SERVER_PORT=8080

# 2核2G 服务器：容器限制 1g 时堆约 768M，为系统留出余量
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

VOLUME /data/docs
EXPOSE 8080
