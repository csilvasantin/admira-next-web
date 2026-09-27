/*
 * DeepAgents como editores del Generador (Carlos, 27-09-2026 · «Todos los deepagents
 * tienen que poder ser editores, arréglalo»).
 *
 * Neo, Morfeo, Trinity, Oráculo, Smith y el Arquitecto no tienen la cookie de Google de
 * una persona: trabajan con su token MCP `anmcp_…` (/usuarios → Tokens MCP). Hasta hoy ese
 * token sólo servía a través de /mcp, que no tiene todas las acciones (p. ej. la biblioteca
 * multimedia), y una llamada directa a /presentaciones/api/* contestaba 401.
 *
 * Aquí el mismo token, enviado como `Authorization: Bearer anmcp_…`, se convierte en una
 * sesión de directorio con EXACTAMENTE las reglas de /mcp:
 *   - el token existe y no está revocado (se guarda sólo su hash);
 *   - su usuario está activo, tiene el proyecto del generador y un rol;
 *   - sólo los niveles owner/editor cuentan como sesión (viewer no edita nada).
 * No hay lista nueva de correos ni secretos nuevos: dar de baja o revocar desde /usuarios
 * corta al agente en la siguiente petición. Un Bearer no lo adjunta el navegador por su
 * cuenta, así que no abre ninguna vía CSRF.
 */

import { bearerOf, tokenRow } from '../mcp/_tokens.js';
import { generatorAccess } from './_directory.js';

export const AGENT_TOKEN_PREFIX = 'anmcp_';
const AGENT_LEVELS = new Set(['owner', 'editor']);

export async function agentSessionFromRequest(env, request, waitUntil){
  const token = bearerOf(request);
  if (!token || !token.startsWith(AGENT_TOKEN_PREFIX) || token.length > 200) return null;
  let row = null;
  try { row = await tokenRow(env, token, waitUntil); } catch (_) { row = null; }
  if (!row) return null;
  let access = null;
  try { access = await generatorAccess(env, { email: row.email }); } catch (_) { access = null; }
  if (!access || !AGENT_LEVELS.has(access.level)) return null;
  return { level: access.level, email: access.email, name: access.name, tokenId: String(row.id || ''), tokenLabel: String(row.label || ''), source: 'agent-token' };
}
