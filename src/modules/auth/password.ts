import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
};

export function hash(plain: string): Promise<string> {
    return argon2Hash(plain, ARGON2_OPTIONS);
}

export function verify(hashed: string, plain: string): Promise<boolean> {
    return argon2Verify(hashed, plain);
}