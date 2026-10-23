import crypto from "crypto";

export interface MockStore {
  user: any[];
  resume: any[];
  evidenceItem: any[];
  bullet: any[];
  job: any[];
  ingestedJob: any[];
  connectorSyncLog: any[];
  resumeVariant: any[];
  patch: any[];
  coverLetter: any[];
  discoveredJob: any[];
  masterHistory: any[];
  interviewProblem: any[];
  companyDossier: any[];
  jobApplication: any[];
  applicationEvent: any[];
  systemInfo: any[];
  [key: string]: any[];
}

export function createMockStore(): MockStore {
  return {
    user: [],
    resume: [],
    evidenceItem: [],
    bullet: [],
    job: [],
    ingestedJob: [],
    connectorSyncLog: [],
    resumeVariant: [],
    patch: [],
    coverLetter: [],
    discoveredJob: [],
    masterHistory: [],
    interviewProblem: [],
    companyDossier: [],
    jobApplication: [],
    applicationEvent: [],
    systemInfo: [],
  };
}

const globalForMock = globalThis as unknown as {
  __resumeForgeMockStore?: MockStore;
};

function getActiveStore(): MockStore {
  if (!globalForMock.__resumeForgeMockStore) {
    globalForMock.__resumeForgeMockStore = createMockStore();
  }
  return globalForMock.__resumeForgeMockStore;
}

export const activeStore: MockStore = new Proxy({} as MockStore, {
  get(_target, prop: string | symbol) {
    return getActiveStore()[prop as string];
  },
  set(_target, prop: string | symbol, value: any) {
    getActiveStore()[prop as string] = value;
    return true;
  },
  has(_target, prop: string | symbol) {
    return prop in getActiveStore();
  },
  ownKeys(_target) {
    return Reflect.ownKeys(getActiveStore());
  },
  getOwnPropertyDescriptor(_target, prop: string | symbol) {
    return Object.getOwnPropertyDescriptor(getActiveStore(), prop);
  },
});

export function resetMockStore() {
  globalForMock.__resumeForgeMockStore = createMockStore();
}

function matchCondition(itemVal: any, condVal: any): boolean {
  if (condVal === undefined) return true;
  if (condVal === null) {
    return itemVal === null || itemVal === undefined;
  }
  if (typeof condVal === "object" && !Array.isArray(condVal) && !(condVal instanceof Date)) {
    let hasKnownOp = false;
    for (const [op, val] of Object.entries(condVal)) {
      if (op === "equals") {
        hasKnownOp = true;
        if (itemVal !== val) return false;
      } else if (op === "not") {
        hasKnownOp = true;
        if (itemVal === val) return false;
      } else if (op === "in") {
        hasKnownOp = true;
        if (!Array.isArray(val) || !val.includes(itemVal)) return false;
      } else if (op === "notIn") {
        hasKnownOp = true;
        if (Array.isArray(val) && val.includes(itemVal)) return false;
      } else if (op === "contains") {
        hasKnownOp = true;
        const itemStr = String(itemVal ?? "").toLowerCase();
        const searchStr = String(val ?? "").toLowerCase();
        if (!itemStr.includes(searchStr)) return false;
      } else if (op === "startsWith") {
        hasKnownOp = true;
        const itemStr = String(itemVal ?? "").toLowerCase();
        const searchStr = String(val ?? "").toLowerCase();
        if (!itemStr.startsWith(searchStr)) return false;
      } else if (op === "endsWith") {
        hasKnownOp = true;
        const itemStr = String(itemVal ?? "").toLowerCase();
        const searchStr = String(val ?? "").toLowerCase();
        if (!itemStr.endsWith(searchStr)) return false;
      } else if (op === "gt") {
        hasKnownOp = true;
        if (itemVal == null || !(itemVal > (val as any))) return false;
      } else if (op === "gte") {
        hasKnownOp = true;
        if (itemVal == null || !(itemVal >= (val as any))) return false;
      } else if (op === "lt") {
        hasKnownOp = true;
        if (itemVal == null || !(itemVal < (val as any))) return false;
      } else if (op === "lte") {
        hasKnownOp = true;
        if (itemVal == null || !(itemVal <= (val as any))) return false;
      }
    }
    return hasKnownOp;
  }
  if (itemVal instanceof Date && condVal instanceof Date) {
    return itemVal.getTime() === condVal.getTime();
  }
  return itemVal === condVal;
}

function matchesWhere(item: any, where?: any): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  if (where.AND) {
    const ands = Array.isArray(where.AND) ? where.AND : [where.AND];
    if (!ands.every((w: any) => matchesWhere(item, w))) return false;
  }
  if (where.OR) {
    const ors = Array.isArray(where.OR) ? where.OR : [where.OR];
    if (!ors.some((w: any) => matchesWhere(item, w))) return false;
  }
  if (where.NOT) {
    const nots = Array.isArray(where.NOT) ? where.NOT : [where.NOT];
    if (nots.some((w: any) => matchesWhere(item, w))) return false;
  }

  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND" || key === "OR" || key === "NOT") continue;
    if (key === "masterResume" && item.masterResumeId) {
      const parent = activeStore.resume?.find((r: any) => r.id === item.masterResumeId);
      if (!parent || !matchesWhere(parent, cond)) return false;
      continue;
    }
    if (key === "job" && item.jobId) {
      const parent = activeStore.job?.find((j: any) => j.id === item.jobId);
      if (!parent || !matchesWhere(parent, cond)) return false;
      continue;
    }
    if (key === "user" && item.userId) {
      const parent = activeStore.user?.find((u: any) => u.id === item.userId);
      if (!parent || !matchesWhere(parent, cond)) return false;
      continue;
    }
    if (key === "variant" && item.variantId) {
      const parent = activeStore.resumeVariant?.find((v: any) => v.id === item.variantId);
      if (!parent || !matchesWhere(parent, cond)) return false;
      continue;
    }
    if (key === "applications") {
      const apps = activeStore.jobApplication?.filter((a: any) => a.jobId === item.id) || [];
      const condAny = cond as any;
      if (condAny && typeof condAny === "object") {
        if (condAny.some && !apps.some((a: any) => matchesWhere(a, condAny.some))) return false;
        if (condAny.none && apps.some((a: any) => matchesWhere(a, condAny.none))) return false;
        continue;
      }
    }
    if ((key === "variants" || key === "coverLetters" || key === "patchProposalBatches") && item.rawDescription !== undefined) {
      const table = key === "variants" ? activeStore.resumeVariant
        : key === "coverLetters" ? activeStore.coverLetter : activeStore.patchProposalBatch;
      const children = table?.filter((child: any) => child.jobId === item.id) || [];
      const relation = cond as any;
      if (relation?.none && children.some((child: any) => matchesWhere(child, relation.none))) return false;
      if (relation?.some && !children.some((child: any) => matchesWhere(child, relation.some))) return false;
      if (relation?.every && !children.every((child: any) => matchesWhere(child, relation.every))) return false;
      continue;
    }
    if (!matchCondition(item[key], cond)) return false;
  }
  return true;
}

function resolveIncludes(table: string, item: any, include?: any) {
  if (!include || !item) return item;
  const result = { ...item };

  if (include.bullets && (table === "evidenceItem" || table === "EvidenceItem")) {
    result.bullets = activeStore.bullet.filter((b) => b.evidenceId === item.id);
  }
  const inc = include;
  if (inc.variants) {
    if (table === "resume" || table === "Resume") {
      result.variants = activeStore.resumeVariant.filter((v) => v.masterResumeId === item.id);
    } else if (table === "job" || table === "Job") {
      let variants = activeStore.resumeVariant.filter((v) => v.jobId === item.id);
      if (typeof inc.variants === "object" && inc.variants?.where) {
        variants = variants.filter((r: any) => matchesWhere(r, inc.variants.where));
      }
      result.variants = variants;
    }
  }
  if (inc.patches && (table === "resumeVariant" || table === "ResumeVariant")) {
    result.patches = activeStore.patch.filter((p) => p.variantId === item.id);
  }
  if (inc.coverLetters && (table === "job" || table === "Job")) {
    let cls = activeStore.coverLetter.filter((c) => c.jobId === item.id);
    if (typeof inc.coverLetters === "object" && inc.coverLetters?.where) {
      cls = cls.filter((r: any) => matchesWhere(r, inc.coverLetters.where));
    }
    result.coverLetters = cls;
  }
  if (include.job) {
    result.job = activeStore.job.find((j) => j.id === item.jobId) ?? null;
  }
  if (include.variant) {
    result.variant = activeStore.resumeVariant.find((v) => v.id === item.variantId) ?? null;
  }
  if (include.masterResume) {
    result.masterResume = activeStore.resume.find((r) => r.id === item.masterResumeId) ?? null;
  }
  if (include.trackedJob && (table === "ingestedJob" || table === "IngestedJob")) {
    result.trackedJob = activeStore.job.find((j) => j.id === item.trackedJobId) ?? null;
  }
  if (include.dossier && (table === "job" || table === "Job")) {
    result.dossier = activeStore.companyDossier.find((d) => d.id === item.dossierId) ?? null;
  }
  if (include.applications && (table === "job" || table === "Job")) {
    const spec = include.applications;
    let apps = (activeStore.jobApplication || []).filter((a) => a.jobId === item.id);
    if (spec.where) apps = apps.filter((a) => matchesWhere(a, spec.where));
    result.applications = apps.map((a) => ({ ...a }));
  }
  if (include.events && (table === "jobApplication" || table === "JobApplication")) {
    result.events = (activeStore.applicationEvent || []).filter((e) => e.applicationId === item.id);
  }
  if (include.user && item.userId) {
    result.user = activeStore.user.find((u) => u.id === item.userId) ?? null;
  }

  return result;
}

function normalizeTableName(name: string): string {
  if (!name) return "";
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function applyWriteData(existing: Record<string, unknown>, data: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in (value as object)) {
      next[key] = (Number(existing[key]) || 0) + Number((value as { increment: number }).increment);
    } else if (value && typeof value === "object" && "decrement" in (value as object)) {
      next[key] = (Number(existing[key]) || 0) - Number((value as { decrement: number }).decrement);
    } else {
      next[key] = value;
    }
  }
  return next;
}

export function createModelMock(modelName: string) {
  const tableKey = normalizeTableName(modelName);

  return {
    async findUnique(args: { where: any; select?: any; include?: any }) {
      const table = activeStore[tableKey] || [];
      const item = table.find((row) => matchesWhere(row, args?.where));
      if (!item) return null;
      return resolveIncludes(tableKey, JSON.parse(JSON.stringify(item)), args?.include);
    },

    async findUniqueOrThrow(args: { where: any; select?: any; include?: any }) {
      const table = activeStore[tableKey] || [];
      const item = table.find((row) => matchesWhere(row, args?.where));
      if (!item) {
        throw new Error(`Record not found in ${modelName} with where: ${JSON.stringify(args?.where)}`);
      }
      return resolveIncludes(tableKey, JSON.parse(JSON.stringify(item)), args?.include);
    },

    async findFirst(args?: { where?: any; select?: any; include?: any; orderBy?: any }) {
      const table = activeStore[tableKey] || [];
      let filtered = table.filter((row) => matchesWhere(row, args?.where));
      if (args?.orderBy) {
        filtered = sortItems(filtered, args.orderBy);
      }
      const item = filtered[0];
      if (!item) return null;
      return resolveIncludes(tableKey, JSON.parse(JSON.stringify(item)), args?.include);
    },

    async findFirstOrThrow(args?: { where?: any; select?: any; include?: any; orderBy?: any }) {
      const table = activeStore[tableKey] || [];
      let filtered = table.filter((row) => matchesWhere(row, args?.where));
      if (args?.orderBy) {
        filtered = sortItems(filtered, args.orderBy);
      }
      const item = filtered[0];
      if (!item) {
        throw new Error(`Record not found in ${modelName} with where: ${JSON.stringify(args?.where)}`);
      }
      return resolveIncludes(tableKey, JSON.parse(JSON.stringify(item)), args?.include);
    },

    async findMany(args?: { where?: any; select?: any; include?: any; orderBy?: any; skip?: number; take?: number }) {
      const table = activeStore[tableKey] || [];
      let filtered = table.filter((row) => matchesWhere(row, args?.where));
      if (args?.orderBy) {
        filtered = sortItems(filtered, args.orderBy);
      }
      if (typeof args?.skip === "number") {
        filtered = filtered.slice(args.skip);
      }
      if (typeof args?.take === "number") {
        filtered = filtered.slice(0, args.take);
      }
      return filtered.map((row) => resolveIncludes(tableKey, JSON.parse(JSON.stringify(row)), args?.include));
    },

    async create(args: { data: any; select?: any; include?: any }) {
      if (!activeStore[tableKey]) activeStore[tableKey] = [];
      const dataCopy = { ...args.data };
      const nestedBullets = dataCopy.bullets?.create;
      delete dataCopy.bullets;

      const row: any = {
        id: dataCopy.id || crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dataCopy,
      };

      // Model-specific default fields
      if (tableKey === "user") {
        if (row.sessionVersion === undefined) row.sessionVersion = 0;
      }
      if (tableKey === "resume") {
        if (row.isMaster === undefined) row.isMaster = false;
        if (row.isProtected === undefined) row.isProtected = true;
      }
      if (tableKey === "evidenceItem") {
        if (!row.status) row.status = "verified";
        if (!row.tags) row.tags = "[]";
      }
      if (tableKey === "bullet") {
        if (row.verified === undefined) row.verified = true;
        if (!row.technologies) row.technologies = "[]";
      }
      if (tableKey === "job") {
        if (!row.status) row.status = "SAVED";
        if (!row.source) row.source = "pasted";
        if (!row.extractedRequirements) row.extractedRequirements = "{}";
      }
      if (tableKey === "resumeVariant") {
        if (!row.status) row.status = "DRAFT";
      }
      if (tableKey === "patch") {
        if (!row.status) row.status = "PENDING";
        if (row.confidence === undefined) row.confidence = 0;
        if (!row.evidenceCitations) row.evidenceCitations = "[]";
      }
      if (tableKey === "coverLetter") {
        if (!row.status) row.status = "DRAFT";
        if (!row.salutation) row.salutation = "Dear Hiring Team,";
        if (!row.evidenceCitations) row.evidenceCitations = "[]";
      }
      if (tableKey === "applicationEvent") {
        if (!row.at) row.at = new Date();
      }
      if (tableKey === "jobApplication") {
        if (row.variantId === undefined) row.variantId = null;
      }

      activeStore[tableKey].push(row);

      // Handle nested creates
      if (nestedBullets) {
        const bulletList = Array.isArray(nestedBullets) ? nestedBullets : [nestedBullets];
        for (const b of bulletList) {
          const bRow = {
            id: b.id || crypto.randomUUID(),
            evidenceId: row.id,
            text: b.text || "",
            technologies: b.technologies || "[]",
            roleAffinity: b.roleAffinity || "[]",
            verified: b.verified !== undefined ? b.verified : true,
            orderIndex: b.orderIndex || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          activeStore.bullet.push(bRow);
        }
      }

      return resolveIncludes(tableKey, JSON.parse(JSON.stringify(row)), args.include);
    },

    async createMany(args: { data: any[] }) {
      if (!activeStore[tableKey]) activeStore[tableKey] = [];
      const items = Array.isArray(args.data) ? args.data : [args.data];
      let count = 0;
      for (const item of items) {
        const row: any = {
          id: item.id || crypto.randomUUID(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...item,
        };
        activeStore[tableKey].push(row);
        count++;
      }
      return { count };
    },

    async update(args: { where: any; data: any; select?: any; include?: any }) {
      const table = activeStore[tableKey] || [];
      const index = table.findIndex((row) => matchesWhere(row, args.where));
      if (index === -1) {
        throw new Error(`Record to update not found in ${tableKey}`);
      }
      const dataCopy = { ...args.data };
      const nestedBullets = dataCopy.bullets?.create;
      delete dataCopy.bullets;

      const existing = table[index];
      const updated = {
        ...existing,
        ...applyWriteData(existing, dataCopy),
        updatedAt: new Date(),
      };
      table[index] = updated;

      if (nestedBullets) {
        const bulletList = Array.isArray(nestedBullets) ? nestedBullets : [nestedBullets];
        for (const b of bulletList) {
          const bRow = {
            id: b.id || crypto.randomUUID(),
            evidenceId: existing.id,
            text: b.text || "",
            technologies: b.technologies || "[]",
            roleAffinity: b.roleAffinity || "[]",
            verified: b.verified !== undefined ? b.verified : true,
            orderIndex: b.orderIndex || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          activeStore.bullet.push(bRow);
        }
      }

      return resolveIncludes(tableKey, JSON.parse(JSON.stringify(updated)), args.include);
    },

    async updateMany(args: { where?: any; data: any }) {
      const table = activeStore[tableKey] || [];
      let count = 0;
      for (let i = 0; i < table.length; i++) {
        if (matchesWhere(table[i], args?.where)) {
          table[i] = {
            ...table[i],
            ...applyWriteData(table[i], args.data),
            updatedAt: new Date(),
          };
          count++;
        }
      }
      return { count };
    },

    async upsert(args: { where: any; create: any; update: any; select?: any; include?: any }) {
      const table = activeStore[tableKey] || [];
      const index = table.findIndex((row) => matchesWhere(row, args.where));
      if (index !== -1) {
        const updated = {
          ...table[index],
          ...args.update,
          updatedAt: new Date(),
        };
        table[index] = updated;
        return resolveIncludes(tableKey, JSON.parse(JSON.stringify(updated)), args.include);
      } else {
        return this.create({ data: args.create, include: args.include });
      }
    },

    async delete(args: { where: any }) {
      const table = activeStore[tableKey] || [];
      const index = table.findIndex((row) => matchesWhere(row, args.where));
      if (index === -1) {
        throw new Error(`Record to delete not found in ${tableKey}`);
      }
      const [removed] = table.splice(index, 1);
      return JSON.parse(JSON.stringify(removed));
    },

    async deleteMany(args?: { where?: any }) {
      const table = activeStore[tableKey] || [];
      if (!args?.where || Object.keys(args.where).length === 0) {
        const count = table.length;
        activeStore[tableKey] = [];
        return { count };
      }
      const initial = table.length;
      activeStore[tableKey] = table.filter((row) => !matchesWhere(row, args.where));
      return { count: initial - activeStore[tableKey].length };
    },

    async count(args?: { where?: any }) {
      const table = activeStore[tableKey] || [];
      return table.filter((row) => matchesWhere(row, args?.where)).length;
    },
  };
}

function sortItems(items: any[], orderBy: any): any[] {
  const cloned = [...items];
  const orderEntries = Array.isArray(orderBy) ? orderBy : [orderBy];

  return cloned.sort((a, b) => {
    for (const order of orderEntries) {
      for (const [key, dir] of Object.entries(order)) {
        const valA = a[key];
        const valB = b[key];
        if (valA === valB) continue;
        const direction = dir === "desc" ? -1 : 1;
        if (valA > valB) return direction;
        if (valA < valB) return -direction;
      }
    }
    return 0;
  });
}

export function createPrismaMockClient() {
  const modelMocks: Record<string, any> = {};

  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "$transaction") {
          return async (arg: any) => {
            if (typeof arg === "function") {
              return await arg(proxy);
            }
            if (Array.isArray(arg)) {
              const results = [];
              for (const p of arg) {
                results.push(await p);
              }
              return results;
            }
            throw new Error("Invalid transaction argument");
          };
        }
        if (prop === "$connect" || prop === "$disconnect") {
          return async () => {};
        }
        if (prop.startsWith("$")) {
          return async () => {};
        }
        if (!modelMocks[prop]) {
          modelMocks[prop] = createModelMock(prop);
        }
        return modelMocks[prop];
      },
    }
  );

  return proxy;
}
