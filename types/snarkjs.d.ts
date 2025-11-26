declare module 'snarkjs' {
  export namespace groth16 {
    interface Proof {
      pi_a: [string, string, string];
      pi_b: [[string, string], [string, string], [string, string]];
      pi_c: [string, string, string];
      protocol: string;
      curve: string;
    }

    interface ProofResult {
      proof: Proof;
      publicSignals: string[];
    }

    function fullProve(
      input: any,
      wasmPath: string,
      zkeyPath: string
    ): Promise<ProofResult>;

    function verify(
      vkey: any,
      publicSignals: string[],
      proof: Proof
    ): Promise<boolean>;
  }
}