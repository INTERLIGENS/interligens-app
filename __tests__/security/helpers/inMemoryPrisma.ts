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
//
// A4 (balayage IDOR) réutilise ce magasin et lui ajoute ce qui lui manquait :
// `findUnique`, `include`, les mutations, et un JOURNAL D'ÉCRITURES. La raison
// est la même que ci-dessus — un mock par route ne prouverait rien. Ici les
// handlers d'`/api/investigators/*` tournent INCHANGÉS, avec leurs vrais
// helpers d'autorisation, et c'est leur propre clause `where` qui décide.
// Ce qui est ajouté est ADDITIF : `select` conserve exactement son
// comportement, `include` sans argument ne change rien.

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
  /**
   * Nom de la clé relation -> (row) => la ligne liée, ou null.
   *
   * A4 : un résolveur peut aussi rendre un TABLEAU. La clause est alors
   * interprétée comme une relation to-many (`some` / `none` / `every`), la
   * forme qu'emploient `readBy: { none: … }` et `participants: { some: … }`.
   * Rendre `Row | null` reste le comportement d'origine, inchangé.
   */
  [relationKey: string]: (row: Row) => Row | Row[] | null;
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
      if (Array.isArray(related)) {
        const c = (cond ?? {}) as Record<string, unknown>;
        const ops = Object.keys(c);
        for (const op of ops) {
          if (op === "some") {
            if (!related.some((r) => matchWhere(r, c.some, relations))) return false;
          } else if (op === "none") {
            if (related.some((r) => matchWhere(r, c.none, relations))) return false;
          } else if (op === "every") {
            if (!related.every((r) => matchWhere(r, c.every, relations))) return false;
          } else {
            throw new UnsupportedOperatorError(`${key} -> ${op}`);
          }
        }
        continue;
      }
      if (related === null) return false;
      if (!matchWhere(related, cond, relations)) return false;
      continue;
    }
    if (!matchScalar(row[key], cond)) return false;
  }
  return true;
}

/** Charge une relation demandée par `include`. `args` = la sous-clause. */
export interface RelationLoader {
  [relationKey: string]: (row: Row, args: unknown) => unknown;
}

/**
 * Journal d'écritures — A4.
 *
 * La moitié lecture d'un balayage IDOR se lit dans le statut HTTP. La moitié
 * ÉCRITURE ne s'y lit pas : une route peut rendre 200 en n'écrivant rien, ou
 * rendre 200 en écrivant dans le journal d'audit d'un autre locataire. Le
 * magasin enregistre donc chaque mutation, avec ses arguments, pour que le
 * test puisse affirmer non pas « la route a répondu » mais « la route a écrit
 * CECI, à cet endroit-là ».
 */
export interface WriteEntry {
  model: string;
  op: "create" | "createMany" | "update" | "updateMany" | "delete" | "deleteMany";
  args: unknown;
  /** Nombre de lignes réellement touchées (0 = mutation sans effet). */
  affected: number;
}

export class WriteJournal {
  readonly entries: WriteEntry[] = [];
  record(e: WriteEntry): void {
    this.entries.push(e);
  }
  clear(): void {
    this.entries.length = 0;
  }
  /** Mutations d'un modèle donné, journal d'audit inclus si on le nomme. */
  on(model: string): WriteEntry[] {
    return this.entries.filter((e) => e.model === model);
  }
  /** Tout sauf le modèle nommé — sert à isoler l'effet métier de l'audit. */
  except(...models: string[]): WriteEntry[] {
    return this.entries.filter((e) => !models.includes(e.model));
  }
}

interface ModelOptions {
  relations?: RelationResolver;
  /** Calcule les `_count` demandés dans un `select`. */
  counts?: (row: Row) => Record<string, number>;
  /** Relations chargeables via `include`. */
  includes?: RelationLoader;
  /** Nom du modèle, tel qu'il apparaît dans le journal d'écritures. */
  name?: string;
  /** Journal partagé. Absent = les mutations ne sont pas enregistrées. */
  journal?: WriteJournal;
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

function applyInclude(row: Row, include: unknown, includes: RelationLoader): Row {
  if (!include || typeof include !== "object") return { ...row };
  const out: Row = { ...row };
  for (const [key, sub] of Object.entries(include as Record<string, unknown>)) {
    if (sub === false || sub === undefined) continue;
    const loader = includes[key];
    // Une relation demandée que le magasin ne sait pas charger doit LEVER.
    // Rendre `undefined` en silence ferait passer un test pour la mauvaise
    // raison — même doctrine que UnsupportedOperatorError.
    if (!loader) throw new UnsupportedOperatorError(`include -> ${key}`);
    out[key] = loader(row, sub);
  }
  return out;
}

export function makeModel(rows: Row[], opts: ModelOptions = {}) {
  const relations = opts.relations ?? {};
  const includes = opts.includes ?? {};
  const model = opts.name ?? "(anonyme)";
  const pick = (args: { where?: unknown }) => rows.filter((r) => matchWhere(r, args?.where, relations));
  const shape = (row: Row, args: { select?: Record<string, unknown>; include?: unknown }) =>
    args?.select
      ? applySelect(row, args.select, opts.counts)
      : applyInclude(row, args?.include, includes);
  const note = (op: WriteEntry["op"], args: unknown, affected: number) => {
    opts.journal?.record({ model, op, args, affected });
  };

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
      return out.map((r) => shape(r, args));
    },
    async findFirst(args: { where?: unknown; select?: Record<string, unknown>; include?: unknown } = {}) {
      const hit = pick(args)[0];
      return hit ? shape(hit, args) : null;
    },
    // `findUnique` partage l'évaluateur de `findFirst` : les lignes du magasin
    // portent un `id` unique, et toute clause non couverte lève au lieu de
    // filtrer à vide.
    async findUnique(args: { where?: unknown; select?: Record<string, unknown>; include?: unknown } = {}) {
      const hit = pick(args)[0];
      return hit ? shape(hit, args) : null;
    },
    async findUniqueOrThrow(
      args: { where?: unknown; select?: Record<string, unknown>; include?: unknown } = {},
    ) {
      const hit = pick(args)[0];
      if (!hit) throw new Error(`${model}: findUniqueOrThrow sans résultat`);
      return shape(hit, args);
    },
    async count(args: { where?: unknown } = {}) {
      return pick(args).length;
    },

    // ── Mutations ───────────────────────────────────────────────────────────
    // Elles existent pour A4 : prouver qu'une route rend 200 ne dit pas si
    // elle a écrit, ni où. Chaque mutation passe par le journal.
    async create(args: { data: Row; select?: Record<string, unknown>; include?: unknown }) {
      const row: Row = { id: `${model}-${rows.length + 1}`, ...args.data };
      rows.push(row);
      note("create", args.data, 1);
      return shape(row, args);
    },
    async createMany(args: { data: Row | Row[]; skipDuplicates?: boolean }) {
      const list = Array.isArray(args.data) ? args.data : [args.data];
      for (const d of list) rows.push({ id: `${model}-${rows.length + 1}`, ...d });
      note("createMany", list, list.length);
      return { count: list.length };
    },
    async update(args: { where?: unknown; data: Row; select?: Record<string, unknown>; include?: unknown }) {
      const hit = pick(args)[0];
      if (!hit) throw new Error(`${model}: update sans ligne correspondante`);
      Object.assign(hit, args.data);
      note("update", { where: args.where, data: args.data }, 1);
      return shape(hit, args);
    },
    async updateMany(args: { where?: unknown; data: Row }) {
      const hits = pick(args);
      hits.forEach((h) => Object.assign(h, args.data));
      note("updateMany", { where: args.where, data: args.data }, hits.length);
      return { count: hits.length };
    },
    async delete(args: { where?: unknown; select?: Record<string, unknown> }) {
      const hit = pick(args)[0];
      if (!hit) throw new Error(`${model}: delete sans ligne correspondante`);
      rows.splice(rows.indexOf(hit), 1);
      note("delete", args.where, 1);
      return applySelect(hit, args.select, opts.counts);
    },
    async deleteMany(args: { where?: unknown } = {}) {
      const hits = pick(args);
      for (const h of hits) rows.splice(rows.indexOf(h), 1);
      note("deleteMany", args.where, hits.length);
      return { count: hits.length };
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
