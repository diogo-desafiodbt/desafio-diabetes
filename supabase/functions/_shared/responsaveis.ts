/** Mapa nome (como gravado em acoes.responsavel) → e-mail. */

const ENTRIES: Record<string, string> = {
  diogo: "diogo@desafiodiabetes.com",
  turí: "turionline@gmail.com",
  turi: "turionline@gmail.com",
  pedro: "suporte@desafiodiabetes.com",
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Devolve o e-mail ou null se não houver correspondência. */
export function emailForResponsavel(responsavel: string | null | undefined): string | null {
  if (!responsavel || typeof responsavel !== "string") return null;
  const key = normalize(responsavel);
  if (!key) return null;
  return ENTRIES[key] ?? null;
}
