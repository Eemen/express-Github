const express = require("express");
const mysql = require("mysql2");
const addFormats = require("ajv-formats");
const cors = require("cors");
require("dotenv").config();

const validatePersonMiddleware = require("./validatePersonMiddleware");

const app = express();
const port = process.env.PORT || 3000;

// Verbindungspool erstellen
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(cors());
app.use(express.json());

// Route für /hello mit Query-Param
app.get("/hello", (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).send("Name fehlt");

  pool.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "query"],
    (err) => {
      if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
      res.send("hallo mein query ist: " + name);
    }
  );
});

// Route für /hello/:name mit URL-Param
app.get("/hello/:name", (req, res) => {
  const name = req.params.name;

  pool.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "param"],
    (err) => {
      if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
      res.send("hallo mein Name ist auch " + name);
    }
  );
});

// Route für POST /hello/body mit JSON
app.post("/hello/body", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).send("JSON muss ein 'name'-Feld enthalten");

  pool.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "body"],
    (err) => {
      if (err) return res.status(500).send("Fehler beim Einfügen in die DB");
      res.send({ message: "Name gespeichert", name });
    }
  );
});

// GET /person
app.get("/person", (req, res) => {
  pool.query("SELECT * FROM personen", (err, results) => {
    if (err) return res.status(500).send("Fehler beim Abrufen der Personen");
    res.status(200).json(results);
  });
});

// GET /person/:id
app.get("/person/:id", (req, res) => {
  const { id } = req.params;
  pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).send("Fehler beim Abrufen der Person");
    if (result.length === 0) return res.status(404).send("Person nicht gefunden");
    res.status(200).json(result[0]);
  });
});

// PUT /person/:id
app.put("/person/:id", validatePersonMiddleware, (req, res) => {
  const { id } = req.params;
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email } = req.body;
  const query = `
    UPDATE personen
    SET vorname = ?, nachname = ?, plz = ?, strasse = ?, ort = ?, telefonnummer = ?, email = ?
    WHERE id = ?
  `;
  const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email, id];
  pool.query(query, values, (err, result) => {
    if (err) return res.status(500).send("Fehler beim Aktualisieren der Person");
    if (result.affectedRows === 0) return res.status(404).send("Person nicht gefunden");
    res.status(200).send("Person aktualisiert");
  });
});

// POST /person
app.post("/person", validatePersonMiddleware, (req, res) => {
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email } = req.body;
  const query = `
    INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email];
  pool.query(query, values, (err, result) => {
    if (err) return res.status(500).send("Fehler beim Speichern der Person");
    res.status(201).send({ message: "Person hinzugefügt", id: result.insertId });
  });
});

// DELETE /person/:id
app.delete("/person/:id", (req, res) => {
  const { id } = req.params;
  pool.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).send("Fehler beim Löschen der Person");
    if (result.affectedRows === 0) return res.status(404).send("Person nicht gefunden");
    res.status(200).send("Person gelöscht");
  });
});

app.listen(port, () => {
  console.log(`Server läuft unter http://localhost:${port}`);
});
