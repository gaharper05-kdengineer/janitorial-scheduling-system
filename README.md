## CleanTrack scheduling app

CleanTrack is a Spring Boot weekly scheduling MVP for janitorial operations. It provides a schedule grid, shift entry, employee totals, daily coverage, a weekly hour budget, and an automatic variance calculation.

## Run locally

1. Install Java 17+ and Maven 3.9+.
2. Run `mvn spring-boot:run` from this folder.
3. Open `http://localhost:8080`.

The default profile uses an in-memory H2 database so the demo works immediately. To use MySQL, replace the datasource properties in `src/main/resources/application.properties` with your MySQL database URL, username, and password, then set `spring.jpa.hibernate.ddl-auto=update`.

## Manager login

The whole app requires a manager login. Locally it defaults to username `manager`, password `changeme123` (set in `application.properties`) — sign in at `http://localhost:8080/login.html`.

In production (Render), set the `MANAGER_USERNAME` and `MANAGER_PASSWORD` environment variables in the Render dashboard to real credentials — never commit real credentials to this file or to `application.properties`.

## Folder Structure

The workspace contains two folders by default, where:

- `src`: the folder to maintain sources
- `lib`: the folder to maintain dependencies

Meanwhile, the compiled output files will be generated in the `bin` folder by default.

> If you want to customize the folder structure, open `.vscode/settings.json` and update the related settings there.

## Dependency Management

The `JAVA PROJECTS` view allows you to manage your dependencies. More details can be found [here](https://github.com/microsoft/vscode-java-dependency#manage-dependencies).
