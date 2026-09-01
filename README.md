## CleanTrack scheduling app

CleanTrack is a Spring Boot weekly scheduling MVP for janitorial operations. It provides a schedule grid, shift entry, employee totals, daily coverage, a weekly hour budget, and an automatic variance calculation.

## Run locally

1. Install Java 17+ and Maven 3.9+.
2. Run `mvn spring-boot:run` from this folder.
3. Open `http://localhost:8080`.

The default profile uses an in-memory H2 database so the demo works immediately. To use MySQL, replace the datasource properties in `src/main/resources/application.properties` with your MySQL database URL, username, and password, then set `spring.jpa.hibernate.ddl-auto=update`.

## Folder Structure

The workspace contains two folders by default, where:

- `src`: the folder to maintain sources
- `lib`: the folder to maintain dependencies

Meanwhile, the compiled output files will be generated in the `bin` folder by default.

> If you want to customize the folder structure, open `.vscode/settings.json` and update the related settings there.

## Dependency Management

The `JAVA PROJECTS` view allows you to manage your dependencies. More details can be found [here](https://github.com/microsoft/vscode-java-dependency#manage-dependencies).
