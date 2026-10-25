/**
 * Mesin rumus mini ala Excel untuk KPI (aman, TANPA eval()).
 *
 * Variabel yang tersedia:
 *   I1, I2, ... In  → nilai kolom ISIAN ke-n pada baris indikator (urut dari atas)
 *   T               → NILAI 100% (TARGET)
 *   B               → BOBOT (selalu positif)
 *
 * Operator : + - * / ^ %  ( )  dan perbandingan  < > <= >= = <>
 * Fungsi   : SUM, AVG, MIN, MAX, ABS, ROUND(x;n), IF(kondisi;benar;salah)
 * Pemisah argumen boleh "," atau ";" (gaya Excel Indonesia). Simbol × dan ÷ juga diterima.
 *
 * Hasil rumus = CAPAIAN dalam persen (0–100). Contoh: I1/I2*100  atau  SUM(I1;I2)/T*100
 */

class FormulaError extends Error {}
class MissingInputError extends Error {}

const FUNCTION_ARITY = { SUM: [1, Infinity], AVG: [1, Infinity], MIN: [1, Infinity], MAX: [1, Infinity], ABS: [1, 1], ROUND: [1, 2], IF: [2, 3] };

export const FORMULA_FUNCTIONS = Object.keys(FUNCTION_ARITY);

/* ───────────── Tokenizer ───────────── */
function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9.]/.test(source[j])) j += 1;
      const text = source.slice(i, j);
      const value = Number(text);
      if (!Number.isFinite(value)) throw new FormulaError(`Angka tidak valid "${text}"`);
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j += 1;
      tokens.push({ type: 'id', value: source.slice(i, j).toUpperCase() });
      i = j;
      continue;
    }

    const pair = source.slice(i, i + 2);
    if (['<=', '>=', '<>', '!='].includes(pair)) {
      tokens.push({ type: 'op', value: pair === '!=' ? '<>' : pair });
      i += 2;
      continue;
    }

    const alias = { '×': '*', '÷': '/', ';': ',' };
    if ('+-*/^(),;<>=%×÷'.includes(ch)) {
      tokens.push({ type: 'op', value: alias[ch] || ch });
      i += 1;
      continue;
    }
    throw new FormulaError(`Karakter tidak dikenal "${ch}"`);
  }
  return tokens;
}

/* ───────────── Parser (recursive descent) ───────────── */
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value) => peek()?.type === 'op' && peek().value === value;
  const expect = (value) => {
    if (!isOp(value)) throw new FormulaError(`Diharapkan "${value}"`);
    pos += 1;
  };

  const parseComparison = () => {
    let left = parseAdditive();
    while (['<', '>', '<=', '>=', '=', '<>'].some(isOp)) {
      const op = tokens[pos++].value;
      left = { t: 'bin', op, l: left, r: parseAdditive() };
    }
    return left;
  };
  const parseAdditive = () => {
    let left = parseTerm();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].value;
      left = { t: 'bin', op, l: left, r: parseTerm() };
    }
    return left;
  };
  const parseTerm = () => {
    let left = parseUnary();
    while (isOp('*') || isOp('/')) {
      const op = tokens[pos++].value;
      left = { t: 'bin', op, l: left, r: parseUnary() };
    }
    return left;
  };
  const parseUnary = () => {
    if (isOp('-')) { pos += 1; return { t: 'neg', e: parseUnary() }; }
    if (isOp('+')) { pos += 1; return parseUnary(); }
    return parsePower();
  };
  const parsePower = () => {
    const base = parsePostfix();
    if (isOp('^')) { pos += 1; return { t: 'bin', op: '^', l: base, r: parseUnary() }; }
    return base;
  };
  const parsePostfix = () => {
    let node = parsePrimary();
    while (isOp('%')) { pos += 1; node = { t: 'pct', e: node }; }
    return node;
  };
  const parsePrimary = () => {
    const token = peek();
    if (!token) throw new FormulaError('Rumus berakhir terlalu cepat');
    if (token.type === 'num') { pos += 1; return { t: 'num', v: token.value }; }
    if (token.type === 'id') {
      pos += 1;
      if (isOp('(')) {
        if (!FUNCTION_ARITY[token.value]) throw new FormulaError(`Fungsi "${token.value}" tidak dikenal`);
        pos += 1;
        const args = [];
        if (!isOp(')')) {
          args.push(parseComparison());
          while (isOp(',')) { pos += 1; args.push(parseComparison()); }
        }
        expect(')');
        const [min, max] = FUNCTION_ARITY[token.value];
        if (args.length < min || args.length > max) throw new FormulaError(`Jumlah argumen ${token.value} tidak sesuai`);
        return { t: 'call', name: token.value, args };
      }
      return { t: 'var', name: token.value };
    }
    if (isOp('(')) {
      pos += 1;
      const inner = parseComparison();
      expect(')');
      return inner;
    }
    throw new FormulaError(`Simbol "${token.value}" tidak di tempat yang benar`);
  };

  const ast = parseComparison();
  if (pos < tokens.length) throw new FormulaError(`Sisa rumus tidak terbaca mulai "${tokens[pos].value}"`);
  return ast;
}

/* ───────────── Kompilasi + cache ───────────── */
const cache = new Map();

function collectVars(node, set = new Set()) {
  if (!node) return set;
  if (node.t === 'var') set.add(node.name);
  if (node.l) collectVars(node.l, set);
  if (node.r) collectVars(node.r, set);
  if (node.e) collectVars(node.e, set);
  (node.args || []).forEach((arg) => collectVars(arg, set));
  return set;
}

export function compileFormula(source) {
  const key = String(source ?? '').trim();
  if (cache.has(key)) return cache.get(key);
  let result;
  try {
    if (!key) throw new FormulaError('Rumus masih kosong');
    const ast = parse(tokenize(key));
    result = { ast, vars: collectVars(ast), error: null };
  } catch (error) {
    result = { ast: null, vars: new Set(), error: error.message };
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  return result;
}

/* ───────────── Evaluasi ───────────── */
function evaluate(node, scope) {
  switch (node.t) {
    case 'num': return node.v;
    case 'var': {
      const value = scope(node.name);
      if (value === undefined) throw new FormulaError(`Variabel "${node.name}" tidak dikenal`);
      if (value === null) throw new MissingInputError(node.name);
      return value;
    }
    case 'neg': return -evaluate(node.e, scope);
    case 'pct': return evaluate(node.e, scope) / 100;
    case 'call': {
      if (node.name === 'IF') {
        // IF dievaluasi malas: hanya cabang terpilih yang dihitung.
        const condition = evaluate(node.args[0], scope);
        if (condition) return evaluate(node.args[1], scope);
        return node.args[2] ? evaluate(node.args[2], scope) : 0;
      }
      const args = node.args.map((arg) => evaluate(arg, scope));
      switch (node.name) {
        case 'SUM': return args.reduce((sum, value) => sum + value, 0);
        case 'AVG': return args.reduce((sum, value) => sum + value, 0) / args.length;
        case 'MIN': return Math.min(...args);
        case 'MAX': return Math.max(...args);
        case 'ABS': return Math.abs(args[0]);
        case 'ROUND': { const factor = 10 ** (args[1] ?? 0); return Math.round(args[0] * factor) / factor; }
        default: throw new FormulaError(`Fungsi "${node.name}" tidak dikenal`);
      }
    }
    case 'bin': {
      const l = evaluate(node.l, scope);
      const r = evaluate(node.r, scope);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': if (r === 0) throw new MissingInputError('pembagi nol'); return l / r;
        case '^': return l ** r;
        case '<': return l < r ? 1 : 0;
        case '>': return l > r ? 1 : 0;
        case '<=': return l <= r ? 1 : 0;
        case '>=': return l >= r ? 1 : 0;
        case '=': return l === r ? 1 : 0;
        case '<>': return l !== r ? 1 : 0;
        default: throw new FormulaError(`Operator "${node.op}" tidak dikenal`);
      }
    }
    default: throw new FormulaError('Rumus tidak valid');
  }
}

const buildScope = ({ inputs = [], target = 0, bobot = 0, cells = null }) => (name) => {
  if (cells && Object.prototype.hasOwnProperty.call(cells, name)) {
    return cells[name];
  }
  if (name === 'T') return Number(target) || 0;
  if (name === 'B') return Math.abs(Number(bobot) || 0);
  const match = /^I(\d+)$/.exec(name);
  if (match) {
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= inputs.length) return undefined;
    return inputs[index] ?? null;
  }
  return undefined;
};

/**
 * Hitung rumus. Mengembalikan { value, error }.
 * value = null tanpa error berarti isian belum lengkap (bukan kesalahan rumus).
 */
export function evaluateKpiFormula(source, context = {}) {
  const clean = String(source ?? '').trim().replace(/^=\s*/, '');
  const compiled = compileFormula(clean);
  if (compiled.error) return { value: null, error: compiled.error };
  try {
    const value = evaluate(compiled.ast, buildScope(context));
    return Number.isFinite(value) ? { value, error: null } : { value: null, error: null };
  } catch (error) {
    if (error instanceof MissingInputError) return { value: null, error: null };
    return { value: null, error: error.message };
  }
}

/** Validasi rumus terhadap jumlah isian pada baris dan referensi sel global (dipakai desainer PRP). */
export function validateKpiFormula(source, inputCount, allowedGlobalRefs = null) {
  const clean = String(source ?? '').trim().replace(/^=\s*/, '');
  const compiled = compileFormula(clean);
  if (compiled.error) return compiled.error;
  for (const name of compiled.vars) {
    if (name === 'T' || name === 'B') continue;
    if (allowedGlobalRefs && allowedGlobalRefs.has(name)) continue;
    const match = /^I(\d+)$/.exec(name);
    if (!match) {
      if (allowedGlobalRefs) {
        return `Referensi "${name}" tidak ditemukan di tabel.`;
      }
      return `Variabel "${name}" tidak dikenal. Gunakan I1..I${inputCount}, T, B, atau klik sel di tabel.`;
    }
    const index = Number(match[1]);
    if (index < 1 || index > inputCount) return `${name} tidak ada: baris ini hanya punya ${inputCount} isian.`;
  }
  return null;
}

/** Ubah I1, I2, T, B, dan kode sel menjadi label manusiawi untuk ditampilkan ke user. */
export function describeKpiFormula(source, subrows = [], cellLabels = null) {
  let text = String(source || '').replace(/^=\s*/, '');
  if (cellLabels) {
    text = text.replace(/\b([A-Z0-9_]+)\b/gi, (token) => {
      const upper = token.toUpperCase();
      return cellLabels[upper] ? `[${cellLabels[upper]}]` : token;
    });
  }
  return text
    .replace(/\bI(\d+)\b/gi, (_, n) => `[${subrows[Number(n) - 1]?.label || `Isian ${n}`}]`)
    .replace(/\bT\b/g, '[Target]')
    .replace(/\bB\b/g, '[Bobot]')
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ');
}
