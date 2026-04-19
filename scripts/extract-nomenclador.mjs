// Extrae TRAZA_NOMENCLADOR_FULL y TRAZA_PROC_KEYWORDS del HTML legacy
// y los serializa a /public/data/nomenclador.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const HTML_PATH = resolve("legacy/prototype.html");
const OUT_PATH = resolve("public/data/nomenclador.json");

const html = readFileSync(HTML_PATH, "utf8");

function extractAssignment(source, varName) {
  const marker = `window.${varName} = `;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`No se encontró ${varName} en el HTML`);
  const after = start + marker.length;
  // Avanzar hasta el ';' que cierra la asignación en ese mismo nivel
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escape = false;
  for (let i = after; i < source.length; i++) {
    const c = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === ";" && depth === 0) {
      return source.slice(after, i);
    }
  }
  throw new Error(`No se cerró la asignación de ${varName}`);
}

const codesRaw = extractAssignment(html, "TRAZA_NOMENCLADOR_FULL");
const keywordsRaw = extractAssignment(html, "TRAZA_PROC_KEYWORDS");

const codes = JSON.parse(codesRaw);
const keywords = JSON.parse(keywordsRaw);

const payload = { codes, keywords };
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(payload));

console.log(
  `[extract-nomenclador] OK — ${Object.keys(codes).length} códigos · ${keywords.length} entradas de keywords · ${(JSON.stringify(payload).length / 1024).toFixed(1)} KB`,
);
