# CleanTrack Scheduling App

CleanTrack is a Spring Boot weekly scheduling MVP for janitorial operations. It provides a schedule grid, shift entry, employee totals, daily coverage, a weekly hour budget, and automatic variance calculations.

## Project Overview

CleanTrack is a Spring Boot weekly scheduling MVP for janitorial operations. It provides a schedule grid, shift entry, employee totals, daily coverage, a weekly hour budget, and automatic variance calculations.

## Problem

Janitorial employee scheduling can become difficult when schedules are managed manually or through spreadsheets.

Managers need a centralized way to organize shifts, track employee hours, monitor daily coverage, and compare scheduled hours against weekly labor-hour budgets.

CleanTrack was developed to simplify this process through a web-based scheduling system.

## Main Features

- Weekly employee schedule grid
- Employee shift entry
- Automatic employee hour totals
- Daily staffing coverage
- Weekly hour budget tracking
- Automatic variance calculations
- Manager login
- Persistent database support

## Technologies Used

### Backend

- Java
- Spring Boot
- Spring Data JPA

### Frontend

- HTML
- CSS

### Database

- H2 for local demonstration
- PostgreSQL for production deployment

### Development and Deployment

- Visual Studio Code
- Maven
- Git
- GitHub
- Docker
- Render

## Application Architecture

## Application Architecture

CleanTrack follows a layered Spring Boot architecture.

![CleanTrack Architecture](docs/architecture/cleantrack-architecture.png)

## Run Locally

1. Install Java 17+ and Maven 3.9+.
2. Run `mvn spring-boot:run` from the project folder.
3. Open `http://localhost:8080`.

The default profile uses an in-memory H2 database so the demo works immediately.

For production, CleanTrack uses PostgreSQL. Database connection settings are supplied through environment variables rather than hard-coded credentials in `application.properties`.

Example:

```properties
spring.datasource.url=${DATABASE_URL}
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=update
```

## Manager Login

The application requires a manager login.

For local development, the demo credentials are:

```text
Username: manager
Password: changeme123
```

The local login page is:

```text
http://localhost:8080/login.html
```

These credentials are for local development only.

In production on Render, manager credentials are supplied through environment variables:

```text
MANAGER_USERNAME
MANAGER_PASSWORD
```

Real production credentials should never be committed to GitHub or stored directly in `application.properties`.

## Project Structure

```text
CleanTrack/
|
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/...
│   │   │       ├── controller/
│   │   │       ├── service/
│   │   │       ├── repository/
│   │   │       ├── model/
│   │   │       └── App.java
│   │   │
│   │   └── resources/
│   │       ├── static/
│   │       ├── templates/
│   │       ├── application.properties
│   │       └── data.sql
│   │
│   └── test/
│       └── java/
│
├── .gitignore
├── Dockerfile
├── pom.xml
└── README.md
```

## Database

CleanTrack uses H2 for local development and PostgreSQL for the production deployment on Render.

The database stores application information related to:

- Employees
- Employee roles
- Shifts
- Weekly schedules
- Scheduled hours
- Daily staffing coverage
- Weekly labor-hour budgets

Spring Data JPA provides the persistence layer between the Spring Boot application and the database.

## Security

Sensitive information is supplied through environment variables instead of being committed directly to the repository.

Examples include:

```text
DATABASE_URL
DB_USERNAME
DB_PASSWORD
MANAGER_USERNAME
MANAGER_PASSWORD
```

Database passwords and production manager credentials should never be committed to GitHub.

## Deployment

CleanTrack is containerized using Docker and deployed as a web service on Render.

The production architecture is:

```text
User Browser
     |
     v
Render Web Service
     |
     v
Spring Boot
     |
     v
Spring Data JPA
     |
     v
Render PostgreSQL
```

## Future Improvements

Future versions of CleanTrack may include:

- Multiple manager accounts
- Employee accounts
- Role-based access control
- Employee availability
- Schedule requests
- Email notifications
- Payroll integration
- Reporting and analytics
- Mobile-responsive improvements
- Multiple janitorial locations

## Author

Grant Harper

Software Engineering Portfolio Project
