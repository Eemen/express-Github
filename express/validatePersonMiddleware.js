const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const jwt = require("jsonwebtoken");

const ajv = new Ajv();
addFormats(ajv);

const personSchema = {
  type: "object",
  properties: {
    vorname: { type: "string" },
    nachname: { type: "string" },
    plz: { type: "string" },
    strasse: { type: "string" },
    ort: { type: "string" },
    telefonnummer: { type: "string" },
    email: { type: "string", format: "email" },
  },
  required: ["vorname", "nachname", "email"],
  additionalProperties: false,
};

const validatePerson = ajv.compile(personSchema);

function validatePersonMiddleware(req, res, next) {
  const valid = validatePerson(req.body);
  if (!valid) {
    return res.status(400).json({
      error: "Ungültiges JSON-Format",
      details: validatePerson.errors,
    });
  }
  next();
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

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

module.exports = { validatePersonMiddleware, authenticateToken }; 