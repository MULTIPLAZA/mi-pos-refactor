// ── Configuración centralizada ──
// Un solo lugar para credenciales y helpers de Supabase.
// Todos los HTML importan este archivo en vez de declarar sus propias constantes.

const SUPA_URL  = 'https://kmreiniqgcvqgdtzvmel.supabase.co';
const SUPA_ANON = 'sb_publishable_j6btNHo1o3tSprmYUJITPw_8AsYgcvJ';

const SUPA_HEADERS = {
  'apikey':        SUPA_ANON,
  'Authorization': 'Bearer ' + SUPA_ANON,
};

function supaHeaders(extra) {
  return Object.assign({}, SUPA_HEADERS, extra || {});
}
