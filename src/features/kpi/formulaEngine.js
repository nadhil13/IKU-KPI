/**
 * Mesin rumus ala Excel untuk evaluasi KPI (tanpa eval()).
 * Mendukung koordinat sel Excel (E3, F3, G3), rentang sel (E3:E8, I1:I6),
 * variabel baris lokal (I1..In, T, B), serta referensi lintas baris (A1A_I1, A1A_T, A1A_B).
 */

class FormulaError extends Error {}
class MissingInputError extends Error {}

const FUNCTION_ARITY = { SUM: [1, Infinity], AVG: [1, Infinity], MIN: [1, Infinity], MAX: [1, Infinity], ABS: [1, 1], ROUND: [1, 2], IF: [2, 3] };
const RANGE_FUNCTIONS = new Set(['SUM', 'AVG', 'MIN', 'MAX']);

export const FORMULA_FUNCTIONS = Object.keys(FUNCTION_ARITY);

export function expandCellRangeTokens(startName, endName) {
  const a = String(startName || '').trim().toUpperCase();
  const b = String(endName || '').trim().toUpperCase();
  const excelMatchA = /^([A-Z]{1,2})(\d+)$/.exec(a);
  const excelMatchB = /^([A-Z]{1,2})(\d+)$/.exec(b);
  if (excelMatchA && excelMatchB && excelMatchA[1] === excelMatchB[1]) {
    const col = excelMatchA[1];
    const r1 = Number(excelMatchA[2]);
    const r2 = Number(excelMatchB[2]);
    if (r1 <= 0 || r2 <= 0 || Math.abs(r2 - r1) > 250) {
      throw new FormulaError(`Rentang "${a}:${b}" tidak valid`);
    }
    const lo = Math.min(r1, r2);
    const hi = Math.max(r1, r2);
    const out = [];
    for (let r = lo; r <= hi; r += 1) out.push(`${col}${r}`);
    return out;
  }

  const localMatchA = /^([A-Z0-9_]*_)?I(\d+)$/.exec(a);
  const localMatchB = /^([A-Z0-9_]*_)?I(\d+)$/.exec(b);
  if (localMatchA && localMatchB && (localMatchA[1] || '') === (localMatchB[1] || '')) {
    const prefix = localMatchA[1] || '';
    const i1 = Number(localMatchA[2]);
    const i2 = Number(localMatchB[2]);
    if (i1 <= 0 || i2 <= 0 || Math.abs(i2 - i1) > 100) {
      throw new FormulaError(`Rentang "${a}:${b}" tidak valid`);
    }
    const lo = Math.min(i1, i2);
    const hi = Math.max(i1, i2);
    const out = [];
    for (let idx = lo; idx <= hi; idx += 1) out.push(`${prefix}I${idx}`);
    return out;
  }

  throw new FormulaError(`Rentang "${a}:${b}" harus berada pada kolom Excel yang sama (mis. E3:E8 atau I1:I6)`);
}

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
    if ('+-*/^(),;:<>=%×÷'.includes(ch)) {
      tokens.push({ type: 'op', value: alias[ch] || ch });
      i += 1;
      continue;
    }
    throw new FormulaError(`Karakter tidak dikenal "${ch}"`);
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value) => peek()?.type === 'op' && peek().value === value;
  const expect = (value) => {
    if (!isOp(value)) throw new FormulaError(`Diharapkan "${value}"`);
    pos += 1;
  };

  const parseArgOrRange = (allowRange) => {
    if (
      allowRange
      && peek()?.type === 'id'
      && tokens[pos + 1]?.type === 'op'
      && tokens[pos + 1]?.value === ':'
      && tokens[pos + 2]?.type === 'id'
    ) {
      const startId = tokens[pos].value;
      const endId = tokens[pos + 2].value;
      pos += 3;
      const cells = expandCellRangeTokens(startId, endId);
      return { t: 'range', start: startId, end: endId, cells };
    }
    return parseComparison();
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
      if (isOp(':')) {
        throw new FormulaError('Rentang sel (mis. E3:E8) hanya dapat dipakai di dalam SUM, AVG, MIN, atau MAX');
      }
      if (isOp('(')) {
        if (!FUNCTION_ARITY[token.value]) throw new FormulaError(`Fungsi "${token.value}" tidak dikenal`);
        const allowRange = RANGE_FUNCTIONS.has(token.value);
        pos += 1;
        const args = [];
        if (!isOp(')')) {
          args.push(parseArgOrRange(allowRange));
          while (isOp(',')) { pos += 1; args.push(parseArgOrRange(allowRange)); }
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

const cache = new Map();

function collectVars(node, set = new Set()) {
  if (!node) return set;
  if (node.t === 'var') set.add(node.name);
  if (node.t === 'range') (node.cells || []).forEach((cell) => set.add(cell));
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
        const condition = evaluate(node.args[0], scope);
        if (condition) return evaluate(node.args[1], scope);
        return node.args[2] ? evaluate(node.args[2], scope) : 0;
      }
      if (RANGE_FUNCTIONS.has(node.name)) {
        const values = [];
        let sawRange = false;
        for (const arg of node.args) {
          if (arg.t === 'range') {
            sawRange = true;
            for (const cellName of arg.cells) {
              const cellVal = scope(cellName);
              if (cellVal === undefined) throw new FormulaError(`Sel "${cellName}" pada rentang ${arg.start}:${arg.end} tidak ditemukan`);
              if (cellVal !== null) values.push(cellVal);
            }
          } else {
            values.push(evaluate(arg, scope));
          }
        }
        if (values.length === 0) {
          if (sawRange) throw new MissingInputError('rentang kosong');
          return 0;
        }
        switch (node.name) {
          case 'SUM': return values.reduce((sum, value) => sum + value, 0);
          case 'AVG': return values.reduce((sum, value) => sum + value, 0) / values.length;
          case 'MIN': return Math.min(...values);
          case 'MAX': return Math.max(...values);
          default: break;
        }
      }
      const args = node.args.map((arg) => evaluate(arg, scope));
      switch (node.name) {
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

export function evaluateKpiFormula(source, context = {}) {
  const clean = String(source ?? '').trim().replace(/^=\s*/, '');
  const compiled = compileFormula(clean);
  if (compiled.error) return { value: null, error: compiled.error };
  try {
    const value = evaluate(compiled.ast, buildScope(context));
    return Number.isFinite(value) ? { value, error: null } : { value, error: null };
  } catch (error) {
    if (error instanceof MissingInputError) return { value: null, error: null };
    return { value: null, error: error.message };
  }
}

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
        return `Referensi sel "${name}" tidak ditemukan di tabel.`;
      }
      return `Variabel "${name}" tidak dikenal. Gunakan koordinat Excel (mis. E3, G3), I1..I${inputCount}, T, atau B.`;
    }
    const index = Number(match[1]);
    if (index < 1 || index > inputCount) return `${name} tidak ada: baris ini hanya punya ${inputCount} isian.`;
  }
  return null;
}

export function describeKpiFormula(source, subrows = [], cellLabels = null) {
  const clean = String(source || '').replace(/^=\s*/, '');
  const replaced = clean.replace(/\b([A-Za-z][A-Za-z0-9_]*)\b/g, (token) => {
    const upper = token.toUpperCase();
    if (FUNCTION_ARITY[upper]) return upper;
    if (cellLabels && cellLabels[upper]) return `[${cellLabels[upper]}]`;
    const iMatch = /^I(\d+)$/.exec(upper);
    if (iMatch) {
      const idx = Number(iMatch[1]);
      return `[${subrows[idx - 1]?.label || `Isian ${idx}`}]`;
    }
    if (upper === 'T') return '[Target]';
    if (upper === 'B') return '[Bobot]';
    return token;
  });
  return replaced
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ');
}
