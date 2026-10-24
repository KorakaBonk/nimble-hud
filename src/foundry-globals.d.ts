// Foundry exposes these as globals at runtime. They are deliberately loosely typed: the
// module only touches a small, known surface, and every Nimble-specific access is
// funnelled through src/adapter/ where it gets a real type.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const game: any;
declare const Hooks: any;
declare const canvas: any;
declare const CONFIG: any;
declare const foundry: any;
declare const ui: any;
declare const ChatMessage: any;
declare const Roll: any;
declare const fromUuid: any;
