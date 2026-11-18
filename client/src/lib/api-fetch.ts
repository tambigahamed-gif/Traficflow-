function getTechnicalCode(response: Response, body: string): string | null {
  const headerCode = response.headers.get("x-vercel-error")?.trim();
  if (headerCode) return headerCode;
  const match = body.match(/\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/);
  return match?.[0] ?? null;
}

function getRequestId(response: Response, body: string): string | null {
  const headerId = response.headers.get("x-vercel-id")?.trim();
  if (headerId) return headerId;
  const match = body.match(/\b[a-z]{3}\d*::[A-Za-z0-9-]+/i);
  return match?.[0] ?? null;
}

export function describeNonJsonApiResponse(response: Response, body: string): string {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "type inconnu";
  const code = getTechnicalCode(response, body);
  const requestId = getRequestId(response, body);
  const excerpt = body.replace(/\s+/g, " ").trim().slice(0, 220);
  const statusLabel = response.status >= 500 ? "erreur serveur" : "réponse inattendue";
  const detail = code ? `Code technique : ${code}.` : excerpt ? `Détail : ${excerpt}.` : "Le serveur n’a pas retourné de détail.";
  const id = requestId ? ` Identifiant de requête : ${requestId}.` : "";
  const bodyDetail = code && excerpt && !excerpt.includes(code) ? ` Réponse serveur : ${excerpt}.` : "";

  return `L’API TrafficFlow renvoie une ${statusLabel} (HTTP ${response.status}, ${contentType}). ${detail}${bodyDetail}${id}`;
}

export function createApiFetch(baseFetch: typeof fetch = globalThis.fetch): typeof fetch {
  return async (input, init) => {
    let response: Response;
    try {
      response = await baseFetch(input, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Impossible de joindre l’API TrafficFlow. Vérifiez la disponibilité du serveur. Détail technique : ${detail}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/\bjson\b/i.test(contentType)) {
      const body = await response.clone().text().catch(() => "");
      throw new Error(describeNonJsonApiResponse(response, body));
    }

    return response;
  };
}
