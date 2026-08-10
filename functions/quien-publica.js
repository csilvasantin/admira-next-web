// quien-publica — de un commit, QUIÉN lo hizo de verdad.
//
// Por qué existe. El historial del Webmaster mostraba `commit.author.name`, que
// es el `git config user.name` de la máquina donde se hizo el commit. En la
// flota eso casi nunca es el agente: en el MacBookPro14 pone «csilvasantin» y
// en otras «Carlos Silva», así que el 10 de agosto de 2026 —la mañana en que
// Carlos se encontró Yokup publicado cinco veces de madrugada— el historial
// atribuía a Carlos, dormido, dos de los cambios. Una columna de responsable
// que nombra a quien no fue es peor que no tener columna: manda a preguntar a
// la persona equivocada.
//
// De dónde se saca el nombre bueno, por orden de fiabilidad:
//   1. El pie `Agente: X · Máquina` del cuerpo del commit, si está.
//   2. La firma de los commits de sellado: «chore(release): … · Agente · Máquina».
//      La escribe deploy.sh con quien publica, no se teclea ni se hereda.
//   3. Un prefijo de agente conocido en el propio autor de git (SubOraculoMini,
//      InfraOraculoMini, NeoMBP14…): esos SÍ están bien configurados.
//   4. Si no hay ninguna de las tres, no se inventa: «sin identificar».

const AGENTE_CONOCIDO = /^(Sub|Infra)?(Neo|Morfeo|Trinity|Oraculo|Oráculo|Smith|Niobe|Cypher)[A-Za-z0-9]*$/;

// Los nombres de persona y los usuarios de máquina NO son agentes. Se listan
// aparte porque son justo los que producían la atribución falsa.
const NO_ES_AGENTE = new Set(['csilvasantin', 'carlos silva', 'carlos', 'root', 'admira', 'github-actions[bot]', 'unknown']);

export function agenteDelPie(cuerpo = '') {
  const m = String(cuerpo).match(/^\s*Agente:\s*([^\n·]+?)\s*(?:·\s*(.+?))?\s*$/mi);
  if (!m) return null;
  const agente = m[1].trim();
  return agente ? { agente, maquina: (m[2] || '').trim() || '', via: 'pie' } : null;
}

export function agenteDelSello(asunto = '') {
  const texto = String(asunto);
  if (!/^(chore\(release\)|sellar\b)/i.test(texto.trim())) return null;
  // «chore(release): sellar yokup-rtc v.10.08.2026.r5.08:05 · SubMorfeoMacMini · MacMini»
  const partes = texto.split('·').map((p) => p.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  const agente = partes[partes.length - 2];
  const maquina = partes[partes.length - 1];
  if (!AGENTE_CONOCIDO.test(agente)) return null;
  return { agente, maquina, via: 'sello' };
}

export function quienPublica({ autorGit = '', asunto = '', cuerpo = '' } = {}) {
  const pie = agenteDelPie(cuerpo);
  if (pie) return { ...pie, fiable: true };

  const sello = agenteDelSello(asunto);
  if (sello) return { ...sello, fiable: true };

  const autor = String(autorGit).trim();
  if (autor && AGENTE_CONOCIDO.test(autor) && !NO_ES_AGENTE.has(autor.toLowerCase())) {
    return { agente: autor, maquina: '', via: 'git', fiable: true };
  }

  // Se conserva el nombre de git como pista, pero marcado: no se presenta como
  // el responsable. Quien lea la tabla tiene que poder distinguir «fue este
  // agente» de «esto salió de esta cuenta y no sabemos quién iba dentro».
  return { agente: '', maquina: '', via: 'sin-identificar', fiable: false, cuenta: autor };
}

// Etiqueta corta para la columna. Nunca devuelve un nombre de persona a secas.
export function etiquetaResponsable(info) {
  if (!info || !info.fiable) {
    return info?.cuenta ? `sin identificar (${info.cuenta})` : 'sin identificar';
  }
  return info.maquina ? `${info.agente} · ${info.maquina}` : info.agente;
}
