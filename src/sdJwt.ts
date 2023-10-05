import { MakePropertyRequired, OrPromise } from './types'
import { Base64url } from './base64url'
import { SdJwtError } from './error'
import { HasherAlgorithm } from './hasherAlgorithm'
import { deleteByPath } from './util'
import { SaltGenerator, createDecoys } from './createDecoys'
import { createObjectDisclosure } from './createDisclosure'
import { hashDisclosure } from './hashDisclosure'

type ReturnSdJwtWithHeaderAndPayload<T extends SdJwt> = MakePropertyRequired<
    T,
    'header' | 'payload'
>

type ReturnSdJwtWithHeader<T extends SdJwt> = MakePropertyRequired<T, 'header'>
type ReturnSdJwtWithPayload<T extends SdJwt> = MakePropertyRequired<
    T,
    'payload'
>
type ReturnSdJwtWithSignature<T extends SdJwt> = MakePropertyRequired<
    T,
    'signature'
>

export type DisclosureFrame<DP> = {
    [K in keyof DP]?: DP[K] extends Record<string, unknown>
        ? ({ __decoyCount?: number } & DisclosureFrame<DP[K]>) | boolean
        : boolean
} & { __decoyCount?: number }

export type DisclosurePayload<DP> = {
    [K in keyof DP]?: DP[K] extends Record<string, unknown>
        ? CommonSdJwtPayloadProperties & DisclosureFrame<DP[K]>
        : DP[K]
}

export type VerifyOptions<Header extends Record<string, unknown>> = {
    message: string
    signature: Uint8Array
    header: Header
}
export type Verifier<Header extends Record<string, unknown>> = (
    options: VerifyOptions<Header>
) => OrPromise<boolean>

/**
 * A simple hash function that takes the base64url encoded variant of the disclosure and MUST return a base64url encoded version of the digest
 */
export type Hasher = (input: string) => OrPromise<string>
export type HasherAndAlgorithm = {
    hasher: Hasher
    algorithm: string | HasherAlgorithm
}

export type Signer<
    Header extends Record<string, unknown> = Record<string, unknown>
> = (input: string, header: Header) => OrPromise<Uint8Array>

export type SdJwtToCompactOptions<
    DisclosablePayload extends Record<string, unknown>
> = {
    disclosureFrame?: DisclosureFrame<DisclosablePayload>
}

export type SdJwtOptions<
    Header extends Record<string, unknown>,
    Payload extends Record<string, unknown>
> = {
    header?: Header
    payload?: Payload
    signature?: Uint8Array
}

export type SdJwtAdditionalOptions<
    H extends Record<string, unknown>,
    DP extends Record<string, unknown>
> = {
    hasherAndAlgorithm?: HasherAndAlgorithm
    saltGenerator?: SaltGenerator
    signer?: Signer<H>
    disclosureFrame?: DisclosureFrame<DP>
}

type CommonSdJwtPayloadProperties = {
    _sd_alg?: string | HasherAlgorithm
    _sd?: Array<string>
}

type CommonSdJwtHeaderProperties = {
    alg?: string
    jwk?: Record<string, unknown>
    kid?: string
}

export class SdJwt<
    Header extends Record<string, unknown> = Record<string, unknown>,
    Payload extends Record<string, unknown> = Record<string, unknown>
> {
    public header?: Header & CommonSdJwtHeaderProperties
    public payload?: Payload & CommonSdJwtPayloadProperties
    public signature?: Uint8Array

    private saltGenerator?: SaltGenerator
    private signer?: Signer
    private hasherAndAlgorithm?: HasherAndAlgorithm
    private disclosureFrame?: DisclosureFrame<Payload>

    public constructor(
        options?: SdJwtOptions<Header, Payload>,
        additionalOptions?: SdJwtAdditionalOptions<Header, Payload>
    ) {
        this.header = options?.header
        this.payload = options?.payload
        this.signature = options?.signature

        if (additionalOptions?.hasherAndAlgorithm) {
            this.withHasher(additionalOptions.hasherAndAlgorithm)
        }

        if (additionalOptions?.saltGenerator) {
            this.withSaltGenerator(additionalOptions.saltGenerator)
        }

        if (additionalOptions?.disclosureFrame) {
            this.withDisclosureFrame(additionalOptions.disclosureFrame)
        }

        if (additionalOptions?.signer) {
            this.withSigner(additionalOptions.signer)
        }
    }

    public static fromCompact<
        Header extends Record<string, unknown> = Record<string, unknown>,
        Payload extends Record<string, unknown> = Record<string, unknown>
    >(compact: string) {
        const [sHeader, sPayload, sSignatureAndDisclosures] = compact.split('.')

        const header = Base64url.decodeToJson<Header>(sHeader)
        const payload = Base64url.decodeToJson<Payload>(sPayload)
        // ignore disclosures for now
        const [sSignature] = sSignatureAndDisclosures.split('~')
        const signature = Base64url.decode(sSignature)

        const sdJwt = new SdJwt<Header, Payload>({
            header,
            payload,
            signature
        })

        return sdJwt as ReturnSdJwtWithHeaderAndPayload<typeof sdJwt>
    }

    public withSaltGenerator(saltGenerator: SaltGenerator) {
        this.saltGenerator = saltGenerator
        return this
    }

    public withSigner(signer: Signer<Header>) {
        this.signer = signer as Signer<Record<string, unknown>>
        return this
    }

    public withHasher(
        hasherAndAlgorithm: HasherAndAlgorithm
    ): ReturnSdJwtWithPayload<this> {
        this.hasherAndAlgorithm = hasherAndAlgorithm

        this.addPayloadClaim('_sd_alg', hasherAndAlgorithm.algorithm)

        return this as ReturnSdJwtWithPayload<this>
    }

    public withHeader(header: Header): ReturnSdJwtWithHeader<this> {
        this.header = header
        return this as ReturnSdJwtWithHeader<this>
    }

    public addHeaderClaim(
        item: keyof Header,
        value: Header[typeof item] | unknown
    ): ReturnSdJwtWithHeader<this> {
        this.header ??= {} as Header
        this.header = { [item]: value, ...this.header }
        return this as ReturnSdJwtWithHeader<this>
    }

    public withPayload(payload: Payload): ReturnSdJwtWithPayload<this> {
        this.payload = payload
        return this as ReturnSdJwtWithPayload<this>
    }

    public withDisclosureFrame(disclosureFrame: DisclosureFrame<Payload>) {
        this.disclosureFrame = disclosureFrame
        return this
    }

    public addPayloadClaim(
        item: keyof Payload,
        value: Payload[typeof item] | unknown
    ): ReturnSdJwtWithPayload<this> {
        this.payload ??= {} as Payload
        this.payload = { [item]: value, ...this.payload }
        return this as ReturnSdJwtWithPayload<this>
    }

    public withSignature(
        signature: Uint8Array
    ): ReturnSdJwtWithSignature<this> {
        this.signature = signature
        return this as ReturnSdJwtWithSignature<this>
    }

    private async createDisclosure(
        key: string,
        value: unknown
    ): Promise<string> {
        this.assertSaltGenerator()

        const salt = await this.saltGenerator!()
        const disclosure = createObjectDisclosure(salt, key, value)

        return disclosure
    }

    private async hashDisclosure(disclosure: string): Promise<string> {
        this.assertHashAndAlgorithm()

        return await hashDisclosure(disclosure, this.hasherAndAlgorithm!.hasher)
    }

    private async createDecoys(count: number): Promise<Array<string>> {
        this.assertSaltGenerator()
        this.assertHashAndAlgorithm()

        const decoys = await createDecoys(
            count,
            this.saltGenerator!,
            this.hasherAndAlgorithm!.hasher
        )

        return decoys
    }

    private async applyDisclosureFrame(
        object: Payload,
        frame: DisclosureFrame<Payload>,
        disclosures: Array<string> = [],
        keys: Array<string> = [],
        cleanup: Array<Array<string>> = []
    ): Promise<{
        disclosures: Array<string>
        payload: Record<string, unknown>
    }> {
        for (const [key, value] of Object.entries(frame)) {
            const newKeys = [...keys, key]
            if (key === '__decoyCount' && typeof value === 'number') {
                const sd: Array<string> = Array.from(
                    (object._sd as string[]) ?? []
                )
                const decoy = await this.createDecoys(value)
                decoy.forEach((digest) => sd.push(digest))
                // @ts-ignore
                object._sd = sd.sort()
            } else if (typeof value === 'boolean') {
                if (value === true) {
                    const sd: Array<string> = Array.from(
                        (object._sd as string[]) ?? []
                    )

                    const disclosure = await this.createDisclosure(
                        key,
                        object[key]
                    )

                    disclosures.push(disclosure)

                    const digest = await this.hashDisclosure(disclosure)
                    sd.push(digest)

                    //@ts-ignore
                    object._sd = sd.sort()

                    cleanup.push(newKeys)
                }
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                this.applyDisclosureFrame(
                    object[key] as Payload,
                    value as DisclosureFrame<Payload>,
                    disclosures,
                    newKeys,
                    cleanup
                )
            } else {
                throw new SdJwtError(
                    `Invalid type in frame with key '${key}' and type '${typeof value}'. Only Record<string, unknown> and boolean are allowed.`
                )
            }
        }

        const payloadClone = { ...object }
        cleanup.forEach((path) => {
            deleteByPath(payloadClone, path.join('.'))
        })

        return { disclosures, payload: payloadClone }
    }

    private assertHeader() {
        if (!this.header) {
            throw new SdJwtError('Header must be defined')
        }
    }

    private assertPayload() {
        if (!this.payload) {
            throw new SdJwtError('Payload must be defined')
        }
    }

    private assertSignature() {
        if (!this.signature) {
            throw new SdJwtError('Signature must be defined')
        }
    }

    private assertSaltGenerator() {
        if (!this.saltGenerator) {
            throw new SdJwtError(
                'Cannot create a disclosure without a salt generator. You can set it with this.withSaltGenerator()'
            )
        }
    }

    private assertHashAndAlgorithm() {
        if (!this.hasherAndAlgorithm) {
            throw new SdJwtError(
                'A hasher and algorithm must be set in order to create a digest of a disclosure. You can set it with this.withHasherAndAlgorithm()'
            )
        }
    }

    private assertSigner() {
        if (!this.signer) {
            throw new SdJwtError(
                'A signer must be provided to create a signature. You can set it with this.withSigner()'
            )
        }
    }

    public get signableInput() {
        return `${this.compactHeader}.${this.compactPayload}`
    }

    public async signAndAdd(): Promise<ReturnSdJwtWithSignature<this>> {
        this.assertSigner()
        const signature = await this.signer!(this.signableInput, this.header!)
        this.withSignature(signature)

        return this as ReturnSdJwtWithSignature<this>
    }

    private get compactHeader() {
        this.assertHeader()
        return Base64url.encodeFromJson(this.header!)
    }

    private get compactPayload() {
        this.assertPayload()
        return Base64url.encodeFromJson(this.payload!)
    }

    public async verifySignature(cb: Verifier<Header>): Promise<boolean> {
        this.assertSignature()
        const message = this.signableInput

        return await cb({
            message,
            header: this.header as Header,
            signature: this.signature!
        })
    }

    public async toCompact(
        options?: SdJwtToCompactOptions<Payload>
    ): Promise<string> {
        this.assertHeader()
        this.assertPayload()

        const frame = options?.disclosureFrame ?? this.disclosureFrame

        const { disclosures, payload } = frame
            ? await this.applyDisclosureFrame(
                  { ...this.payload } as Payload,
                  frame as DisclosureFrame<Payload>
              )
            : { disclosures: [], payload: this.payload }

        const sHeader = Base64url.encode(JSON.stringify(this.header))
        const sPayload = Base64url.encode(JSON.stringify(payload))

        if (disclosures.length > 0 && this.signature) {
            throw new SdJwtError(
                'Signature is already set by the user when selectively disclosable items still have to be removed. This will invalidate the signature. Try to provide a signer on SdJwt.withSigner and SdJwt.toCompact will call it at the correct time.'
            )
        }

        const sSignature = this.signature
            ? Base64url.encode(this.signature)
            : Base64url.encode((await this.signAndAdd()).signature!)

        const sDisclosures =
            disclosures.length > 0 ? `~${disclosures.join('~')}~` : ''

        return `${sHeader}.${sPayload}.${sSignature}${sDisclosures}`
    }
}
