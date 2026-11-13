/** Who the identity provider says is calling. Produced by the verifier; consumed when finding or creating our user. */
export interface Identity { authId: string; email: string; name: string }
