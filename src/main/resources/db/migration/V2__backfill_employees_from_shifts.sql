INSERT INTO employees (name)
SELECT DISTINCT s.employee_name
FROM shifts s
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.name = s.employee_name
);
