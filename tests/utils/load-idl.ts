import path from "path";
import fs from "fs";
import { createHash } from "crypto";
import * as anchor from "@coral-xyz/anchor";
import type { AnchorProvider, Program } from "@coral-xyz/anchor";

type MutableRecord = Record<string, unknown>;
type MutableIdl = anchor.Idl & MutableRecord;

function canonicalizeTypeName(name: string): string {
  return name === "publicKey" ? "pubkey" : name;
}

function normalizeType(node: unknown): void {
  if (!node || typeof node !== "object") {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((entry) => normalizeType(entry));
    return;
  }

  const typed = node as MutableRecord;

  if (typeof typed.defined === "string") {
    typed.defined = { name: typed.defined, generics: [] };
  }

  if (typed.defined && typeof typed.defined === "object") {
    const defined = typed.defined as MutableRecord;
    if (defined.name === undefined && typeof defined.type === "string") {
      defined.name = defined.type;
    }
    if (!Array.isArray(defined.generics)) {
      defined.generics = [];
    }
  }

  if (typeof typed.type === "string") {
    typed.type = canonicalizeTypeName(typed.type);
  }

  if (typed.type && typeof typed.type === "object") {
    normalizeType(typed.type);
  }

  if (typeof typed.option === "string") {
    typed.option = canonicalizeTypeName(typed.option);
  } else if (typed.option && typeof typed.option === "object") {
    normalizeType(typed.option);
  }

  if (typeof typed.vec === "string") {
    typed.vec = canonicalizeTypeName(typed.vec);
  } else if (typed.vec && typeof typed.vec === "object") {
    normalizeType(typed.vec);
  }

  if (typed.array && Array.isArray(typed.array) && typed.array[0] !== undefined) {
    if (typeof typed.array[0] === "string") {
      typed.array[0] = canonicalizeTypeName(typed.array[0] as string);
    } else {
      normalizeType(typed.array[0]);
    }
  }

  if (Array.isArray(typed.args)) {
    typed.args.forEach((arg) => normalizeType(arg));
  }

  if (Array.isArray(typed.fields)) {
    typed.fields.forEach((field) => normalizeType(field));
  }

  if (Array.isArray(typed.variants)) {
    typed.variants.forEach((variant) => normalizeType(variant));
  }
}

export function normalizeIdl<T extends MutableIdl>(idl: T): T {
  idl.instructions?.forEach((instruction) => {
    instruction.args?.forEach((arg) => normalizeType(arg));

    if (!instruction.discriminator && typeof instruction.name === "string") {
      instruction.discriminator = deriveDiscriminator("global", instruction.name);
    }
  });

  const types = (idl.types ??= []) as Array<MutableRecord>;

  idl.accounts?.forEach((account) => {
    normalizeType(account);

    if (!account.discriminator && typeof account.name === "string") {
      account.discriminator = deriveDiscriminator("account", account.name);
    }

    const accountRecord = account as MutableRecord;
    const accountName = accountRecord.name;

    if (typeof accountName === "string") {
      const existingType = types.find((typeDef) => typeDef.name === accountName);
      if (!existingType && accountRecord.type) {
        const accountTypeDef: MutableRecord = {
          name: accountName,
          type: accountRecord.type,
        };
        normalizeType(accountTypeDef);
        types.push(accountTypeDef);
      }
    }
  });

  idl.types?.forEach((typeDef) => {
    normalizeType(typeDef);
  });

  idl.events?.forEach((event) => {
    normalizeType(event);

    if (!event.discriminator && typeof event.name === "string") {
      event.discriminator = deriveDiscriminator("event", event.name);
    }

    const eventRecord = event as MutableRecord;
    const eventName = eventRecord.name;

    if (
      typeof eventName === "string" &&
      !types.find((typeDef) => typeDef.name === eventName)
    ) {
      const fields = Array.isArray(eventRecord.fields)
        ? eventRecord.fields.map((field) => {
            const fieldRecord = field as MutableRecord;
            return {
              name: fieldRecord.name,
              type: fieldRecord.type,
            } as MutableRecord;
          })
        : [];

      const eventTypeDef: MutableRecord = {
        name: eventName,
        type: {
          kind: "struct",
          fields,
        },
      };

      normalizeType(eventTypeDef);
      types.push(eventTypeDef);
    }
  });

  return idl;
}

function deriveDiscriminator(namespace: string, name: string): number[] {
  return Array.from(
    createHash("sha256")
      .update(`${namespace}:${name}`)
      .digest()
      .slice(0, 8)
  );
}

function toWorkspaceKey(programName: string): string {
  return programName
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

export function loadIdl(programName: string): anchor.Idl {
  const idlPath = path.resolve(
    __dirname,
    "..",
    "..",
    "sdk",
    "src",
    "idl",
    `${programName}.json`
  );

  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found for ${programName} at ${idlPath}`);
  }

  const rawIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8")) as MutableIdl;
  return normalizeIdl(rawIdl);
}

interface LoadProgramOptions {
  programName: string;
  provider: AnchorProvider;
  programId?: string;
  registerWorkspace?: boolean;
  workspaceKey?: string;
}

export function loadProgram({
  programName,
  provider,
  programId,
  registerWorkspace = true,
  workspaceKey,
}: LoadProgramOptions): Program {
  const idl = loadIdl(programName) as MutableIdl;

  if (programId) {
    idl.address = programId;
  }

  const program = new anchor.Program(idl, provider);

  if (registerWorkspace) {
    const idlName = (idl as MutableRecord).name;
    const key = workspaceKey ?? toWorkspaceKey(typeof idlName === "string" ? idlName : programName);
    (anchor.workspace as Record<string, Program>)[key] = program;
  }

  return program;
}
