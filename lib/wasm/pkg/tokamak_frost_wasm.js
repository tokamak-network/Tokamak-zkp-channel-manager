// Stub file for missing WASM module
// This allows the build to proceed without the actual WASM implementation

export default async function init() {
  console.warn('FROST WASM module is not available - using stub implementation');
}

export function init_panic_hook() {}
export function generate_ecdsa_keypair() { return '{}'; }
export function derive_key_from_signature() { return '{}'; }
export function sign_challenge() { return ''; }
export function sign_message() { return ''; }
export function dkg_part1() { return '{}'; }
export function dkg_part2() { return '{}'; }
export function dkg_part3() { return '{}'; }
export function ecies_encrypt() { return '{}'; }
export function ecies_decrypt() { return ''; }
export function get_auth_payload_round1() { return ''; }
export function get_auth_payload_round2() { return ''; }
export function get_auth_payload_finalize() { return ''; }
export function get_identifier_hex() { return ''; }
export function sign_part1_commit() { return '{}'; }
export function sign_part2_sign() { return ''; }
export function get_signing_prerequisites() { return '{}'; }
export function get_key_package_metadata() { return '{}'; }
export function get_auth_payload_sign_r1() { return ''; }
export function get_auth_payload_sign_r2() { return ''; }
export function keccak256() { return ''; }