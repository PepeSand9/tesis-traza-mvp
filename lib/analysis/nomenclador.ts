import type { Nomenclador } from "./types";

/**
 * El nomenclador (~72 KB) se sirve como JSON estático desde /public/data.
 * Lo cacheamos en memoria tras la primera carga para no volver a bajarlo.
 */
let cache: Nomenclador | null = null;
let inflight: Promise<Nomenclador> | null = null;

export async function loadNomenclador(): Promise<Nomenclador> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/data/nomenclador.json", { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`Nomenclador HTTP ${r.status}`);
      return r.json() as Promise<Nomenclador>;
    })
    .then((data) => {
      cache = data;
      inflight = null;
      return data;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}
