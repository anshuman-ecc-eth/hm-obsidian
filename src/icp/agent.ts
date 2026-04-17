/**
 * ICP Agent and Actor creation module
 * Creates authenticated HttpAgent and actor for canister calls
 */

import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { Identity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";
import { HyvmindActor, PublishSourceGraphInput, PublishResult } from "../types/canister";

const idlFactory = ({ IDL }: { IDL: IDL }) => {
  const CustomAttribute = IDL.Record({
    key: IDL.Text,
    value: IDL.Text,
  });

  const SourceGraphNodeInput = IDL.Record({
    name: IDL.Text,
    nodeType: IDL.Text,
    jurisdiction: IDL.Opt(IDL.Text),
    tags: IDL.Vec(IDL.Text),
    content: IDL.Opt(IDL.Text),
    parentName: IDL.Opt(IDL.Text),
    attributes: IDL.Vec(CustomAttribute),
  });

  const SourceGraphEdgeInput = IDL.Record({
    sourceName: IDL.Text,
    targetName: IDL.Text,
    edgeLabel: IDL.Text,
    bidirectional: IDL.Bool,
  });

  const PublishSourceGraphInput = IDL.Record({
    nodes: IDL.Vec(SourceGraphNodeInput),
    edges: IDL.Vec(SourceGraphEdgeInput),
  });

  const PublishResult = IDL.Variant({
    success: IDL.Record({ message: IDL.Text }),
    noChanges: IDL.Null,
    error: IDL.Text,
  });

  const UserProfile = IDL.Record({
    name: IDL.Text,
    socialUrl: IDL.Opt(IDL.Text),
  });

  return IDL.Service({
    publishSourceGraph: IDL.Func([PublishSourceGraphInput], [PublishResult], []),
    initializeAccessControl: IDL.Func([], [], []),
    isCallerApproved: IDL.Func([], [IDL.Bool], ["query"]),
    requestApproval: IDL.Func([], [], []),
    getCallerUserProfile: IDL.Func([], [IDL.Opt(UserProfile)], ["query"]),
    saveCallerUserProfile: IDL.Func([UserProfile], [], []),
  });
};

function getRootKey(): Uint8Array | undefined {
  try {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "IC_ROOT_KEY" && value) {
        return Uint8Array.from(atob(value));
      }
    }
  } catch {
    // Cookie not available or parsing failed
  }
  return undefined;
}

export class ICPAgent {
  private agent: HttpAgent | null = null;
  private actor: HyvmindActor | null = null;
  private canisterId: string;
  private host: string;

  constructor(canisterId: string, host: string) {
    this.canisterId = canisterId;
    this.host = host;
  }

  async createAuthenticatedActor(identity: Identity): Promise<HyvmindActor> {
    const rootKey = getRootKey();

    this.agent = await HttpAgent.create({
      identity,
      host: this.host,
      rootKey: rootKey,
    });

    if (!rootKey && this.host.includes("localhost")) {
      await this.agent.fetchRootKey();
    }

    this.actor = Actor.createActor<HyvmindActor>(idlFactory, {
      agent: this.agent,
      canisterId: Principal.fromText(this.canisterId),
    });

    return this.actor;
  }

  getActor(): HyvmindActor | null {
    return this.actor;
  }

  updateConfig(canisterId: string, host: string): void {
    this.canisterId = canisterId;
    this.host = host;
    this.actor = null;
    this.agent = null;
  }

  async publishSourceGraph(input: PublishSourceGraphInput): Promise<PublishResult> {
    if (!this.actor) {
      throw new Error("Actor not initialized");
    }

    const result = await this.actor.publishSourceGraph(input);
    return result;
  }

  async isCallerApproved(): Promise<boolean> {
    if (!this.actor) {
      throw new Error("Actor not initialized");
    }

    return await this.actor.isCallerApproved();
  }

  async initializeAccessControl(): Promise<void> {
    if (!this.actor) {
      throw new Error("Actor not initialized");
    }

    await this.actor.initializeAccessControl();
  }

  async requestApproval(): Promise<void> {
    if (!this.actor) {
      throw new Error("Actor not initialized");
    }

    await this.actor.requestApproval();
  }

  async saveUserProfile(name: string): Promise<void> {
    if (!this.actor) {
      throw new Error("Actor not initialized");
    }

    await this.actor.saveCallerUserProfile({
      name,
      socialUrl: null,
    });
  }

  async getUserProfile(): Promise<{ name: string; socialUrl: string | null } | null> {
    if (!this.actor) {
      throw new Error("Actor not initialized");
    }

    return await this.actor.getCallerUserProfile();
  }
}
