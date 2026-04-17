interface IDL {
  Text: unknown;
  Nat: unknown;
  Nat8: unknown;
  Nat16: unknown;
  Nat32: unknown;
  Nat64: unknown;
  Int: unknown;
  Int8: unknown;
  Int16: unknown;
  Int32: unknown;
  Int64: unknown;
  Float32: unknown;
  Float64: unknown;
  Bool: unknown;
  Null: unknown;
  Vec: (type: unknown) => unknown;
  Opt: (type: unknown) => unknown;
  Record: (fields: [string, unknown][] | Record<string, unknown>) => unknown;
  Variant: (fields: [string, unknown][] | Record<string, unknown>) => unknown;
  Func: (argTypes: unknown[], retTypes: unknown[], annotations: string[]) => unknown;
  Tuple: (...types: unknown[]) => unknown;
  Service: (methods: [string, unknown][] | Record<string, unknown>) => unknown;
  RenamedClass: (name: string, fields: [string, unknown][]) => unknown;
  Reserved: unknown;
  Empty: unknown;
}

declare module "@icp-sdk/core/agent" {
  export interface HttpAgentOptions {
    identity?: unknown;
    host?: string;
    fetch?: unknown;
    fetchOptions?: unknown;
    callOptions?: unknown;
    reuseIdentity?: boolean;
    verifyQuerySignatures?: boolean;
    rootKey?: Uint8Array;
    source?: unknown;
    maxResponseContentLength?: number;
    maxRequestContentLength?: number;
    backoffStrategy?: unknown;
    log?: unknown;
  }

  export class HttpAgent {
    static create(options?: HttpAgentOptions): Promise<HttpAgent>;
    fetchRootKey(): Promise<Uint8Array>;
    readonly host: URL;
  }

  export class Actor {
    static createActor<T>(
      interfaceFactory: (options: { IDL: IDL }) => unknown,
      configuration: { agent: HttpAgent; canisterId: unknown },
    ): T;
  }
}

declare module "@icp-sdk/core/identity" {
  export abstract class Identity {
    getPrincipal(): import("@icp-sdk/core/principal").Principal;
    getSenderKey(): unknown;
    sign(blob: Uint8Array): Promise<unknown>;
  }

  export class SignIdentity extends Identity {}

  export class PartialIdentity extends Identity {}

  export class AnonymousIdentity extends Identity {
    getPrincipal(): import("@icp-sdk/core/principal").Principal;
  }
}

declare module "@icp-sdk/core/principal" {
  export class Principal {
    static fromText(text: string): Principal;
    static anonymous(): Principal;
    toText(): string;
    toUint8Array(): Uint8Array;
    toBlob(): Uint8Array;
    toString(): string;
    isAnonymous(): boolean;
    equals(other: Principal): boolean;
  }
}

declare module "@icp-sdk/auth/client" {
  import { Identity, SignIdentity, PartialIdentity } from "@icp-sdk/core/identity";
  import { Principal } from "@icp-sdk/core/principal";

  export interface AuthClientCreateOptions {
    identity?: SignIdentity | PartialIdentity;
    storage?: unknown;
    keyType?: "ECDSA" | "Ed25519";
    idleOptions?: unknown;
    loginOptions?: AuthClientLoginOptions;
  }

  export interface AuthClientLoginOptions {
    identityProvider?: string;
    maxTimeToLive?: bigint;
    onSuccess?: (() => void | Promise<void>) | ((message: unknown) => void | Promise<void>);
    onError?: (error?: string) => void | Promise<void>;
    derivationOrigin?: string;
    windowOpenerFeatures?: string;
  }

  export class AuthClient {
    static create(options?: AuthClientCreateOptions): Promise<AuthClient>;
    getIdentity(): Identity;
    getPrincipal(): Principal;
    isAuthenticated(): Promise<boolean>;
    login(options?: AuthClientLoginOptions): Promise<void>;
    logout(options?: { returnTo?: string }): Promise<void>;
  }
}