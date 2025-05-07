const Ajv = require("ajv");
const addFormats = require("ajv-formats");

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

module.exports = validatePersonMiddleware; 