const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');

// Datenbankverbindung
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Token Validierung Middleware
const validateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Kein Token vorhanden" });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Ungültiger Token" });
    }
    req.user = user;
    next();
  });
};

// Token Generierung
router.get('/generate-token', (req, res) => {
  const { vorname, id, password } = req.query;

  if (!vorname || !id || !password) {
    return res.status(400).json({ message: "Vorname, ID und Passwort sind erforderlich" });
  }

  pool.query(
    "SELECT * FROM personen WHERE id = ? AND vorname = ? AND password = ?",
    [id, vorname, password],
    (err, results) => {
      if (err) {
        return res.status(500).json({ message: "Datenbankfehler" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Person nicht gefunden oder falsches Passwort" });
      }

      const token = jwt.sign(
        { 
          id: results[0].id,
          vorname: results[0].vorname,
          nachname: results[0].nachname
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '1h' }
      );

      res.json({ 
        token,
        expiresIn: '1h',
        message: "Token erfolgreich generiert"
      });
    }
  );
});

// Alle Benutzer abrufen
router.get('/', validateToken, (req, res) => {
  pool.query("SELECT * FROM personen", (err, results) => {
    if (err) return res.status(500).send("Fehler beim Abrufen der Personen");
    res.status(200).json(results);
  });
});

// Einen bestimmten Benutzer abrufen
router.get('/:id', validateToken, (req, res) => {
  const { id } = req.params;
  pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).send("Fehler beim Abrufen der Person");
    if (result.length === 0) return res.status(404).send("Person nicht gefunden");
    res.status(200).json(result[0]);
  });
});

// Neuen Benutzer erstellen
router.post('/', validateToken, (req, res) => {
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email, password } = req.body;
  const query = `
    INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email, password];
  pool.query(query, values, (err, result) => {
    if (err) return res.status(500).send("Fehler beim Speichern der Person");
    res.status(201).send({ message: "Person hinzugefügt", id: result.insertId });
  });
});

// Benutzer aktualisieren
router.put('/:id', validateToken, (req, res) => {
  const { id } = req.params;
  const { vorname, nachname, plz, strasse, ort, telefonnummer, email, password } = req.body;
  const query = `
    UPDATE personen
    SET vorname = ?, nachname = ?, plz = ?, strasse = ?, ort = ?, telefonnummer = ?, email = ?, password = ?
    WHERE id = ?
  `;
  const values = [vorname, nachname, plz, strasse, ort, telefonnummer, email, password, id];
  pool.query(query, values, (err, result) => {
    if (err) return res.status(500).send("Fehler beim Aktualisieren der Person");
    if (result.affectedRows === 0) return res.status(404).send("Person nicht gefunden");
    res.status(200).send("Person aktualisiert");
  });
});

// Benutzer löschen
router.delete('/:id', validateToken, (req, res) => {
  const { id } = req.params;
  pool.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).send("Fehler beim Löschen der Person");
    if (result.affectedRows === 0) return res.status(404).send("Person nicht gefunden");
    res.status(200).send("Person gelöscht");
  });
});

module.exports = router; 