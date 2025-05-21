const express = require("express");
const mysql = require("mysql2");
const addFormats = require("ajv-formats");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const { validatePersonMiddleware } = require("./validatePersonMiddleware");

const app = express();
const port = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;

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
  if (!name) return res.status(400).json({ error: "Name fehlt" });

  pool.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "query"],
    (err) => {
      if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Name bereits vorhanden" });
      if (err) return res.status(400).json({ error: "Fehler beim Einfügen in die DB" });
      res.status(201).json({ message: "hallo mein query ist: " + name });
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
      if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Name bereits vorhanden" });
      if (err) return res.status(400).json({ error: "Fehler beim Einfügen in die DB" });
      res.status(201).json({ message: "hallo mein Name ist auch " + name });
    }
  );
});

// Route für POST /hello/body mit JSON
app.post("/hello/body", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "JSON muss ein 'name'-Feld enthalten" });

  pool.query(
    "INSERT INTO greetings (name, source) VALUES (?, ?)",
    [name, "body"],
    (err) => {
      if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Name bereits vorhanden" });
      if (err) return res.status(400).json({ error: "Fehler beim Einfügen in die DB" });
      res.status(201).json({ message: "Name gespeichert", name });
    }
  );
});

// Token Validierung Middleware
const validateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Kein Token vorhanden" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Ungültiger Token" });
    }
    req.user = user;
    next();
  });
};

// Login Route
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  pool.query(
    "SELECT * FROM users WHERE username = ? AND is_active = true",
    [username],
    (err, results) => {
      if (err) {
        return res.status(400).json({ message: "Datenbankfehler" });
      }

      if (results.length === 0) {
        return res.status(401).json({ message: "Ungültige Anmeldedaten" });
      }

      const user = results[0];

      // In einer echten Anwendung sollten Sie das Passwort mit bcrypt vergleichen!
      if (user.password !== password) {
        return res.status(401).json({ message: "Ungültige Anmeldedaten" });
      }

      // Update last_login
      pool.query(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
        [user.id]
      );

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });
    }
  );
});

// Registrierungs-Route
app.post("/register", (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({
      message: "Benutzername, Passwort und E-Mail sind erforderlich",
    });
  }

  // In einer echten Anwendung sollten Sie das Passwort mit bcrypt hashen!
  pool.query(
    "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
    [username, password, email],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            message: "Benutzername oder E-Mail bereits vergeben",
          });
        }
        return res.status(400).json({ message: "Fehler bei der Registrierung" });
      }
      res.status(201).json({
        message: "Benutzer erfolgreich registriert",
        userId: result.insertId,
      });
    }
  );
});

// Token Generierung basierend auf Vorname, ID und Passwort
app.get("/generate-token", (req, res) => {
  const { vorname, id, password } = req.query;

  if (!vorname || !id || !password) {
    return res.status(400).json({ message: "Vorname, ID und Passwort sind erforderlich" });
  }

  pool.query(
    "SELECT * FROM personen WHERE id = ? AND vorname = ? AND password = ?",
    [id, vorname, password],
    (err, results) => {
      if (err) {
        return res.status(400).json({ message: "Datenbankfehler" });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: "Person nicht gefunden oder falsches Passwort" });
      }

      const token = jwt.sign(
        {
          id: results[0].id,
          vorname: results[0].vorname,
          nachname: results[0].nachname,
        },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({
        token,
        expiresIn: "1h",
        message: "Token erfolgreich generiert",
      });
    }
  );
});

// Hilfsfunktion zur ID-Prüfung
function isValidId(id) {
  return /^\d+$/.test(id);
}

// Geschützte Routen
app.get("/person", validateToken, (req, res) => {
  pool.query("SELECT * FROM personen", (err, results) => {
    if (err) return res.status(400).json({ error: "Fehler beim Abrufen der Personen" });
    res.status(200).json(results);
  });
});

app.get("/person/:id", validateToken, (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: "Ungültige ID. Es muss eine Zahl sein." });
  }
  pool.query("SELECT * FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: "Fehler beim Abrufen der Person" });
    if (result.length === 0)
      return res.status(404).json({ error: "Person nicht gefunden" });
    res.status(200).json(result[0]);
  });
});

app.put("/person/:id", validateToken, (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: "Ungültige ID. Es muss eine Zahl sein." });
  }
  const allowedFields = [
    "vorname",
    "nachname",
    "plz",
    "strasse",
    "ort",
    "telefonnummer",
    "email",
    "password"
  ];
  const fields = [];
  const values = [];
  for (const key of allowedFields) {
    if (req.body[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (fields.length === 0) {
    return res.status(400).json({ error: "Keine Felder zum Aktualisieren angegeben" });
  }
  const query = `UPDATE personen SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);
  pool.query(query, values, (err, result) => {
    if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "E-Mail oder Telefonnummer bereits vergeben" });
    if (err) return res.status(400).json({ error: "Fehler beim Aktualisieren der Person" });
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Person nicht gefunden" });
    pool.query("SELECT * FROM personen WHERE id = ?", [id], (err2, rows) => {
      if (err2) return res.status(400).json({ error: "Fehler beim Abrufen der aktualisierten Person" });
      res.status(200).json(rows[0]);
    });
  });
});

app.post("/person", validateToken, (req, res) => {
  const {
    vorname,
    nachname,
    plz,
    strasse,
    ort,
    telefonnummer,
    email,
    password,
  } = req.body;
  const query = `
    INSERT INTO personen (vorname, nachname, plz, strasse, ort, telefonnummer, email, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    vorname,
    nachname,
    plz,
    strasse,
    ort,
    telefonnummer,
    email,
    password,
  ];
  pool.query(query, values, (err, result) => {
    if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "E-Mail oder Telefonnummer bereits vergeben" });
    if (err) return res.status(400).json({ error: "Fehler beim Speichern der Person" });
    pool.query("SELECT * FROM personen WHERE id = ?", [result.insertId], (err2, rows) => {
      if (err2) return res.status(400).json({ error: "Fehler beim Abrufen der neuen Person" });
      res.status(201).json(rows[0]);
    });
  });
});

app.delete("/person/:id", validateToken, (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ error: "Ungültige ID. Es muss eine Zahl sein." });
  }
  pool.query("DELETE FROM personen WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: "Fehler beim Löschen der Person" });
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Person nicht gefunden" });
    res.status(200).json({ message: "Person gelöscht" });
  });
});

// GET /auth-code/:userId
app.get("/auth-code/:userId", validateToken, (req, res) => {
  const { userId } = req.params;
  if (!isValidId(userId)) {
    return res.status(400).json({ error: "Ungültige UserID. Es muss eine Zahl sein." });
  }
  if (req.user.id !== parseInt(userId)) {
    return res.status(403).json({ message: "Nicht autorisiert" });
  }
  const authCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 3600000);
  pool.query(
    "INSERT INTO auth_codes (user_id, code, expires_at) VALUES (?, ?, ?)",
    [userId, authCode, expiresAt],
    (err) => {
      if (err && err.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Code bereits vergeben" });
      if (err) {
        return res.status(400).json({ message: "Fehler beim Speichern des Auth-Codes" });
      }
      res.json({
        authCode,
        expiresAt,
        message: "Auth-Code erfolgreich generiert",
      });
    }
  );
});

app.listen(port, () => {
  console.log(`Server läuft unter http://localhost:${port}`);
});
