// Prisma en mémoire pour la vérification consommateur-par-consommateur (P0-2).
//
// L'enjeu : prouver qu'un lien ARCHIVÉ disparaît de CHAQUE consommateur aval.
// Un mock par consommateur ne prouverait rien — il renverrait ce qu'on lui a
// dit de renvoyer. Ici, chaque consommateur tourne INCHANGÉ ; c'est SA propre
// clause `where` qui est évaluée contre un jeu de lignes en mémoire. Si un
// consommateur oublie `visibility: 'public'`, il voit le lien archivé et le
// test tombe — exactement comme en base.
//
// LIMITE ASSUMÉE : l'évaluateur couvre les opérateurs réellement utilisés par
// ces consommateurs (égalité, not, in, equals/mode, contains, gt, OR, relation
// `kol`). Un opérateur non couvert lève, il ne renvoie jamais « pas de
// filtre » silencieusement.

export type Row = Record<string, unknown>;

export class UnsupportedOperatorError extends Error {
  constructor(op: string) {
    super(`Évaluateur where : opérateur non couvert -> ${op}`);
    this.name = "UnsupportedOperatorError";
  }
}

function lower(v: unknown): unknown {
  return typeof v === "string" ? v.toLowerCase() : v;
}

function matchScalar(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (typeof cond !== "object") return value === cond;

  const c = cond as Record<string, unknown>;
  const insensitive = c.mode === "insensitive";
  const norm = (x: unknown) => (insensitive ? lower(x) : x);

  for (const key of Object.keys(c)) {
    if (key === "mode") continue;
    switch (key) {
      case "equals":
        if (norm(value) !== norm(c.equals)) return false;
        break;
      case "not":
        if (c.not === null) {
          if (value === null || value === undefined) return false;
        } else if (typeof c.not === "object") {
          if (matchScalar(value, c.not)) return false;
        } else if (norm(value) === norm(c.not)) return false;
        break;
      case "in":
        if (!(c.in as unknown[]).map(norm).includes(norm(value))) return false;
        break;
      case "notIn":
        if ((c.notIn as unknown[]).map(norm).includes(norm(value))) return false;
        break;
      case "contains":
        if (typeof value !== "string") return false;
        if (!String(norm(value)).includes(String(norm(c.contains)))) return false;
        break;
      case "gt":
        if (!(Number(value) > Number(c.gt))) return false;
        break;
      case "gte":
        if (!(Number(value) >= Number(c.gte))) return false;
        break;
      case "lt":
        if (!(Number(value) < Number(c.lt))) return false;
        break;
      default:
        throw new UnsupportedOperatorError(key);
    }
  }
  return true;
}

export interface RelationResolver {
  /** Nom de la clé relation -> (row) => la ligne liée, ou null. */
  [relationKey: string]: (row: Row) => Row | null;
}

export function matchWhere(row: Row, where: unknown, relations: RelationResolver = {}): boolean {
  if (!where || typeof where !== "object") return true;
  const w = where as Record<string, unknown>;

  for (const [key, cond] of Object.entries(w)) {
    if (cond === undefined) continue;

    if (key === "OR") {
      if (!(cond as unknown[]).some((sub) => matchWhere(row, sub, relations))) return false;
      continue;
    }
    if (key === "AND") {
      if (!(cond as unknown[]).every((sub) => matchWhere(row, sub, relations))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchWhere(row, cond, relations)) return false;
      continue;
    }
    if (key in relations) {
      const related = relations[key](row);
      if (related === null) return false;
      if (!matchWhere(related, cond, relations)) return false;
      continue;
    }
    if (!matchScalar(row[key], cond)) return false;
  }
  return true;
}

interface ModelOptions {
  relations?: RelationResolver;
  /** Calcule les `_count` demandés dans un `select`. */
  counts?: (row: Row) => Record<string, number>;
}

function applySelect(
  row: Row,
  select: Record<string, unknown> | undefined,
  counts?: (r: Row) => Record<string, number>,
): Row {
  if (!select) return { ...row };
  const out: Row = {};
  for (const [key, val] of Object.entries(select)) {
    if (val === false || val === undefined) continue;
    if (key === "_count") {
      const all = counts ? counts(row) : {};
      const asked = (val as { select?: Record<string, boolean> }).select;
      out._count = asked
        ? Object.fromEntries(Object.keys(asked).map((k) => [k, all[k] ?? 0]))
        : all;
      continue;
    }
    out[key] = row[key];
  }
  return out;
}

function applyOrderBy(rows: Row[], orderBy: unknown): Row[] {
  if (!orderBy || typeof orderBy !== "object") return rows;
  const entries = Object.entries(orderBy as Record<string, string>);
  if (entries.length === 0) return rows;
  const [field, dir] = entries[0];
  return rows.slice().sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    const cmp = av > bv ? 1 : -1;
    return dir === "desc" ? -cmp : cmp;
  });
}

export function makeModel(rows: Row[], opts: ModelOptions = {}) {
  const relations = opts.relations ?? {};
  const pick = (args: { where?: unknown }) => rows.filter((r) => matchWhere(r, args?.where, relations));

  return {
    rows,
    async findMany(
      args: {
        where?: unknown;
        select?: Record<string, unknown>;
        orderBy?: unknown;
        distinct?: string[];
        take?: number;
        skip?: number;
      } = {},
    ) {
      let out = pick(args);
      out = applyOrderBy(out, args.orderBy);
      if (args.distinct) {
        const seen = new Set<string>();
        out = out.filter((r) => {
          const key = args.distinct!.map((d) => String(r[d])).join(" ");
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      if (typeof args.skip === "number") out = out.slice(args.skip);
      if (typeof args.take === "number") out = out.slice(0, args.take);
      return out.map((r) => applySelect(r, args.select, opts.counts));
    },
    async findFirst(args: { where?: unknown; select?: Record<string, unknown> } = {}) {
      const hit = pick(args)[0];
      return hit ? applySelect(hit, args.select, opts.counts) : null;
    },
    async count(args: { where?: unknown } = {}) {
      return pick(args).length;
    },
    async aggregate(args: { where?: unknown; _sum?: Record<string, boolean> } = {}) {
      const hits = pick(args);
      const sums: Record<string, number | null> = {};
      for (const field of Object.keys(args._sum ?? {})) {
        const vals = hits.map((r) => r[field]).filter((v) => typeof v === "number") as number[];
        sums[field] = vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
      }
      return { _sum: sums };
    },
    async groupBy(args: {
      by: string[];
      where?: unknown;
      _count?: unknown;
      _max?: Record<string, boolean>;
    }) {
      const hits = pick(args);
      const groups = new Map<string, Row[]>();
      for (const r of hits) {
        const key = args.by.map((b) => String(r[b])).join(" ");
        const list = groups.get(key) ?? [];
        list.push(r);
        groups.set(key, list);
      }
      return Array.from(groups.values()).map((list) => {
        const out: Row = {};
        for (const b of args.by) out[b] = list[0][b];
        if (args._count) out._count = { id: list.length };
        if (args._max) {
          out._max = Object.fromEntries(
            Object.keys(args._max).map((f) => [f, list.map((r) => r[f]).sort().slice(-1)[0] ?? null]),
          );
        }
        return out;
      });
    },
  };
}
