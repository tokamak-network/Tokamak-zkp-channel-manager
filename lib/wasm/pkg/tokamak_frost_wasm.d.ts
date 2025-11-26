/* tslint:disable */
/* eslint-disable */
export function init_panic_hook(): void;
export function keccak256(message: string): string;
export function generate_ecdsa_keypair(): string;
export function derive_key_from_signature(signature_hex: string): string;
export function sign_challenge(private_key_hex: string, challenge: string): string;
export function sign_message(private_key_hex: string, message_hex: string): string;
export function get_identifier_hex(id: number): string;
export function get_auth_payload_round1(session_id: string, id_hex: string, pkg_hex: string): string;
export function get_auth_payload_round2(session_id: string, from_id_hex: string, to_id_hex: string, eph_pub_hex: string, nonce_hex: string, ct_hex: string): string;
export function get_auth_payload_finalize(session_id: string, id_hex: string, group_vk_hex: string): string;
export function get_auth_payload_sign_r1(session_id: string, group_id: string, id_hex: string, commits_hex: string): string;
export function get_auth_payload_sign_r2(session_id: string, group_id: string, id_hex: string, sigshare_hex: string, msg32_hex: string): string;
export function dkg_part1(identifier_hex: string, max_signers: number, min_signers: number): string;
export function dkg_part2(secret_package_hex: string, round1_packages_hex: any): string;
export function dkg_part3(secret_package_hex: string, round1_packages_hex: any, round2_packages_hex: any, group_id: string, roster_js: any): string;
export function get_key_package_metadata(key_package_hex: string): string;
export function get_signing_prerequisites(key_package_hex: string): string;
export function sign_part1_commit(key_package_hex: string): string;
export function sign_part2_sign(key_package_hex: string, nonces_hex: string, signing_package_hex: string): string;
export function ecies_encrypt(recipient_pubkey_hex: string, plaintext_hex: string): string;
export function ecies_decrypt(recipient_private_key_hex: string, ephemeral_public_key_hex: string, nonce_hex: string, ciphertext_hex: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly keccak256: (a: number, b: number) => [number, number];
  readonly generate_ecdsa_keypair: () => [number, number];
  readonly derive_key_from_signature: (a: number, b: number) => [number, number, number, number];
  readonly sign_challenge: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly sign_message: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly get_identifier_hex: (a: number) => [number, number, number, number];
  readonly get_auth_payload_round1: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly get_auth_payload_round2: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => [number, number, number, number];
  readonly get_auth_payload_finalize: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly get_auth_payload_sign_r1: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
  readonly get_auth_payload_sign_r2: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
  readonly dkg_part1: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly dkg_part2: (a: number, b: number, c: any) => [number, number, number, number];
  readonly dkg_part3: (a: number, b: number, c: any, d: any, e: number, f: number, g: any) => [number, number, number, number];
  readonly get_key_package_metadata: (a: number, b: number) => [number, number, number, number];
  readonly get_signing_prerequisites: (a: number, b: number) => [number, number, number, number];
  readonly sign_part1_commit: (a: number, b: number) => [number, number, number, number];
  readonly sign_part2_sign: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
  readonly ecies_encrypt: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly ecies_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
  readonly init_panic_hook: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
