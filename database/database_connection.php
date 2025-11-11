<?php

$host = "localhost";
$database = "attendance-db";
$user = "root";
$password = "";

try {
    $pdo = new PDO("mysql:host=$host;dbname=$database", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}

// ALSO create a mysqli connection for scripts using $conn
$conn = mysqli_connect($host, $user, $password, $database);
if (!$conn) {
    die("MySQLi connection failed: " . mysqli_connect_error());
}
